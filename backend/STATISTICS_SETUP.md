# Estadísticas de publicaciones — implementación local, 12 de octubre de 2026

Referencia: asesoría de Google Drive del 29 de septiembre, transcripción 4:17–9:38
y fotogramas revisados directamente en 7:48 y 8:52. Dos columnas por plataforma,
totales arriba, gráficos mensuales debajo; detalle por publicación dentro de campaña.
Tras aclaraciones visuales del usuario: dos gráficos de barras lado a lado por plataforma,
meses Ene–Dic en el eje, sin selector de mes. Actualización del 12 de octubre:
el año seleccionado filtra las gráficas y los totales superiores de publicaciones e
interacciones. El historial detallado conserva todos los años y revisiones. Comentarios
se retiraron de las tarjetas y del historial visible de todas las redes, sin borrar snapshots.
La semántica de las mediciones sigue limitada
como se explica debajo, sin usar cifras simuladas del esquema como datos reales.

## Implementado

- Dashboard y detalle de campaña de marketero: bloques Facebook, Instagram, X y TikTok.
  Google Ads se retiró del alcance el 18 de octubre de 2026: no aparece en estadísticas ni como canal nuevo.
- Cuentan publicaciones `published` y posts TikTok existentes vinculados expresamente
  por el propietario tras validación Display API, incluyendo versiones anteriores. Envíos
  pendientes sin vinculación se muestran aparte. No se infiere publicación por similitud.
- Gráfico de publicaciones por mes/año, según fecha local de registro del envío confirmado
  (TikTok usa fecha de confirmación cuando existe). No se afirma fecha exacta de publicación remota.
- Últimos contadores acumulados por publicación, cobertura y fecha de medición. Ausencia es null,
  no cero. En Facebook me gusta filtra LIKE, no el total de todas las reacciones.
- Consulta explícita de Meta y X por propietario y publicación confirmada, GET con token cifrado
  descifrado solo en servidor y enviado por cabecera; sin redirecciones ni publicación.
- Una medición por día y publicación, actualizable; mínimo cinco minutos entre mediciones exitosas.
  Se conservan datos anteriores ante fallos. Reconexion: solo cuenta con mismo propietario y
  mismo identificador inmutable, sin alterar la FK histórica ni usar cuentas de otro usuario.
- X consulta exclusivamente el post guardado, valida ID y autor. Likes, respuestas, reposts
  (sin sumar citas) e impresiones: estas últimas no equivalen a reproducciones de video.
  Presupuesto persistente por propietario (`XMetricReadBudget`), sin concesión vía API cliente.
  Se reserva un intento ANTES de la llamada pagada en una transacción independiente; también
  cuentan errores/timeout. Sin compra, recarga, timelines ni reintentos automáticos.
- TikTok consulta Display API solo con `video.list` y IDs públicos procedentes del estado
  autenticado del envío o webhook firmado. Conserva varios IDs si el usuario creó varios
  posts desde un mismo borrador; suma contadores solo si todos los IDs se devuelven.
  Los totales/coverage cuentan esos posts, no duplican mediciones del mismo envío.
  La foto concreta de prueba fue leída realmente (2 likes, 0 compartidos, 304 vistas),
  sin generalizar compatibilidad a todos los posts. No inferir ID ni estado por similitud.
- Vinculación TikTok en el diálogo de campaña: URL pública o ID → Verificar publicación
  (sin escribir) → comprobar cuenta/post/contadores → confirmar asociación. El servidor
  vuelve a verificar propiedad y guarda `TikTokPublicationLink` con autor y fecha; no
  sustituye status/publish_id/public_post_ids del envío ni fabrica un webhook. ID único
  y un vínculo por envío evitan dobles asociaciones; no se reemplazan vínculos existentes.
  Historial y estadísticas distinguen user_confirmed_display_api de confirmación de envío.
  Si TikTok entrega después el mismo ID por webhook, no se cuenta dos veces. Se usa la
  fecha de creación del post de la API si existe. Sin contadores válidos, no se vincula.
