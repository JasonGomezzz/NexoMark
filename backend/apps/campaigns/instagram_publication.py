"""Explicit, owner-scoped publishing with durable duplicate protection."""
import base64
import binascii
from datetime import timedelta
from io import BytesIO
from urllib.parse import urlsplit

import requests
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .platform_content import platform_copy
from .publication_guard import existing_content, publication_feedback, instagram_permalink

from apps.authentication.instagram import cipher
from apps.authentication.models import InstagramAccount
from apps.authentication.permissions import IsMarketero
from core.exceptions import api_response
from .models import Campaign, InstagramPublication, PublicationMetricSnapshot


def jpeg_image(value):
    if not value or len(value) > 24 * 1024 * 1024:
        raise ValueError('La campaña necesita una imagen válida para publicar.')
    try:
        raw = base64.b64decode(value, validate=True)
        with Image.open(BytesIO(raw)) as source:
            if source.width * source.height > 20_000_000:
                raise ValueError('La imagen es demasiado grande.')
            if not 0.8 <= source.width / source.height <= 1.91:
                raise ValueError('Instagram necesita una imagen con proporción entre 4:5 y 1.91:1.')
            image = source.convert('RGB')
            image.thumbnail((1440, 1800))
            output = BytesIO()
            image.save(output, format='JPEG', quality=92)
        if output.tell() > 8 * 1024 * 1024:
            raise ValueError('La imagen supera el límite de Instagram.')
        return base64.b64encode(output.getvalue()).decode()
    except (binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValueError('La imagen de la campaña no se puede publicar.') from None


def graph(token, method, path, **payload):
    # Token is sent only in a header, never logged or returned to the browser.
    response = requests.request(method, f'https://graph.instagram.com/{path}',
        headers={'Authorization': f'Bearer {token}'}, timeout=20,
        **({'params': payload} if method == 'GET' else {'data': payload}))
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict) or 'error' in data:
        raise ValueError('Invalid Instagram response')
    return data


def result(publication, campaign=None):
    feedback = publication_feedback(publication, 'instagram', campaign)
    snapshot = PublicationMetricSnapshot.objects.filter(platform='instagram', publication_id=publication.pk).order_by('-measured_at', '-pk').first()
    message = publication.message or ('Instagram está confirmando la publicación. No la reenvíes.'
        if publication.status == 'publishing' else 'Instagram está preparando la imagen.')
    return Response(api_response(True, feedback['publication_notice'] or message, {
        **feedback, 'media_id': publication.media_id,
        'username': publication.username,
        'publication_url': instagram_permalink(snapshot.metrics.get('_permalink')) if snapshot and feedback['status'] == 'published' else '',
    }), status=202 if feedback['status'] == 'preparing' else 200)


def owned_account(owner, value):
    if (isinstance(value, bool) or not isinstance(value, (int, str))
            or not str(value).isdigit() or len(str(value)) > 18):
        raise ValidationError('Selecciona una cuenta de Instagram válida.')
    return get_object_or_404(InstagramAccount, pk=int(value), owner=owner)


