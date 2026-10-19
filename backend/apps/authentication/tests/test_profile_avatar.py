from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.exceptions import AuthenticationFailed
from apps.authentication.models import User
from apps.authentication.serializers import UpdateProfileSerializer

pytestmark = pytest.mark.django_db
ME = '/api/auth/me/'
AVATAR = '/api/auth/me/avatar/'


def photo(fmt='PNG', size=(120, 90), color='teal'):
    output = BytesIO()
    Image.new('RGB', size, color).save(output, format=fmt)
    return SimpleUploadedFile('photo.' + fmt.lower(), output.getvalue(), content_type='image/' + fmt.lower())


@pytest.mark.parametrize('fmt', ['PNG', 'JPEG', 'WEBP'])
def test_upload_normalizes_and_roundtrips_privately(api_client, user_marketero, fmt):
    response = api_client.patch(ME, {'nombre': 'Nuevo nombre', 'avatar': photo(fmt)}, format='multipart')
    assert response.status_code == 200
    assert response.data['data']['user']['has_avatar'] is True
    assert response.data['data']['user']['nombre'] == 'Nuevo nombre'
    assert 'avatar' not in response.data['data']['user']
    user_marketero.refresh_from_db()
    result = api_client.get(AVATAR)
    assert result.status_code == 200
    assert result['Content-Type'] == 'image/jpeg'
    assert result['Cache-Control'] == 'private, no-store'
    assert result['X-Content-Type-Options'] == 'nosniff'
    with Image.open(BytesIO(result.content)) as image:
        assert image.size == (256, 256)
        assert not image.getexif()
    assert user_marketero.token_version == 0
    assert user_marketero.check_password('Test1234!')


def test_own_photo_only_and_remove(api_client, user_marketero, cliente):
    assert APIClient().get(AVATAR).status_code == 401
    assert api_client.get(AVATAR).status_code == 204
    assert api_client.patch(ME, {'avatar': photo()}, format='multipart').status_code == 200
    user_marketero.refresh_from_db()
    other = APIClient()
    other.force_authenticate(user=cliente)
    assert other.get(AVATAR).status_code == 204
    assert other.get(AVATAR, {'user_id': user_marketero.pk}).status_code == 204
    assert api_client.patch(ME, {'remove_avatar': True}, format='json').status_code == 200
    user_marketero.refresh_from_db()
    assert api_client.get(AVATAR).status_code == 204
    assert api_client.get(ME).data['data']['user']['has_avatar'] is False


@pytest.mark.parametrize('kind', ['svg', 'fake', 'huge', 'tiny', 'gif', 'truncated', 'pixels'])
def test_invalid_images_never_save_name_or_photo(api_client, user_marketero, kind):
    uploads = {
        'svg': lambda: SimpleUploadedFile('photo.svg', b'<svg onload="alert(1)"></svg>', content_type='image/svg+xml'),
        'fake': lambda: SimpleUploadedFile('photo.jpg', b'not an image', content_type='image/jpeg'),
        'huge': lambda: SimpleUploadedFile('photo.png', b'x' * (2 * 1024 * 1024 + 1), content_type='image/png'),
        'tiny': lambda: photo(size=(20, 20)),
        'gif': lambda: photo('GIF'),
        'truncated': lambda: SimpleUploadedFile('broken.png', photo().read()[:40], content_type='image/png'),
        'pixels': lambda: photo(size=(4001, 4000)),
    }
    response = api_client.patch(ME, {'nombre': 'No guardar', 'avatar': uploads[kind]()}, format='multipart')
    assert response.status_code == 400
    user_marketero.refresh_from_db()
    assert not user_marketero.avatar
    assert user_marketero.nombre == 'Marketero Test'


def test_animation_and_conflicting_intent_rejected(api_client):
    stream = BytesIO()
    first = Image.new('RGB', (100, 100), 'red')
    first.save(stream, format='PNG', save_all=True, append_images=[Image.new('RGB', (100, 100), 'blue')])
    animated = SimpleUploadedFile('animated.png', stream.getvalue(), content_type='image/png')
    assert api_client.patch(ME, {'avatar': animated}, format='multipart').status_code == 400
    assert api_client.patch(ME, {'avatar': photo(), 'remove_avatar': 'true'}, format='multipart').status_code == 400


def test_partial_update_does_not_overwrite_security_fields(api_client, user_marketero):
    User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=4)
    assert api_client.patch(ME, {'nombre': 'Nombre nuevo'}, format='json').status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.tokens_disponibles == 4
    assert user_marketero.nombre == 'Nombre nuevo'


def test_stale_session_cannot_save_profile(user_marketero):
    serializer = UpdateProfileSerializer(user_marketero, data={'nombre': 'No guardar'}, partial=True)
    assert serializer.is_valid()
    User.objects.filter(pk=user_marketero.pk).update(token_version=1)
    with pytest.raises(AuthenticationFailed):
        serializer.save()
