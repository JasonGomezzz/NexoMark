from django.conf import settings
from django.db import migrations


def populate(apps, schema_editor):
    Campaign = apps.get_model('campaigns', 'Campaign')
    Relation = apps.get_model('campaigns', 'ClientRelationship')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    alias = schema_editor.connection.alias
    for owner, email in Campaign.objects.using(alias).values_list('marketero_id', 'cliente_email').distinct().iterator():
        client = User.objects.using(alias).filter(email__iexact=email, rol='cliente').first()
        if client:
            Relation.objects.using(alias).get_or_create(marketero_id=owner, cliente_id=client.pk)


class Migration(migrations.Migration):
    dependencies = [('campaigns', '0026_client_relationship')]
    operations = [migrations.RunPython(populate, migrations.RunPython.noop)]
