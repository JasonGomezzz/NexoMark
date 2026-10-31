"""Explicit X publication with approved image/text and durable duplicate protection."""
import re
import hashlib
from types import SimpleNamespace
from uuid import UUID

import requests
from cryptography.fernet import InvalidToken
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .platform_content import platform_copy
from .publication_guard import existing_content, publication_feedback
from twitter_text import parse_tweet

from apps.authentication.models import XAccount
from apps.authentication.permissions import IsMarketero
from apps.authentication.x_oauth import access_token_for, configured
from core.exceptions import api_response
from .facebook_publication import jpeg_image
from .models import Campaign, XPublication, XSummary
from services.platform_copy_service import adapt_platform_copies


def source_digest(campaign):
    return hashlib.sha256((platform_copy(campaign, 'twitter') + '\0' + (campaign.imagen_b64 or '')).encode()).hexdigest()


def summary_for(campaign, value):
    try:
        summary_id = UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError('El resumen de X no es válido.') from None
    summary = get_object_or_404(XSummary, pk=summary_id, campaign=campaign)
    if summary.campaign_version != campaign.version or summary.source_digest != source_digest(campaign):
        raise ValidationError('La campaña cambió. Genera un nuevo resumen de X.')
    return summary


class XSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        if campaign.estado != 'aprobado' or 'twitter' not in (campaign.plataformas or [campaign.plataforma]):
            return Response(api_response(False, 'La campaña debe estar aprobada y tener X seleccionado.'), status=409)
        if type(request.data.get('version')) is not int or request.data['version'] != campaign.version:
            return Response(api_response(False, 'La campaña cambió. Recarga antes de resumir.'), status=409)
        source = platform_copy(campaign, 'twitter')
        if not source.strip():
            return Response(api_response(False, 'No hay contenido aprobado para resumir.'), status=400)
        digest = source_digest(campaign)
        try:
            caption = adapt_platform_copies(SimpleNamespace(
                plataformas=['twitter'], plataforma='twitter', texto_generado=source,
                titulo=campaign.titulo, tono=campaign.tono))['twitter']
            validation = text_validation(caption)
            if not validation['valid']:
                raise ValueError('La IA no produjo un resumen válido para X. Puedes volver a generar; no se recortó ni cambió el contenido aprobado.')
        except ValueError as error:
            return Response(api_response(False, str(error)), status=503)
        with transaction.atomic():
            current = get_object_or_404(Campaign.objects.select_for_update(), pk=campaign_id, marketero=request.user)
            if current.estado != 'aprobado' or current.version != campaign.version or source_digest(current) != digest:
                return Response(api_response(False, 'La campaña cambió durante el resumen. Recarga.'), status=409)
            summary = XSummary.objects.create(campaign=current, campaign_version=current.version,
                                             source_digest=digest, caption=caption)
        return Response(api_response(True, 'Resumen preparado. Revísalo y confirma antes de publicar.', {
            'summary_id': str(summary.pk), 'caption': caption, 'text_validation': validation,
            'campaign_version': current.version, 'caption_source': 'marketer_summary'}))


class XRejected(Exception):
    """Only a static message is exposed, never upstream request/response details."""
    def __init__(self, status, stage):
        messages = {
            402: 'X rechazó la solicitud por falta de créditos en la cuenta de desarrollador.',
            401: 'La autorización de X ya no es válida. Reconecta tu cuenta en Configuración.',
            403: 'X rechazó la solicitud. Revisa los permisos de publicación y el acceso de tu app.',
            429: 'X alcanzó su límite de solicitudes. Espera antes de volver a confirmar.',
        }
        super().__init__(messages.get(status, 'X rechazó la imagen.' if stage == 'media' else
                                        'X rechazó la publicación. Revisa el texto y la cuenta conectada.'))


