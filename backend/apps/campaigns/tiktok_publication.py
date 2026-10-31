"""PHOTO/MEDIA_UPLOAD: sends a draft to the user's inbox, not Direct Post."""
import base64
from datetime import timedelta
from io import BytesIO
from urllib.parse import urlsplit

import requests
from PIL import Image
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .tiktok_post_ids import public_post_id

from apps.authentication.models import TikTokAccount
from apps.authentication.permissions import IsMarketero
from apps.authentication.tiktok import access_token_for, configured
from core.exceptions import api_response
from .facebook_publication import jpeg_image
from .models import Campaign, TikTokUpload
from .platform_content import platform_copy
from .publication_guard import existing_content, publication_feedback

MESSAGES = {
    'sending': 'Envío iniciado. No reenvíes esta campaña.',
    'processing': 'TikTok está procesando la imagen. Consulta el estado.',
    'inbox': 'Enviado a TikTok. Abre la notificación en tu bandeja, revisa el texto y las etiquetas comerciales/IA y termina la publicación.',
    'published': 'TikTok confirmó que completaste la publicación.',
    'failed': 'TikTok rechazó el procesamiento. Revisa la cuenta, la imagen y el portal; no se reenviará automáticamente.',
    'uncertain': 'No se confirmó el resultado del envío. Revisa TikTok; no lo reenviaremos para evitar duplicados.',
}


def media_ready():
    try:
        url = urlsplit(settings.TIKTOK_MEDIA_BASE_URL)
        return bool(settings.TIKTOK_MEDIA_VERIFIED and url.scheme == 'https' and url.netloc and
                    not url.username and not url.password and not url.query and not url.fragment and
                    url.path == '/api/tiktok/media/' and url.hostname not in ('localhost', '127.0.0.1'))
    except ValueError:
        return False


def utf16_length(value):
    return len(value.encode('utf-16-le')) // 2


def tiktok_jpeg(value):
    # TikTok photos permit at most 1080p; keep both dimensions <=1080.
    image_bytes = base64.b64decode(jpeg_image(value))
    with Image.open(BytesIO(image_bytes)) as image:
        image.thumbnail((1080, 1080))
        output = BytesIO()
        image.save(output, format='JPEG', quality=92)
    if output.tell() > 4 * 1024 * 1024:
        raise ValueError('La imagen supera el límite de esta integración.')
    return base64.b64encode(output.getvalue()).decode()


def owned_account(owner, value):
    if type(value) not in (str, int) or not str(value).isdigit() or len(str(value)) > 18:
        raise ValidationError('Selecciona una cuenta de TikTok válida.')
    return get_object_or_404(TikTokAccount, pk=int(value), owner=owner)


def provider_request(path, token, payload):
    response = requests.post('https://open.tiktokapis.com/v2/post/publish/' + path,
        headers={'Authorization': f'Bearer {token}'}, json=payload,
        timeout=20, allow_redirects=False)
    data = response.json()
    if (response.status_code != 200 or not isinstance(data, dict) or
            not isinstance(data.get('error'), dict) or data['error'].get('code') != 'ok' or
            not isinstance(data.get('data'), dict)):
        raise ValueError('TikTok no confirmó la solicitud.')
    return data['data']


def send_upload(upload, token):
    data = provider_request('content/init/', token, {
        'media_type': 'PHOTO', 'post_mode': 'MEDIA_UPLOAD', 'is_aigc': True,
        'post_info': {'description': upload.caption},
        'source_info': {'source': 'PULL_FROM_URL', 'photo_cover_index': 0,
            'photo_images': [settings.TIKTOK_MEDIA_BASE_URL + str(upload.image_ticket) + '/']},
    })
    publish_id = data.get('publish_id')
    if not isinstance(publish_id, str) or not 0 < len(publish_id) <= 64:
        raise ValueError('Identificador inválido.')
    return publish_id


def result(upload=None, campaign=None):
    feedback = publication_feedback(upload, 'tiktok', campaign) if upload else {}
    status = upload.status if upload else 'not_sent'
    link = getattr(upload, 'publication_link', None) if upload else None
    message = ('Publicación existente vinculada y verificada por API. El estado del envío original se conserva; no reenvíes.'
               if link else MESSAGES.get(status, 'Todavía no se envió esta campaña.'))
    return Response(api_response(True, feedback.get('publication_notice') or message, {
        'status': status, **feedback, 'account_name': upload.display_name if upload else '',
        'upload_id': upload.pk if upload else None,
        'linked_publication': {'post_id': link.post_id, 'post_url': link.post_url,
                               'verified_at': link.verified_at.isoformat()} if link else None,
        'media_ready': media_ready(),
        'confirmation_source': upload.confirmation_source if upload else '',
        'published_at': upload.published_at.isoformat() if upload and upload.published_at else None,
    }), status=202 if feedback.get('status', status) in ('sending', 'processing') else 200)