class InstagramPublishView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        account = owned_account(request.user, request.query_params.get('account_id'))
        records = InstagramPublication.objects.filter(campaign=campaign, instagram_user_id=account.instagram_user_id)
        publication = existing_content(records, campaign, 'instagram', platform_copy(campaign, 'instagram'), jpeg_image)
        if publication:
            return result(publication, campaign)
        return Response(api_response(True, 'Todavía no se publicó este contenido en esta cuenta.',
            {'status': 'not_published', 'has_previous_publication': records.filter(status='published').exists()}))

    def post(self, request, campaign_id):
        if request.data.get('confirm') is not True:
            return Response(api_response(False, 'Confirma la publicación antes de enviarla.'), status=400)
        # Serialize clicks, retries and workers for this campaign. Do not automatically
        # retry media_publish after an ambiguous network failure.
        with transaction.atomic():
            campaign = get_object_or_404(Campaign.objects.select_for_update(),
                pk=campaign_id, marketero=request.user)
            account = owned_account(request.user, request.data.get('account_id'))
            if campaign.estado != 'aprobado' or 'instagram' not in (campaign.plataformas or [campaign.plataforma]):
                return Response(api_response(False, 'La campaña debe estar aprobada y tener Instagram seleccionado.'), status=400)
            if type(request.data.get('version')) is not int or request.data['version'] != campaign.version:
                return Response(api_response(False, 'La campaña cambió. Recarga antes de publicar.'), status=409)
            publication = existing_content(InstagramPublication.objects.filter(campaign=campaign,
                instagram_user_id=account.instagram_user_id), campaign, 'instagram', platform_copy(campaign, 'instagram'), jpeg_image)
            if publication and publication.campaign_version != campaign.version:
                return result(publication, campaign)
            if publication and publication.status != 'preparing':
                return result(publication)
            if account.expires_at <= timezone.now():
                return Response(api_response(False, 'La autorización venció. Reconecta Instagram.'), status=400)
            origin = urlsplit(settings.INSTAGRAM_FRONTEND_ORIGIN)
            if origin.scheme != 'https' or not origin.netloc or origin.path not in ('', '/'):
                return Response(api_response(False, 'Falta la dirección HTTPS pública para la imagen.'), status=503)
            if not publication:
                caption = platform_copy(campaign, 'instagram')
                if not caption.strip() or len(caption) > 2200:
                    return Response(api_response(False, 'El texto debe tener entre 1 y 2200 caracteres.'), status=400)
                try:
                    jpeg = jpeg_image(campaign.imagen_b64)
                except ValueError as error:
                    return Response(api_response(False, str(error)), status=400)
                publication = InstagramPublication.objects.create(campaign=campaign, account=account,
                    instagram_user_id=account.instagram_user_id, username=account.username,
                    campaign_version=campaign.version, caption=caption, image_jpeg=jpeg,
                    image_expires_at=timezone.now() + timedelta(minutes=30))
            try:
                token = cipher().decrypt(account.encrypted_token.encode()).decode()
            except (InvalidToken, ValueError, UnicodeError):
                return Response(api_response(False, 'Reconecta Instagram para renovar la credencial.'), status=400)
            # Commit the immutable image before Meta downloads it on the other server.
            publication_id = publication.pk
        return self.advance(publication_id, token)

    def advance(self, publication_id, token):
        with transaction.atomic():
            publication = InstagramPublication.objects.select_for_update().get(pk=publication_id)
            if publication.status != 'preparing':
                return result(publication)
            if publication.image_expires_at <= timezone.now():
                publication.status = 'failed'
                publication.message = 'La preparación venció. No se publicó contenido.'
                publication.save(update_fields=['status', 'message'])
                return result(publication)
            try:
                if not publication.container_id:
                    image_url = (settings.INSTAGRAM_FRONTEND_ORIGIN.rstrip('/')
                        + f'/api/instagram/media/{publication.image_ticket}/')
                    data = graph(token, 'POST', f'{publication.instagram_user_id}/media',
                        image_url=image_url, caption=publication.caption)
                    publication.container_id = str(data['id'])
                    publication.save(update_fields=['container_id'])
                state = graph(token, 'GET', publication.container_id, fields='status_code')['status_code']
                if state == 'FINISHED':
                    # Persist intent before making the irreversible external request.
                    publication.status = 'publishing'
                elif state in ('ERROR', 'EXPIRED'):
                    publication.status = 'failed'
                    publication.message = 'Instagram rechazó la imagen. Comprueba el formato y la conexión pública.'
                elif state not in ('IN_PROGRESS',):
                    publication.status = 'uncertain'
                    publication.message = 'Verifica tu perfil de Instagram antes de intentar otra publicación.'
                publication.save(update_fields=['status', 'message'])
            except (requests.RequestException, ValueError, KeyError, TypeError):
                publication.status = 'failed'
                publication.message = 'No se pudo preparar la imagen en Instagram. Revisa permisos y el túnel HTTPS.'
                publication.save(update_fields=['status', 'message'])
            publish = publication.status == 'publishing'
        if publish:
            try:
                data = graph(token, 'POST', f'{publication.instagram_user_id}/media_publish',
                    creation_id=publication.container_id)
                media_id = str(data['id'])
                if not media_id.isdigit() or len(media_id) > 64:
                    raise ValueError('Invalid media ID')
                publication.status, publication.media_id = 'published', media_id
                publication.message = 'Publicación enviada a Instagram con imagen y texto.'
            except (requests.RequestException, ValueError, KeyError, TypeError):
                publication.status = 'uncertain'
                publication.message = 'Instagram no confirmó el resultado. Revisa tu perfil; no reenviaremos para evitar duplicados.'
            publication.save(update_fields=['status', 'media_id', 'message'])
        return result(publication)


class InstagramMediaView(APIView):
    """Opaque, short-lived image-only capability for Meta; no campaign API exposed."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, ticket):
        publication = get_object_or_404(InstagramPublication,
            image_ticket=ticket, image_expires_at__gt=timezone.now())
        response = HttpResponse(base64.b64decode(publication.image_jpeg), content_type='image/jpeg')
        response['Cache-Control'] = 'no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