def text_validation(caption):
    if not isinstance(caption, str) or len(caption) > 10000:
        return {'valid': False, 'weighted_length': len(caption) if isinstance(caption, str) else 0, 'limit': 280}
    parsed = parse_tweet(caption)
    return {'valid': bool(caption.strip()) and parsed.valid,
            'weighted_length': parsed.weightedLength, 'limit': 280}


def upload_image(publication, token):
    response = requests.post('https://api.x.com/2/media/upload',
        headers={'Authorization': f'Bearer {token}'},
        json={'media': publication.image_jpeg, 'media_category': 'tweet_image'},
        timeout=30, allow_redirects=False)
    if not 200 <= response.status_code < 300:
        raise XRejected(response.status_code, 'media')
    data = response.json()
    if not isinstance(data, dict) or data.get('errors') or not isinstance(data.get('data'), dict):
        raise ValueError('Invalid media response')
    media = data['data']
    media_id = media.get('id')
    if not isinstance(media_id, str) or not re.fullmatch(r'[0-9]{1,64}', media_id):
        raise ValueError('Invalid media ID')
    processing = media.get('processing_info')
    if processing is not None and (not isinstance(processing, dict) or processing.get('state') != 'succeeded'):
        raise ValueError('Media is not ready')
    return media_id


def send_post(publication, token):
    response = requests.post('https://api.x.com/2/tweets',
        headers={'Authorization': f'Bearer {token}'},
        json={'text': publication.caption, 'media': {'media_ids': [publication.media_id]}},
        timeout=30, allow_redirects=False)
    if 400 <= response.status_code < 500:
        raise XRejected(response.status_code, 'post')
    if response.status_code != 201:
        raise ValueError('Unconfirmed post')
    data = response.json()
    if not isinstance(data, dict) or data.get('errors') or not isinstance(data.get('data'), dict):
        raise ValueError('Unconfirmed post')
    post_id = data['data'].get('id')
    if not isinstance(post_id, str) or not re.fullmatch(r'[0-9]{1,64}', post_id):
        raise ValueError('Unconfirmed post')
    return post_id


def result(publication, validation, campaign=None):
    feedback = publication_feedback(publication, 'twitter', campaign)
    return Response(api_response(True, feedback['publication_notice'] or publication.message or
        'La publicación está en proceso. No vuelvas a enviarla.', {
            **feedback, 'username': publication.username,
            'post_id': publication.post_id,
            'publication_url': f'https://x.com/i/status/{publication.post_id}'
                if feedback['status'] == 'published' else '',
            'text_validation': validation,
            'caption': publication.caption,
            'caption_source': 'marketer_summary' if publication.summary_id else 'client_approved',
            'summary_id': str(publication.summary_id) if publication.summary_id else None,
        }), status=202 if feedback['status'] in ('preparing', 'publishing') else 200)


def owned_account(owner, value):
    if (isinstance(value, bool) or not isinstance(value, (int, str)) or
            not str(value).isdigit() or len(str(value)) > 18):
        raise ValidationError('Selecciona una cuenta de X válida.')
    return get_object_or_404(XAccount, pk=int(value), owner=owner)