- Me gusta por mes: suma de los últimos contadores acumulados de las publicaciones
  registradas en cada mes. Funciona desde la primera medición, sin exigir dos meses.
  No representa el mes en que ocurrió cada like: una publicación de enero puede acumular
  nuevos likes posteriormente. Se informa cobertura por mes y no se inventan ceros
  donde faltan mediciones. Los totales superiores suman los últimos contadores de las
  publicaciones registradas en el año seleccionado, incluyendo revisiones anteriores.
  NO son interacciones recibidas durante ese año: los contadores son acumulados de por vida.
- Admin lee agregados; no consulta con credenciales ajenas. API cliente no habilitada;
  el frontend cliente/Spring y móvil necesitan integración posterior con autorización propia.

## Rutas (API principal autenticada, NO bridge público)

- GET `/api/campaigns/publication-statistics/?year=2026`
- GET `/api/campaigns/7/publication-statistics/?year=2026`
- POST `/api/campaigns/7/publication-statistics/refresh/`
  JSON `platform` facebook/instagram/twitter/tiktok y `publication_id` local del historial propio.
  Nunca aceptar IDs remotos arbitrarios ni texto/token del navegador.
- POST `/api/campaigns/7/link-tiktok-publication/`: upload_id local, version actual,
  publication (ID o URL TikTok canónica), confirm boolean. Solo propietario marketero,
  solo envío previo de su campaña/cuenta; false verifica, true vincula. Esta ruta NO
  está expuesta en el bridge público. Nunca se usa la URL recibida como destino HTTP.

## Ejecutar y verificar

Desde raíz: `./scripts/backup-postgres.ps1` antes de migrar.
Desde backend: `./venv/Scripts/python.exe manage.py migrate campaigns`
(`0021_publication_metric_snapshot`, `0022_tiktokupload_public_post_ids_xmetricreadbudget`
y `0023_tiktokpublicationlink`), luego servidor normal
`./venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000`.
Desde frontend: `npm run dev`, abrir localhost:5173/dashboard.
Pruebas: backend `./venv/Scripts/python.exe -m pytest -q`;
frontend `node --test tests/*.test.mjs`, `npm run lint`, `npm run build`.
No se añade scheduler ni sondeo de métricas: usar Consultar métricas tras recibir interacciones.

## Pendiente y resultados reales

La campaña de prueba tiene publicaciones confirmadas en Facebook, Instagram y X;
el envío TikTok sigue inbox. No se republicó ni se cambió contenido/estado de campaña.
La publicación Instagram quedó sin FK de cuenta tras reconectar, pero existe conexión
autorizada coincidente: el lector reconoce esa conexión. Tras confirmar la cuenta de
desarrollador, Instagram permite consultar contadores y guardar una medición real.
Facebook sigue rechazando la lectura con error10, solicitando pages_read_user_content
o Page Public Content Access. No afirmar que todas las plataformas funcionan por mocks.
Revisar permisos/configuración de Meta y probar hasta obtener los contadores restantes.
La solicitud OAuth adicional está preparada mediante flags opt-in; no se ampliaron los
permisos en portales ni se reconectaron las cuentas automáticamente.

### Completar Facebook

1. En Meta, caso de uso administrar Páginas → permisos, añadir `pages_read_user_content`.
   Si se usa `FACEBOOK_LOGIN_CONFIG_ID`, añadirlo también a esa configuración de inicio
   de sesión empresarial (config_id es autoritativo, no se combina con scope en URL).
2. Tras aprobación del permiso para la prueba, configurar en el .env privado
   `FACEBOOK_METRICS_PERMISSIONS=true`; reiniciar Django principal y bridge.
3. El propietario reconecta Facebook y autoriza la misma Página; no desconectar/borrar
   historia ni volver a publicar. Consultar métricas desde dashboard o campaña.
4. Verificar una respuesta real y el contador almacenado. Un permiso en el portal no
   equivale a un permiso concedido al token anterior. Producción puede exigir revisión.

La reconexión de prueba del 12 de octubre llegó al backend pero falló en etapa expiry;
no se registró ninguna Página ni snapshot Facebook. Se reforzó la validación: si el
intercambio omite expires_in, consultar debug_token de ese token, validar is_valid,
app_id y user_id, y usar el menor vencimiento finito de token/acceso a datos. Si no
hay una fecha verificable, se rechaza la conexión; no inventar 60 días ni aceptar
token de otro usuario/app. Un expires_in explícito inválido no se sustituye por defecto.
Este ajuste está probado con mocks; requiere nueva autorización del usuario para
comprobar la respuesta real. El código OAuth anterior ya está consumido y no se reutiliza.