class TikTokUploadView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        account = owned_account(request.user, request.query_params.get('account_id'))
        upload = existing_content(TikTokUpload.objects.filter(campaign=campaign, open_id=account.open_id).select_related('publication_link'),
            campaign, 'tiktok', platform_copy(campaign, 'tiktok'), tiktok_jpeg)
        return result(upload, campaign)

    def post(self, request, campaign_id):
        if request.data.get('confirm') is not True:
            return Response(api_response(False, 'Confirma el envío de imagen y texto antes de continuar.'), status=400)
        with transaction.atomic():
            campaign = get_object_or_404(Campaign.objects.select_for_update(), pk=campaign_id, marketero=request.user)
            account = owned_account(request.user, request.data.get('account_id'))
            if campaign.estado != 'aprobado' or 'tiktok' not in (campaign.plataformas or [campaign.plataforma]):
                return Response(api_response(False, 'Se requiere una campaña aprobada con TikTok seleccionado.'), status=400)
            if type(request.data.get('version')) is not int or request.data['version'] != campaign.version:
                return Response(api_response(False, 'La campaña cambió. Recarga antes de enviarla.'), status=409)
            existing = existing_content(TikTokUpload.objects.filter(campaign=campaign, open_id=account.open_id).select_related('publication_link'),
                campaign, 'tiktok', platform_copy(campaign, 'tiktok'), tiktok_jpeg)
            if existing:
                return result(existing, campaign)
            if not configured() or not media_ready():
                return Response(api_response(False, 'Falta configurar TikTok y verificar la URL pública de imágenes en el portal.'), status=503)
            caption = platform_copy(campaign, 'tiktok')
            try:
                if not caption.strip() or utf16_length(caption) > 4000:
                    raise ValueError('El texto aprobado debe tener entre 1 y 4000 unidades UTF-16. No se recortará automáticamente.')
                jpeg = tiktok_jpeg(campaign.imagen_b64)
                if 'video.upload' not in account.scopes:
                    raise ValueError('Reconecta TikTok con permiso de envío.')
                token = access_token_for(account)
            except (ValueError, UnicodeError, InvalidToken, requests.RequestException, ObjectDoesNotExist):
                return Response(api_response(False, 'Revisa el texto (máximo 4000), la imagen y la autorización de TikTok.'), status=400)
            upload = TikTokUpload.objects.create(campaign=campaign, account=account, open_id=account.open_id,
                display_name=account.display_name, campaign_version=campaign.version, caption=caption,
                image_jpeg=jpeg, image_expires_at=timezone.now() + timedelta(hours=1))
        # Persist intent before sending; ambiguous requests must never be retried.
        try:
            upload.publish_id = send_upload(upload, token)
            upload.status = 'processing'
        except (requests.RequestException, ValueError, TypeError, KeyError):
            upload.status = 'uncertain'
        upload.save(update_fields=['publish_id', 'status'])
        return result(upload)


class TikTokUploadStatusView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        account = owned_account(request.user, request.data.get('account_id'))
        with transaction.atomic():
            upload = existing_content(TikTokUpload.objects.select_for_update(of=('self',)).filter(campaign=campaign,
                open_id=account.open_id).select_related('publication_link'), campaign, 'tiktok',
                platform_copy(campaign, 'tiktok'), tiktok_jpeg)
            if upload and upload.campaign_version != campaign.version:
                return result(upload, campaign)
            if (not upload or not upload.publish_id or upload.status == 'failed'
                    or upload.status == 'published' and upload.public_post_ids):
                return result(upload)
            if upload.checked_at and timezone.now() - upload.checked_at < timedelta(seconds=30):
                return result(upload)
            upload.checked_at = timezone.now()
            try:
                data = provider_request('status/fetch/', access_token_for(account), {'publish_id': upload.publish_id})
                statuses = {'PROCESSING_DOWNLOAD': 'processing', 'SEND_TO_USER_INBOX': 'inbox',
                            'PUBLISH_COMPLETE': 'published', 'FAILED': 'failed'}
                next_status = statuses.get(data.get('status'))
                if not next_status:
                    raise ValueError('Estado desconocido.')
                if upload.status != 'published':
                    upload.status = next_status
                if next_status == 'published':
                    upload.confirmation_source = 'status_api'
                    upload.published_at = upload.published_at or timezone.now()
                    # Provider spelling is intentional. An inbox receipt is not
                    # a public post ID and must never be used for Display API.
                    ids = data.get('publicaly_available_post_id')
                    if isinstance(ids, list) and len(ids) <= 20:
                        normalized = [public_post_id(i) for i in ids]
                        if all(normalized):
                            upload.public_post_ids = sorted(set(upload.public_post_ids + normalized))
            except (requests.RequestException, ValueError, UnicodeError, InvalidToken, TypeError, KeyError, ObjectDoesNotExist):
                # Keep last known result; no resend or downgrade on a failed read.
                upload.save(update_fields=['checked_at'])
                return Response(api_response(False, 'No se pudo consultar TikTok. Espera 30 segundos; no reenvíes la campaña.'), status=503)
            upload.save(update_fields=['status', 'checked_at', 'confirmation_source', 'published_at', 'public_post_ids'])
        return result(upload)


class TikTokMediaView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, ticket):
        upload = get_object_or_404(TikTokUpload, image_ticket=ticket,
            image_expires_at__gt=timezone.now(), status__in=['sending', 'processing', 'uncertain'])
        response = HttpResponse(base64.b64decode(upload.image_jpeg), content_type='image/jpeg')
        response['Cache-Control'] = 'no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Referrer-Policy'] = 'no-referrer'
        return response
