"""Planes de lanzamiento: el perfil expone el costo y el reset vuelve a la cuota del plan."""

import pytest

from apps.authentication.models import User


@pytest.mark.django_db
class TestPerfilConCreditos:
    def test_me_trae_costo_y_generaciones(self, api_client, user_marketero):
        response = api_client.get("/api/auth/me/")
        assert response.status_code == 200
        body = response.data["data"]
        user = body.get("user", body)
        assert user["costo_generacion"] == 4
        assert user["generaciones_disponibles"] == user["tokens_disponibles"] // 4
        assert user["plan_key"] == "freelance"


@pytest.mark.django_db
class TestResetSegunPlan:
    @pytest.mark.parametrize(("plan_key", "cuota"), [("freelance", 100), ("agencia", 400), ("agencia_plus", 1000)])
    def test_reset_vuelve_a_la_cuota_del_plan(self, superadmin_client, user_marketero, plan_key, cuota):
        User.objects.filter(pk=user_marketero.pk).update(plan_key=plan_key, tokens_disponibles=3)
        response = superadmin_client.patch(f"/api/admin/users/{user_marketero.pk}/reset-quota/")
        assert response.status_code == 200
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == cuota
        assert str(cuota) in response.data["message"]