### Completar TikTok

1. En el MISMO Sandbox de Login Kit/Content Posting, ir a Scopes → Add scopes y añadir
   `video.list`; Apply changes. Portal verificado el 12 de octubre: Display API NO
   aparece como producto en Add products; no añadir Share Kit ni Data Portability.
2. Configurar `TIKTOK_METRICS_PERMISSIONS=true` en .env privado, reiniciar Django/bridge
   y reconectar la misma cuenta autorizando lectura. Los tokens antiguos de upload
   siguen siendo válidos para su función; no se exige video.list para refrescarlos.
3. Consultar el estado del envío original. Un publicado sin ID se puede volver a consultar
   para recuperar IDs públicos; no se degrada un estado ya confirmado ni se reenvía.
4. Si continúa inbox o no devuelve ID, las métricas siguen pendientes. Si video/query
   no devuelve la foto, no inventar ceros ni afirmar soporte de fotos: resolver con TikTok
   o acordar otro contenido de prueba por separado. No publicar un video nuevo sin permiso.

Actualización: si ya existe el post final, el propietario puede vincularlo desde el
diálogo de la campaña usando la verificación y confirmación descritas arriba. La lectura
real del ID de la foto de prueba sí devuelve contadores; su envío original sigue inbox.
La vinculación no afirma que Content Posting confirmó ese envío. Se detiene el sondeo
automático del envío vinculado, pero la consulta manual de estado sigue disponible.

### Presupuesto X de esta prueba

El usuario autorizó hasta US$0.10 de saldo existente. Se creó SOLO en la base local
un allowance de 20 intentos para el propietario de la campaña 7, estimando US$0.005
por lookup de un post, según documentación oficial consultada el 12 de octubre.
Se realizó UNA lectura real exitosa: 2 likes, 0 respuestas, 0 reposts, 10 impresiones.
19 intentos restantes; no se otorgan allowances por defecto al migrar, reconectar,
reiniciar ni desde formularios. No resetear `requests_reserved` al agotar presupuesto.
El allowance es control local de llamadas, NO factura ni límite financiero impuesto
en X; las tarifas pueden cambiar. Revisar la tarifa del endpoint antes de otra sesión
de pruebas y reconciliar consumo tras restaurar una base antigua. Para renovar límite
o modificar tarifa, pedir autorización al usuario. No contar con deduplicación gratuita.

Fuentes oficiales: [X pricing](https://docs.x.com/x-api/getting-started/pricing),
[TikTok Query Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query),
[TikTok Get Post Status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status).

Vistas y compartidos de Instagram necesitan Insights adicional. X está probado realmente.
TikTok: permiso video.list concedido y foto de café vinculada mediante la interfaz,
tras confirmación expresa del propietario y validación de la API. La medición guardada
en esa prueba final mostró 2 likes, 0 compartidos y 310 vistas; dashboard confirmó
1 publicación y likes octubre=2. El envío original sigue inbox, sin receipt de publicación;
el vínculo se identifica como user_confirmed_display_api, no como webhook recibido.
Google Ads se descartó del proyecto por decisión del usuario. Pantallas cliente,
móvil y mediciones programadas pendientes. No habilitar permisos Insights ni revisión de apps
sin revisar requisitos oficiales y autorización del usuario.

Los documentos legales públicos siguen siendo borradores: revisar su coherencia antes de
publicar la funcionalidad. Obsidian/backups/.env y el allowance local no se suben al repo.
Facebook likes, Instagram likes, X y esta publicación TikTok tienen mediciones reales.
Todavía no afirmar que TODOS los contadores de TODAS las plataformas están completos:
faltan Insights IG, vistas/compartidos Facebook cuando el proveedor no los devuelva,
pantallas cliente/móvil y actualización programada. Google Ads no forma parte del alcance;
sus identificadores históricos se conservan sin habilitar nuevas selecciones ni preparar anuncios.
