"""Shared campaign creation rules for the classic form and reviewed briefs."""

from django.db import transaction
from rest_framework.exceptions import APIException

from apps.authentication.models import User
from .client_accounts import check_client_slot
from .models import CampaignStatus, ClientRelationship


class InsufficientGenerationCredits(APIException):
    status_code = 402
    default_detail = "Se necesitan 4 créditos para texto e imagen estándar."


def create_campaign_draft(serializer, owner):
    """Validate the current balance and client quota under the same owner lock."""
    with transaction.atomic():
        owner = User.objects.select_for_update().get(pk=owner.pk)
        if owner.tokens_disponibles < 4:
            raise InsufficientGenerationCredits()
        client = User.objects.get(
            email__iexact=serializer.validated_data["cliente_email"], rol="cliente",
        )
        relation = check_client_slot(owner, client.pk)
        if not relation:
            ClientRelationship.objects.create(marketero=owner, cliente=client)
        return serializer.save(estado=CampaignStatus.BORRADOR, marketero=owner)
