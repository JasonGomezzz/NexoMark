# Requisitos de auditoría y revisión — Meta, TikTok, X y ANPD

Revisado el 16/10/2026 contra la documentación oficial enlazada en cada punto (las secciones 2,
5 y 6 se actualizaron el 22/10/2026). Las plataformas
cambian sus requisitos: volver a abrir la fuente antes de cada trámite. Este archivo no se publica
en Pages (el preparador solo copia HTML de la lista permitida).

Leyenda: `[x]` hecho y verificado · `[~]` hecho en parte o sin verificar · `[ ]` falta.

## 1. Meta (Instagram y Facebook)

**Estado de partida:** app «MarketMind Voice Demo» (`2618705085260343`) en **modo de desarrollo**,
con Facebook Login para empresas (configuración `967816649182342`, 7 permisos de
`META_OAUTH_SCOPES`). Primera publicación real hecha el 06/10 con el script de prueba en
`@nexomarkia`. Para la demo basta el **acceso estándar**: solo autorizan la app las personas con
rol en ella (administrador, desarrollador o tester). Pasar a Live solo hace falta para usuarios
sin rol.

### 1.1 Campos de la configuración básica para pasar a Live

Fuente: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings

| Requisito | Estado | Evidencia o lo que falta |
|---|---|---|
| Nombre visible | `[~]` | Existe; decidir si pasa a «NexoMark IA» |
| Correo de contacto | `[~]` | Usar `nexomarkia@gmail.com`; comprobar en el panel |
| URL de la política de privacidad | `[~]` | `privacidad.html` v0.13; en Pages sigue la v0.10 (borrador, estado del 16/10) |
| URL de los términos de servicio | `[~]` | `terminos.html` v0.13; mismo estado |
| Eliminación de datos (URL de instrucciones o callback) | `[~]` | `eliminacion-datos.html` nueva, sin publicar. No hay callback implementado |
| Icono de la app (sin logos ni la palabra Facebook/FB) | `[ ]` | Comprobar en el panel |
| Categoría y propósito de la app | `[ ]` | Comprobar en el panel |

### 1.2 Política de privacidad aceptable para Meta

Fuente: https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/

- `[x]` Propia del proyecto, identificada como política de privacidad, explica datos, usos,
  finalidades y cómo pedir la eliminación (`privacidad.html`, secciones 3, 5 y 11).
