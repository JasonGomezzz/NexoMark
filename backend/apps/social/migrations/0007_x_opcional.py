"""
X opcional: conexión OAuth 2.0 con PKCE, variante para X aprobada por el
cliente, resultado incierto en la publicación y gasto mensual estimado.

Solo agrega tablas y columnas con valor por defecto; los AlterField cambian
textos de ayuda y opciones (sin cambio de esquema en PostgreSQL). Spring no
mapea las columnas nuevas, así que su validación (ddl-auto=validate) no cambia.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0013_campaign_intent'),
        ('social', '0006_publicacion_publicando_desde'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='GastoMensualX',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mes', models.DateField(help_text='Primer día del mes.', unique=True)),
                ('publicaciones', models.PositiveIntegerField(default=0, help_text='Intentos de publicación que llamaron a X.')),
                ('lecturas', models.PositiveIntegerField(default=0, help_text='Lecturas de usuario (users/me al conectar).')),
                ('gasto_milesimas', models.PositiveIntegerField(default=0, help_text='Gasto estimado en milésimas de dólar (15 = US$0.015): entero para que el tope sea exacto.')),
                ('fecha_actualizacion', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'social_gasto_mensual_x',
                'ordering': ['-mes'],
            },
        ),
        migrations.AddField(
            model_name='oauthautorizacion',
            name='code_verifier_cifrado',
            field=models.TextField(blank=True, default='', help_text='Solo X (PKCE): code_verifier cifrado. Se borra al reclamar el state.'),
        ),
        migrations.AddField(
            model_name='publication',
            name='resultado_incierto',
            field=models.BooleanField(default=False, help_text='Solo X: el último intento se envió pero X no confirmó el resultado. No se reintenta hasta que el marketero revise la cuenta y lo confirme.'),
        ),
        migrations.AddField(
            model_name='socialconnection',
            name='refresh_token_cifrado',
            field=models.TextField(blank=True, default='', help_text='Solo X: refresh token cifrado (offline.access). X lo rota en cada renovación.'),
        ),
        migrations.AlterField(
            model_name='oauthautorizacion',
            name='proveedor',
            field=models.CharField(choices=[('meta', 'Meta (Facebook e Instagram)'), ('x', 'X')], default='meta', max_length=20),
        ),
        migrations.AlterField(
            model_name='oauthautorizacion',
            name='redirect_uri',
            field=models.CharField(help_text='redirect_uri enviado al proveedor; el canje del código debe usar exactamente el mismo.', max_length=500),
        ),
        migrations.AlterField(
            model_name='publication',
            name='red',
            field=models.CharField(choices=[('instagram', 'Instagram'), ('facebook', 'Facebook'), ('x', 'X')], max_length=20),
        ),
        migrations.AlterField(
            model_name='socialconnection',
            name='cuenta_id',
            field=models.CharField(help_text='ID en Meta (página de Facebook o cuenta de Instagram profesional) o ID de usuario en X.', max_length=64),
        ),
        migrations.AlterField(
            model_name='socialconnection',
            name='pagina_id',
            field=models.CharField(help_text='Página de Facebook a la que pertenece el token (la misma en Instagram vinculado). Vacío en X.', max_length=64),
        ),
        migrations.AlterField(
            model_name='socialconnection',
            name='red',
            field=models.CharField(choices=[('instagram', 'Instagram'), ('facebook', 'Facebook'), ('x', 'X')], max_length=20),
        ),
        migrations.AlterField(
            model_name='socialconnection',
            name='token_cifrado',
            field=models.TextField(blank=True, default='', help_text='Token de página (Meta) o de acceso (X) cifrado. Nunca se expone.'),
        ),
        migrations.AlterField(
            model_name='socialconnection',
            name='token_expira_at',
            field=models.DateTimeField(blank=True, help_text='Null: el token de página no informa vencimiento. En X el token de acceso dura 2 horas.', null=True),
        ),
        migrations.CreateModel(
            name='VarianteX',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version_origen', models.IntegerField(help_text='Campaign.version al crear la variante (auditoría).')),
                ('hash_origen', models.CharField(help_text='sha256 del texto_generado + imagen_b64 aprobados de la campaña al crear la variante.', max_length=64)),
                ('texto', models.TextField()),
                ('generada_por_ia', models.BooleanField(default=False, help_text='False: escrita a mano o resumen recortado.')),
                ('estado', models.CharField(choices=[('borrador', 'Borrador'), ('pendiente_cliente', 'Esperando al cliente'), ('aprobada', 'Aprobada'), ('rechazada', 'Rechazada')], db_index=True, default='borrador', max_length=20)),
                ('hash_aprobado', models.CharField(blank=True, default='', help_text='sha256 del texto que aprobó el cliente. Vacío si no está aprobada.', max_length=64)),
                ('feedback_cliente', models.TextField(blank=True, default='')),
                ('enviada_at', models.DateTimeField(blank=True, null=True)),
                ('aprobada_at', models.DateTimeField(blank=True, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_actualizacion', models.DateTimeField(auto_now=True)),
                ('aprobada_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='variantes_x_aprobadas', to=settings.AUTH_USER_MODEL)),
                ('campaign', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='variantes_x', to='campaigns.campaign')),
                ('creada_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='variantes_x_creadas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'social_variantes_x',
                'ordering': ['-fecha_creacion'],
            },
        ),
        migrations.AddConstraint(
            model_name='variantex',
            constraint=models.UniqueConstraint(fields=('campaign',), name='uniq_variante_x_campana'),
        ),
    ]