class XPublishView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        summary = summary_for(campaign, request.query_params['summary_id']) if request.query_params.get('summary_id') else None
        caption = summary.caption if summary else platform_copy(campaign, 'twitter')
        validation = text_validation(caption)
        if request.query_params.get('account_id'):
            account = owned_account(request.user, request.query_params['account_id'])
            records = XPublication.objects.filter(campaign=campaign, x_user_id=account.x_user_id)
            publication = existing_content(records, campaign, 'twitter', caption, jpeg_image)
            if publication:
                return result(publication, text_validation(publication.caption), campaign)
        return Response(api_response(True, 'Prepara la publicación de X.',
            {'status': 'not_published', 'text_validation': validation, 'caption': caption,
             'caption_source': 'marketer_summary' if summary else 'client_approved'}))

    def post(self, request, campaign_id):
        if request.data.get('confirm') is not True:
            return Response(api_response(False, 'Confirma la publicación antes de enviarla.'), status=400)
        with transaction.atomic():
            campaign = get_object_or_404(Campaign.objects.select_for_update(), pk=campaign_id, marketero=request.user)
            account = owned_account(request.user, request.data.get('account_id'))
            if campaign.estado != 'aprobado' or 'twitter' not in (campaign.plataformas or [campaign.plataforma]):
                return Response(api_response(False, 'La campaña debe estar aprobada y tener Twitter / X seleccionado.'), status=400)
            version = request.data.get('version')
            if type(version) is not int or version != campaign.version:
                return Response(api_response(False, 'La campaña cambió. Recarga antes de publicar.'), status=409)
            summary = summary_for(campaign, request.data['summary_id']) if request.data.get('summary_id') else None
            if summary and request.data.get('confirm_summary') is not True:
                return Response(api_response(False, 'Confirma expresamente el resumen de X como marketero.'), status=400)
            caption = summary.caption if summary else platform_copy(campaign, 'twitter')
            validation = text_validation(caption)
            existing = existing_content(XPublication.objects.filter(campaign=campaign, x_user_id=account.x_user_id),
                campaign, 'twitter', caption, jpeg_image)
            if existing and existing.campaign_version != campaign.version:
                return result(existing, text_validation(existing.caption), campaign)
            if existing and existing.status != 'failed':
                return result(existing, text_validation(existing.caption))
            if not validation['valid']:
                return Response(api_response(False, 'El texto aprobado no cumple el límite de X (280 caracteres ponderados). Necesitas un texto válido aprobado antes de publicar.'), status=400)
            if not configured():
                return Response(api_response(False, 'Falta configurar X en el servidor.'), status=503)
            try:
                jpeg = jpeg_image(campaign.imagen_b64)
            except ValueError as error:
                return Response(api_response(False, str(error)), status=400)
            if existing:
                if existing.caption != caption or existing.image_jpeg != jpeg:
                    return Response(api_response(False, 'El contenido cambió. Recarga la campaña antes de publicar.'), status=409)
                publication = existing
                publication.status = 'preparing'
                publication.message = ''
                publication.summary = summary
                publication.confirmed_by = request.user
                publication.confirmed_at = timezone.now()
                publication.save(update_fields=['status', 'message', 'summary', 'confirmed_by', 'confirmed_at'])
            else:
                publication = XPublication.objects.create(campaign=campaign, account=account,
                    x_user_id=account.x_user_id, username=account.username,
                    campaign_version=campaign.version, caption=caption, image_jpeg=jpeg,
                    summary=summary, confirmed_by=request.user, confirmed_at=timezone.now())
        # Only this explicitly confirmed request performs uploads/refreshes. GET
        # and reconnection never post. Concurrent clicks return the durable attempt.
        try:
            token = access_token_for(account)
            publication.media_id = upload_image(publication, token)
        except XRejected as error:
            publication.status, publication.message = 'failed', str(error)
        except (requests.RequestException, ValueError, TypeError, KeyError, AttributeError,
                InvalidToken, UnicodeError, ObjectDoesNotExist):
            publication.status = 'failed'
            publication.message = 'No se pudo preparar la imagen o renovar la autorización de X. Reconecta tu cuenta y comprueba sus créditos antes de volver a confirmar.'
        else:
            # Save BEFORE the irreversible public POST. Ambiguous responses must
            # never result in another public POST, even across disconnection.
            publication.status = 'publishing'
            publication.save(update_fields=['status', 'media_id'])
            try:
                publication.post_id = send_post(publication, token)
                publication.status = 'published'
                publication.message = 'Publicación enviada a X con imagen y texto.'
            except XRejected as error:
                publication.status, publication.message = 'failed', str(error)
            except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
                publication.status = 'uncertain'
                publication.message = 'X no confirmó el resultado. Revisa tu perfil antes de continuar; no reenviaremos para evitar duplicados.'
        publication.save(update_fields=['status', 'media_id', 'post_id', 'message'])
        return result(publication, validation)