- `[ ]` URL activa, pública, sin bloqueo geográfico y accesible para el rastreador de Meta (200).
  La etiqueta `noindex` no impide el acceso, pero hay que comprobarlo con el Sharing Debugger
  (https://developers.facebook.com/tools/debug/) tras publicar.
- `[ ]` Publicar la versión aprobada sin avisos de borrador (Pages, sin `--allow-drafts`).

### 1.3 Eliminación de datos

Fuente: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

- `[x]` Página de instrucciones con pasos para quitar el acceso y para borrar la cuenta.
- `[ ]` Registrar su URL en «Eliminación de datos de usuarios» del panel.
- `[ ]` (Opcional) Callback HTTPS que devuelva `url` de estado y `confirmation_code`; hoy la
  eliminación es manual por correo.

### 1.4 App Review y acceso avanzado (solo si usuarios sin rol deben conectar)

Fuentes:
- https://developers.facebook.com/docs/development/build-and-test/app-modes
- https://developers.facebook.com/docs/graph-api/overview/access-levels
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review
- https://developers.facebook.com/docs/app-review/submission-guide
- https://developers.facebook.com/docs/instagram-platform/content-publishing

- `[ ]` Acceso avanzado por permiso, aprobado en App Review, para los 7 permisos.
- `[ ]` Un screencast por permiso (1080p o más, interfaz en inglés) que muestre la concesión y el uso.
- `[ ]` Descripción propia de cada permiso y del uso de los datos.
- `[ ]` Acceso de los revisores a la app (URL pública o instrucciones) y sus cuentas de prueba;
  nunca la cuenta personal.
- `[ ]` Al menos una llamada exitosa por permiso en los 30 días previos al envío.
- `[ ]` Cuestionario de tratamiento de datos.
- `[ ]` Revisar si hacen falta `ads_management` y `ads_read`: la guía de publicación los pide
  cuando el usuario tiene el rol de la página a través de Business Manager (la página de la demo
  está en un portafolio comercial).
- `[ ]` Tras la aprobación: revisión anual de uso de datos (Data Use Checkup).

### 1.5 Verificación del negocio

Fuente: https://developers.facebook.com/docs/development/release/business-verification

- `[ ]` Obligatoria para el acceso avanzado. No hace falta si solo usan la app personas con rol.
  Se hace en Business Manager por un administrador del portafolio; los documentos los lista el
  Centro de ayuda de Meta. Un proyecto académico sin empresa registrada puede no completarla:
  por eso la demo se queda en acceso estándar con testers.

### 1.6 Límites a tener presentes

- Instagram: 100 publicaciones por API en 24 horas (la misma guía dice 50 en la sección de
  carruseles; usar el menor como límite seguro). Solo JPEG.

## 2. TikTok (Content Posting API)

**Estado (22/10/2026):** conexión (Login Kit) y envío al buzón implementados en la rama local
`feat/app-flutter-y-cuentas` (`backend/apps/social/views_tiktok.py`, `services/tiktok_api.py`,
`services/tiktok_service.py`), en modo Sandbox, con los permisos `user.info.basic` y `video.upload`
y sin métricas. No probado con una cuenta real de TikTok (CLAUDE.md, 21/10). Los textos v0.13 lo
describen.

Fuentes:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content
- https://developers.tiktok.com/doc/content-sharing-guidelines
- https://developers.tiktok.com/doc/app-review-guidelines

- `[~]` App con el producto Content Posting API y el permiso aprobado: `video.publish` (Direct
  Post) o `video.upload` (envío como borrador a la bandeja, el usuario publica desde TikTok). El
  código usa solo `video.upload` en el Sandbox; `video.publish` no se pide.
- `[ ]` **Auditoría** para publicar en público. Sin auditoría todo queda en visibilidad privada
  (`SELF_ONLY`), con un máximo de 5 usuarios publicando en 24 horas, y sus cuentas deben ser
  privadas al publicar.
- `[ ]` Requisitos de interfaz de Direct Post: elegir la privacidad en un desplegable sin valor por
  defecto, consentimiento expreso antes de enviar el contenido, declaración de la Music Usage
  Confirmation, vista previa, apodo del creador, comentarios/Duet/Stitch desmarcados por defecto,
  divulgación de contenido comercial apagada por defecto y aviso de procesamiento.
- `[ ]` URLs de privacidad y términos vigentes y un sitio funcional para la revisión de la app
  (Pages solo aloja los documentos).
- `[ ]` Para `PULL_FROM_URL`, dominio verificado en TikTok. Mientras `TIKTOK_MEDIA_VERIFIED` sea
  `False` el servidor bloquea los envíos (`tiktok_api.medios_verificados`).
- `[~]` Actualizar `privacidad.html` y `terminos.html` antes de activarlo: hecho en la v0.13 (borrador
  sin aprobar ni publicar). Al cambiar el código de TikTok, volver a contrastar el texto.

## 3. X (API v2)

**Estado:** no implementado en `remejora`; fuera del alcance de CLAUDE.md (decisión de Jason).

Fuentes:
- https://docs.x.com/x-api/getting-started/pricing
- https://docs.x.com/developer-terms/agreement
- https://docs.x.com/developer-terms/policy

- `[ ]` Cuenta de desarrollador y **créditos prepagados** (pago por uso, sin suscripción): crear
  un post US$0,015; con URL US$0,200; leer un post US$0,005 por recurso; tope de 3 millones de
  lecturas por ciclo mensual. Las tarifas vigentes están en la Developer Console.
- `[ ]` Límite de gasto por ciclo configurado en la consola.
- `[ ]` Consentimiento expreso e informado del titular antes de publicar en su nombre; la
  política aclara que autenticarse no equivale a consentir. En NexoMark: red apagada por defecto
  y confirmación del marketero en cada publicación, además de la autorización del titular.
- `[ ]` Mostrar la política de privacidad antes del registro; borrar o modificar contenido de X
  guardado dentro de las 24 horas siguientes a que se borre o modifique en X.
- `[ ]` Cumplir las reglas de automatización (sin acciones masivas ni spam).
- `[ ]` Actualizar `privacidad.html` y `terminos.html` antes de activarlo.

## 4. Perú — Ley N.° 29733 y ANPD

Fuentes:
- Ley N.° 29733: https://leyes.congreso.gob.pe/Documentos/Leyes/29733.pdf
- Reglamento, D.S. N.° 016-2024-JUS: https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus
- Nota del MINJUSDH (30/11/2024): https://www.gob.pe/institucion/minjus/noticias/1067368-ejecutivo-aprueba-nuevo-reglamento-de-la-ley-de-proteccion-de-datos-personales
- Inscripción de bancos de datos: https://www.gob.pe/8060-inscribir-banco-de-datos-en-el-registro-nacional-de-proteccion-de-datos-personales
- Formulario de tutela ante la ANPD: https://www.gob.pe/institucion/anpd/informes-publicaciones/1254946-formulario-para-iniciar-procedimiento-para-el-ejercicio-de-los-derechos-arco-anpd

- `[x]` Política con responsables, datos, finalidades, base legal, destinatarios, transferencia
  internacional (art. 15), conservación, derechos y tutela ante la ANPD (art. 24).
- `[ ]` Evaluar la inscripción del banco de datos de usuarios en el Registro Nacional de
  Protección de Datos Personales: gob.pe indica que todo titular de un banco de datos debe
  inscribirlo; el trámite es virtual (SIPDP), gratuito y de aprobación automática desde el
  31/03/2025. Consultar con el asesor de tesis si aplica a un proyecto académico.
- `[ ]` Confirmar en el texto oficial del Reglamento los plazos de respuesta a los derechos ARCO
  (el formulario de la ANPD remite al art. 69) antes de fijar un plazo interno en la política.
  No se pudo extraer el texto del PDF oficial en esta revisión.
- `[ ]` Confirmar si el Reglamento exige comunicar a la ANPD los flujos transfronterizos.
- `[ ]` Procedimiento ante incidentes: el MINJUSDH indica comunicarlos en 48 horas en principio.
- `[ ]` Registro privado de solicitudes ARCO y prueba del borrado manual de una cuenta.

## 5. Google (acceso con Google)

**Estado (22/10/2026):** `backend/apps/authentication/google_login.py` verifica el ID token en el
servidor y guarda solo `google_subject`. Sin probar con cuentas reales de Google (CLAUDE.md, 21/10).

Fuente: https://support.google.com/cloud/answer/13806988?hl=en (política de privacidad de la app,
consultada el 22/10/2026)

