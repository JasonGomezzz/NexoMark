"""Shared campaign creation rules for the classic form and reviewed briefs."""

from django.db import transaction
from rest_framework.exceptions import APIException

from apps.authentication.models import User
from .models import CampaignStatus


class InsufficientGenerationCredits(APIException):
    status_code = 402
    default_detail = "Se necesitan 4 créditos para texto e imagen estándar."


def create_campaign_draft(serializer, owner):
    """Validate the current balance under the owner lock."""
    with transaction.atomic():
        owner = User.objects.select_for_update().get(pk=owner.pk)
        if owner.tokens_disponibles < 4:
            raise InsufficientGenerationCredits()
        return serializer.save(estado=CampaignStatus.BORRADOR, marketero=owner)
