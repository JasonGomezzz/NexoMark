"""Confirmed Facebook photo posts; no automatic resend after ambiguous results."""
import base64
import binascii
from io import BytesIO
import re

import requests
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .platform_content import platform_copy
from .publication_guard import existing_content, publication_feedback

from apps.authentication.facebook import configured
from apps.authentication.instagram import cipher
from apps.authentication.models import FacebookPage
from apps.authentication.permissions import IsMarketero
from core.exceptions import api_response
from .models import Campaign, FacebookPublication


def jpeg_image(value):
    if not isinstance(value, str) or not value or len(value) > 24 * 1024 * 1024:
        raise ValueError('La campaña necesita una imagen válida para publicar.')
    try:
        with Image.open(BytesIO(base64.b64decode(value, validate=True))) as source:
            if source.width * source.height > 20_000_000:
                raise ValueError('La imagen es demasiado grande.')
            image = source.convert('RGB')
            image.thumbnail((1800, 1800))
            output = BytesIO()
            image.save(output, format='JPEG', quality=92)
        if output.tell() > 4 * 1024 * 1024:
            raise ValueError('La imagen supera el límite de 4 MB de esta integración.')
        return base64.b64encode(output.getvalue()).decode()
    except (binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValueError('La imagen de la campaña no se puede publicar.') from None


def send_photo(publication, token):
    response = requests.post(
        f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/{publication.facebook_page_id}/photos',
        headers={'Authorization': f'Bearer {token}'},
        data={'caption': publication.caption, 'published': 'true'},
        files={'source': ('campaign.jpg', base64.b64decode(publication.image_jpeg), 'image/jpeg')},
        timeout=30, allow_redirects=False)
    response.raise_for_status()
    data = response.json()
    if not 200 <= response.status_code < 300 or not isinstance(data, dict) or 'error' in data:
        raise ValueError('Invalid Facebook response')
    photo_id = data.get('id')
    if not isinstance(photo_id, str) or not re.fullmatch(r'[0-9]{1,64}', photo_id):
        raise ValueError('Invalid Facebook photo ID')
    post_id = data.get('post_id', '')
    if not isinstance(post_id, str) or not re.fullmatch(r'[0-9_]{1,140}', post_id):
        post_id = ''
    return photo_id, post_id


def result(publication, campaign=None):
    feedback = publication_feedback(publication, 'facebook', campaign)
    message = publication.message or 'Facebook está confirmando la publicación. No la reenvíes.'
    return Response(api_response(True, feedback['publication_notice'] or message, {
        **feedback, 'page_name': publication.page_name,
        'photo_id': publication.photo_id, 'post_id': publication.post_id,
        'publication_url': f'https://www.facebook.com/photo.php?fbid={publication.photo_id}'
            if feedback['status'] == 'published' else '',
    }), status=202 if feedback['status'] == 'publishing' else 200)


def owned_page(owner, value):
    if (isinstance(value, bool) or not isinstance(value, (int, str))
            or not str(value).isdigit() or len(str(value)) > 18):
        raise ValidationError('Selecciona una Página de Facebook válida.')
    return get_object_or_404(FacebookPage, pk=int(value), owner=owner)


class FacebookPublishView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        page = owned_page(request.user, request.query_params.get('page_id'))
        records = FacebookPublication.objects.filter(campaign=campaign, facebook_page_id=page.facebook_page_id)
        publication = existing_content(records, campaign, 'facebook', platform_copy(campaign, 'facebook'), jpeg_image)
        if publication:
            return result(publication, campaign)
        return Response(api_response(True, 'Todavía no se publicó este contenido en esta Página.',
            {'status': 'not_published', 'has_previous_publication': records.filter(status='published').exists()}))

    def post(self, request, campaign_id):
        if request.data.get('confirm') is not True:
            return Response(api_response(False, 'Confirma la publicación antes de enviarla.'), status=400)
        with transaction.atomic():
            campaign = get_object_or_404(Campaign.objects.select_for_update(), pk=campaign_id, marketero=request.user)
            page = owned_page(request.user, request.data.get('page_id'))
            if campaign.estado != 'aprobado' or 'facebook' not in (campaign.plataformas or [campaign.plataforma]):
                return Response(api_response(False, 'La campaña debe estar aprobada y tener Facebook seleccionado.'), status=400)
            version = request.data.get('version')
            if isinstance(version, bool) or not isinstance(version, int) or version != campaign.version:
                return Response(api_response(False, 'La campaña cambió. Recarga antes de publicar.'), status=409)
            existing = existing_content(FacebookPublication.objects.filter(campaign=campaign,
                facebook_page_id=page.facebook_page_id), campaign, 'facebook', platform_copy(campaign, 'facebook'), jpeg_image)
            if existing:
                return result(existing, campaign)
            if page.expires_at <= timezone.now():
                return Response(api_response(False, 'La autorización venció. Reconecta Facebook.'), status=400)
            if not configured():
                return Response(api_response(False, 'Falta configurar Facebook en el servidor.'), status=503)
            caption = platform_copy(campaign, 'facebook')
            if not caption.strip() or len(caption) > 60000:
                return Response(api_response(False, 'El texto debe tener entre 1 y 60000 caracteres para esta integración.'), status=400)
            try:
                jpeg = jpeg_image(campaign.imagen_b64)
            except ValueError as error:
                return Response(api_response(False, str(error)), status=400)
            try:
                token = cipher().decrypt(page.encrypted_token.encode()).decode()
            except (InvalidToken, ValueError, UnicodeError):
                return Response(api_response(False, 'Reconecta Facebook para renovar la credencial.'), status=400)
            # Commit the intent BEFORE the irreversible external request. A second
            # click/worker returns this record, even after a crash or disconnection.
            publication = FacebookPublication.objects.create(campaign=campaign, page=page,
                facebook_page_id=page.facebook_page_id, page_name=page.name,
                campaign_version=campaign.version, caption=caption, image_jpeg=jpeg)
        try:
            publication.photo_id, publication.post_id = send_photo(publication, token)
            publication.status = 'published'
            publication.message = 'Publicación enviada a Facebook con imagen y texto.'
        except (requests.RequestException, ValueError, KeyError, TypeError):
            # Never expose token-bearing upstream errors or repeat an uncertain POST.
            publication.status = 'uncertain'
            publication.message = 'Facebook no confirmó el resultado. Revisa tu Página y sus permisos; no reenviaremos para evitar duplicados.'
        publication.save(update_fields=['status', 'photo_id', 'post_id', 'message'])
        return result(publication)
