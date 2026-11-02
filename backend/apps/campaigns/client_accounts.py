"""Owner-scoped client relationships; account access is never changed here."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.authentication.models import User
from .models import ClientRelationship


def check_client_slot(owner, client_id, activate=True):
    relation = ClientRelationship.objects.filter(marketero=owner, cliente_id=client_id).first()
    if relation and not relation.is_active and activate:
        raise serializers.ValidationError('Reactiva este cliente desde Clientes antes de crear una campaña.')
    if activate and (not relation or not relation.is_active):
        if owner.plan_key == 'basico' and ClientRelationship.objects.filter(marketero=owner, is_active=True).count() >= 5:
            raise serializers.ValidationError('Freelance permite hasta 5 clientes activos. Desactiva uno para liberar un cupo.')
    return relation


class ClientRelationshipsView(APIView):
    def owner(self, request):
        if request.user.rol != 'marketero':
            raise PermissionDenied('Solo el marketero administra sus clientes.')
        return request.user

    def get(self, request):
        owner = self.owner(request)
        rows = ClientRelationship.objects.filter(marketero=owner).select_related('cliente').order_by('cliente__nombre', 'id')
        return Response({'clients': [{'id': r.id, 'nombre': r.cliente.nombre, 'email': r.cliente.email, 'active': r.is_active} for r in rows],
                         'active_count': rows.filter(is_active=True).count(), 'limit': 5 if owner.plan_key == 'basico' else None})

    def post(self, request):
        self.owner(request)
        email = serializers.EmailField().run_validation(request.data.get('email'))
        client = get_object_or_404(User, email__iexact=email, rol='cliente', is_active=True)
        with transaction.atomic():
            owner = User.objects.select_for_update().get(pk=request.user.pk)
            relation = check_client_slot(owner, client.pk)
            if not relation:
                relation = ClientRelationship.objects.create(marketero=owner, cliente=client)
        return Response({'id': relation.id}, status=201)

    def patch(self, request, pk):
        self.owner(request)
        active = request.data.get('active')
        if type(active) is not bool:
            raise serializers.ValidationError('Indica active como verdadero o falso.')
        with transaction.atomic():
            owner = User.objects.select_for_update().get(pk=request.user.pk)
            relation = get_object_or_404(ClientRelationship, pk=pk, marketero=owner)
            if active and not relation.is_active:
                # Explicit reactivation is allowed after checking the same quota.
                if owner.plan_key == 'basico' and ClientRelationship.objects.filter(marketero=owner, is_active=True).count() >= 5:
                    raise serializers.ValidationError('No hay cupos disponibles en Freelance.')
            relation.is_active = active
            relation.save(update_fields=['is_active'])
        return Response({'active': relation.is_active})
