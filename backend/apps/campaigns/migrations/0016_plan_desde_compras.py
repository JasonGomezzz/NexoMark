"""
Asigna plan_key a cada usuario según su última compra simulada.

Equivalencias (6 nov 2026): Básico → freelance, Pro → agencia, Elite → agencia_plus.
Quien nunca compró se queda en freelance (default). No borra ni cambia compras:
CreditPurchase conserva el nombre, el monto y los créditos históricos. Tampoco
toca saldos: cada usuario conserva sus créditos actuales.
"""

from django.db import migrations

EQUIVALENCIAS = {
    "básico": "freelance",
    "basico": "freelance",
    "pro": "agencia",
    "elite": "agencia_plus",
    "freelance": "freelance",
    "agencia": "agencia",
    "agencia plus": "agencia_plus",
}


def asignar_planes(apps, schema_editor):
    User = apps.get_model("authentication", "User")
    CreditPurchase = apps.get_model("campaigns", "CreditPurchase")

    ultimas: dict[int, str] = {}
    for usuario_id, plan_nombre in CreditPurchase.objects.order_by("fecha_creacion", "id").values_list(
        "usuario_id", "plan_nombre"
    ):
        ultimas[usuario_id] = plan_nombre

    for usuario_id, plan_nombre in ultimas.items():
        plan_key = EQUIVALENCIAS.get((plan_nombre or "").strip().lower())
        if plan_key:
            User.objects.filter(pk=usuario_id).update(plan_key=plan_key)


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0009_planes_lanzamiento"),
        ("campaigns", "0015_planes_lanzamiento"),
    ]

    operations = [migrations.RunPython(asignar_planes, migrations.RunPython.noop)]
