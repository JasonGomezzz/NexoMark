"""Destination/content protection across campaign revisions; never sends content."""
import re
from urllib.parse import urlsplit
from .models import PublicationAvailability

PENDING = {'preparing', 'publishing', 'sending', 'processing', 'inbox', 'uncertain'}
MISSING = {'unavailable', 'removed'}


def instagram_permalink(value):
    if not isinstance(value, str):
        return ''
    try:
        url = urlsplit(value)
        if (url.scheme == 'https' and url.netloc in ('www.instagram.com', 'instagram.com')
                and re.fullmatch(r'/(p|reel|tv)/[A-Za-z0-9_-]+/?', url.path)):
            return f'https://www.instagram.com{url.path}'
    except ValueError:
        pass
    return ''


def existing_content(records, campaign, platform, caption, prepare_image):
    records = list(records.order_by('-created_at', '-pk'))
    if not records:
        return None
    completed = [p for p in records if p.status == 'published' or
                 platform == 'tiktok' and getattr(p, 'publication_link', None)]
    matching = []
    if any(p.caption == caption for p in completed):
        try:
            image = prepare_image(campaign.imagen_b64)
        except (ValueError, TypeError):
            image = None
        matching = [p for p in completed if image is not None and p.caption == caption and p.image_jpeg == image]
    if matching:
        missing = set(PublicationAvailability.objects.filter(platform=platform,
            publication_id__in=[p.pk for p in matching], state__in=MISSING).values_list('publication_id', flat=True))
        # A newer duplicate may have been removed while the original is still live.
        return next((p for p in matching if p.pk not in missing), matching[0])
    pending = next((p for p in records if p.status in PENDING and not
                    (platform == 'tiktok' and getattr(p, 'publication_link', None))), None)
    if pending:
        return pending
    # Same-version idempotency is retained even if saved content is inconsistent.
    return next((p for p in records if p.campaign_version == campaign.version), None)


def publication_feedback(publication, platform, campaign=None):
    campaign = campaign or publication.campaign
    check = PublicationAvailability.objects.filter(platform=platform, publication_id=publication.pk).first()
    previous = publication.campaign_version != campaign.version
    status = publication.status
    message = ''
    if check and check.state in MISSING:
        status = check.state
        message = check.note or 'La publicación no está disponible. Se conserva el historial; no se reenviará automáticamente.'
    elif previous and status in PENDING and not (platform == 'tiktok' and getattr(publication, 'publication_link', None)):
        status = 'pending_previous'
        message = 'Hay un envío de una versión anterior sin resolver en este destino. Compruébalo antes de crear otro; no se reenviará.'
    elif previous and (status == 'published' or platform == 'tiktok' and getattr(publication, 'publication_link', None)):
        message = f'Este mismo texto e imagen ya se publicaron o vincularon en este destino en la versión {publication.campaign_version}. No se creará un duplicado.'
    return {'status': status, 'publication_id': publication.pk,
            'publication_version': publication.campaign_version,
            'previous_version': previous, 'availability': check.state if check else 'unknown',
            'availability_note': check.note if check else '', 'publication_notice': message}
