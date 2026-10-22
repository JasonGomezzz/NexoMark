"""Foto de perfil: se normaliza, solo la ve su dueño y nunca se guarda el archivo original."""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.authentication.models import FotoPerfil, User

pytestmark = pytest.mark.django_db
ME = "/api/auth/me/"
AVATAR = "/api/auth/me/avatar/"


def foto(fmt="PNG", size=(120, 90), color="teal"):
    salida = BytesIO()
    Image.new("RGB", size, color).save(salida, format=fmt)
    return SimpleUploadedFile("foto." + fmt.lower(), salida.getvalue(), content_type="image/" + fmt.lower())


@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
def test_subir_normaliza_a_jpeg_256_privado(api_client, user_marketero, fmt):
    response = api_client.patch(ME, {"nombre": "Nuevo nombre", "avatar": foto(fmt)}, format="multipart")
    assert response.status_code == 200
    usuario = response.data["data"]["user"]
    assert usuario["has_avatar"] is True
    assert isinstance(usuario["avatar_version"], int)
    assert usuario["nombre"] == "Nuevo nombre"
    assert "avatar" not in usuario

    resultado = api_client.get(AVATAR)
    assert resultado.status_code == 200
    assert resultado["Content-Type"] == "image/jpeg"
    assert resultado["Cache-Control"] == "private, no-store"
    assert resultado["X-Content-Type-Options"] == "nosniff"
    with Image.open(BytesIO(resultado.content)) as imagen:
        assert imagen.size == (256, 256)
        assert not imagen.getexif()

    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 0
    assert user_marketero.check_password("Test1234!")


def test_solo_la_propia_foto_y_quitarla(api_client, user_marketero, cliente):
    assert APIClient().get(AVATAR).status_code == 401
    assert api_client.get(AVATAR).status_code == 204
    assert api_client.patch(ME, {"avatar": foto()}, format="multipart").status_code == 200

    otro = APIClient()
    otro.force_authenticate(user=cliente)
    assert otro.get(AVATAR).status_code == 204
    assert otro.get(AVATAR, {"user_id": user_marketero.pk}).status_code == 204

    assert api_client.patch(ME, {"remove_avatar": True}, format="json").status_code == 200
    assert api_client.get(AVATAR).status_code == 204
    datos = api_client.get(ME).data["data"]["user"]
    assert datos["has_avatar"] is False
    assert datos["avatar_version"] is None


def test_reemplazar_cambia_la_version(api_client):
    api_client.patch(ME, {"avatar": foto(color="red")}, format="multipart")
    FotoPerfil.objects.update(actualizada_en=FotoPerfil.objects.get().actualizada_en.replace(year=2025))
    primera = api_client.get(ME).data["data"]["user"]
    segunda = api_client.patch(ME, {"avatar": foto(color="blue")}, format="multipart").data["data"]["user"]
    assert segunda["avatar_version"] != primera["avatar_version"]
    assert FotoPerfil.objects.count() == 1


@pytest.mark.parametrize("tipo", ["svg", "falsa", "pesada", "chica", "gif", "cortada", "pixeles"])
def test_imagenes_invalidas_no_guardan_nada(api_client, user_marketero, tipo):
    archivos = {
        "svg": lambda: SimpleUploadedFile("foto.svg", b'<svg onload="alert(1)"></svg>', content_type="image/svg+xml"),
        "falsa": lambda: SimpleUploadedFile("foto.jpg", b"no es una imagen", content_type="image/jpeg"),
        "pesada": lambda: SimpleUploadedFile("foto.png", b"x" * (2 * 1024 * 1024 + 1), content_type="image/png"),
        "chica": lambda: foto(size=(20, 20)),
        "gif": lambda: foto("GIF"),
        "cortada": lambda: SimpleUploadedFile("rota.png", foto().read()[:40], content_type="image/png"),
        "pixeles": lambda: foto(size=(4001, 4000)),
    }
    response = api_client.patch(ME, {"nombre": "No guardar", "avatar": archivos[tipo]()}, format="multipart")
    assert response.status_code == 400
    assert response.data["success"] is False
    user_marketero.refresh_from_db()
    assert not FotoPerfil.objects.exists()
    assert user_marketero.nombre == "Marketero Test"


def test_animada_o_subir_y_quitar_a_la_vez(api_client):
    stream = BytesIO()
    primera = Image.new("RGB", (100, 100), "red")
    primera.save(stream, format="PNG", save_all=True, append_images=[Image.new("RGB", (100, 100), "blue")])
    animada = SimpleUploadedFile("animada.png", stream.getvalue(), content_type="image/png")
    assert api_client.patch(ME, {"avatar": animada}, format="multipart").status_code == 400
    assert api_client.patch(ME, {"avatar": foto(), "remove_avatar": "true"}, format="multipart").status_code == 400
    assert not FotoPerfil.objects.exists()


def test_editar_nombre_no_toca_creditos(api_client, user_marketero):
    User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=4)
    assert api_client.patch(ME, {"nombre": "Nombre nuevo"}, format="json").status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.tokens_disponibles == 4
    assert user_marketero.nombre == "Nombre nuevo"


def test_me_informa_si_tiene_contrasena(api_client, user_marketero):
    assert api_client.get(ME).data["data"]["user"]["has_password"] is True
    user_marketero.set_unusable_password()
    user_marketero.save(update_fields=["password"])
    assert api_client.get(ME).data["data"]["user"]["has_password"] is False