- `[~]` La política debe ser una página HTML propia, distinta de la página de inicio, enlazada desde
  la pantalla de consentimiento y visible dentro de la app, y debe explicar qué datos de Google se
  tratan, cómo se usan, se guardan y se comparten, cómo se protegen y cómo se conservan y eliminan.
  Cubierto en `privacidad.html` (secciones 3, 6, 9 y 10) y `eliminacion-datos.html` (sección 2); falta
  aprobarlo y publicarlo.
- `[ ]` Google pide que esté en un dominio propio o verificado, preferiblemente el de la página de
  inicio de la app. Comprobar si el dominio de Pages sirve.
- `[ ]` Client ID web (`GOOGLE_CLIENT_ID`), de Android (paquete `com.marketmind.nexomark` y SHA-1) y
  de iOS (`GOOGLE_IOS_CLIENT_ID` y el esquema invertido en `Info.plist`), según
  `mobile_flutter/README.md`. Pendientes de Piero (CLAUDE.md).
- `[ ]` Revisar en Google Cloud (pantalla de consentimiento y Verification Center) si hace falta
  verificar la marca de la app. No se pudo confirmar en esta revisión.

## 6. Otros pendientes que afectan a los textos

- `[ ]` Modalidad de facturación de la clave de Gemini: en los servicios gratuitos Google puede
  usar el contenido para mejorar productos y revisarlo con personas
  (https://ai.google.dev/gemini-api/terms). La política lo advierte como pendiente.
- `[ ]` Región de Render y Neon (paneles de cada servicio).
- `[ ]` Aprobación del texto por ambos responsables y fecha de vigencia.
