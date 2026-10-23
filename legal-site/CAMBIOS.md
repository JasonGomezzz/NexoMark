# Historial de documentos — NexoMark

## Borrador v0.13 — 22 de octubre de 2026

- Conservada la v0.12 de privacidad y términos en `historial/` (a pedido; hasta ahora solo estaba la
  v0.10, la única publicada, y la v0.11 no se conservó). La eliminación de datos v0.11 no se copia:
  el preparador de Pages solo admite privacidad y términos en `historial/`.
- Texto contrastado con el código de la rama local `feat/app-flutter-y-cuentas` (commit `037df998`,
  21/10), no con lo que dicen los avances:
  - Google (`backend/apps/authentication/google_login.py`): se guarda solo `google_subject`; con
    registro, el correo verificado y el nombre del ID token; sin tokens de Google ni foto de Google.
    El ID token se verifica en el servidor (RS256, audiencia, emisor, correo verificado, nonce).
    Intento de acceso de 10 minutos con huellas SHA-256. Desvincular exige la contraseña de NexoMark
    y cierra las sesiones. Registro solo con Gmail o Google Workspace.
  - Foto de perfil (`profile_avatar.py`): JPG, PNG o WebP de hasta 2 MB, 64 px mínimo, 16 MP máximo,
    sin animación; se guarda solo un JPEG 256×256 sin EXIF; la sirve únicamente `/api/auth/me/avatar/`
    a su dueño. Los administradores ven el indicador `has_avatar`, no la imagen.
  - Cambio de correo (`email_change.py`): contraseña actual, un enlace a cada correo, vigencia de 30
    minutos, solo SHA-256 de los tokens, cierra todas las sesiones al completarse. Una solicitud
    vencida no se borra sola (se describe así en conservación).
  - TikTok (`views_tiktok.py`, `tiktok_api.py`, `tiktok_service.py`): permisos `user.info.basic` y
    `video.upload`; se guardan `open_id`, nombre visible, tokens cifrados, vencimientos y permisos.
    Envía una foto con el texto aprobado (≤ 4000 UTF-16) en `MEDIA_UPLOAD` con `is_aigc=true`; TikTok
    descarga la imagen de un enlace firmado de 1 h. Solo estado del envío (≤ 1 consulta/30 s), sin
    métricas. Modo Sandbox. Desconectar (`SocialConnectionViewSet.destroy`) borra solo
    `token_cifrado`, marca `desconectada` y no revoca nada en TikTok; el token de renovación y los
    datos de la conexión se quedan. El texto lo dice tal cual.
  - App Flutter (`mobile_flutter/`): tokens en Keychain/Keystore (`flutter_secure_storage`), tema en
    `shared_preferences`, permisos de micrófono, reconocimiento de voz, cámara y fotos en `Info.plist`.
  - Dictado en iPhone (`dictation.dart`, `AppDelegate.swift`): con español sin conexión se pide
    `onDevice` (el plugin `speech_to_text` 7.5.0 lo traduce a `requiresOnDeviceRecognition`); si no,
    la documentación de Apple dice que es un servicio de red. Se enlazan la documentación de Apple y
    su política de privacidad.
  - Tipografía: la web (`frontend/index.html`) y la app Flutter (`allowRuntimeFetching = true`, sin
    fuente empaquetada) descargan Inter de los servidores de Google. No figuraba en la v0.12; se
    añade a datos técnicos y a proveedores.
- Privacidad: nuevos apartados de datos (Google, foto, cambio de correo), fila de TikTok y de Google
  en proveedores, iOS en el dictado, TikTok en la sección 8, conservación y seguridad ampliadas.
- Términos: Google, TikTok (Sandbox, borrador al buzón, sin métricas, desconexión sin revocar),
  marca de contenido generado con IA y condiciones de TikTok.
- Eliminación de datos: nuevas secciones para quitar solo Google, la foto o un cambio de correo, y
  TikTok en acceso, datos eliminados y datos que no se pueden eliminar. Pasa a la v0.13.
- URLs oficiales verificadas el 22/10 (respondieron 200): política de Google, ayuda de Google sobre
  Iniciar sesión con Google, política y términos de TikTok, ayuda de TikTok sobre apps de terceros,
  política de Apple y documentación de Apple (`SFSpeechRecognizer`, `requiresOnDeviceRecognition`).
- No se pudo confirmar y por eso no se afirma: menús exactos de TikTok para retirar el permiso (la
  página de ayuda carga con JavaScript; se enlaza sin nombrarlos); pantalla de Google Fonts sobre
  privacidad (no se enlazó; se enlaza la política de Google); que la política de TikTok «row» sea la
  que aplica a Perú; que la app de TikTok no haya pasado la auditoría (se deduce del Sandbox y de la
  lista de `REQUISITOS-AUDITORIA.md`). Google y TikTok no se probaron con cuentas reales (CLAUDE.md,
  21/10): el texto describe lo que hace el código.
- La web (`frontend/`) todavía no tiene pantallas de Google, foto, cambio de correo ni TikTok (solo
  `/confirm-email-change`); por eso el texto ubica esas acciones en la app para Android e iOS.
  Revisar el texto si la rama de la web las añade antes de publicar.
- Sigue siendo borrador: falta que Jason y Piero aprueben el texto.

## Borrador v0.12 — 18 de octubre de 2026

- Gemini: confirmado por Jason que la clave es del nivel gratuito (Google AI Studio); se mantiene
  la advertencia de que Google puede usar el contenido y que hay revisión humana.
- Regiones confirmadas: Render en Oregón (EE. UU.) y Neon en AWS us-east-1 (Virginia del Norte,
  EE. UU.), leídas de la configuración de Render el 18/10. Se quita el aviso de pendiente.
- X descrita tal como quedó en `remejora` (17/10): opcional y desactivada por defecto, permisos
  OAuth reales, versión breve sin enlaces aprobada por el cliente con verificación por hash,
  confirmación de costo y tope mensual, sin lectura de métricas. X Corp. añadida a proveedores.
- Meta: la configuración de inicio de sesión pide ahora 9 permisos (se suman `read_insights` y
  `pages_read_user_content` para las estadísticas de Facebook), igual que `META_OAUTH_SCOPES`.
- Términos: misma descripción de X. Eliminación de datos sin cambios (sigue en v0.11).
- Sigue siendo borrador: falta que Jason y Piero aprueben el texto y los nombres.

## Borrador v0.11 — 16 de octubre de 2026

- Privacidad y términos reescritos para describir la rama `remejora` (código revisado el 16/10),
  no la rama `piero`: el audio ya no se sube a Gemini ni existe TTS.
- Voz: transcripción en el navegador (Web Speech API) o en el reconocedor de Android; a Django
  solo llega texto. Desde el PR #2 se pide transcribir en el equipo cuando es posible
  (`processLocally` en la web, reconocedor en el dispositivo en Android 12+); si no, se advierte
  que Chrome y muchos Android envían el audio a servidores de Google.
- Gemini: interpretación del brief y mejora de texto desde Django; copy, prompt de imagen e imagen
  vía n8n. Correos vía n8n + Resend (ya no se menciona Gmail SMTP: no existe en `remejora`).
- Meta: conexión por OAuth del titular, 7 permisos reales de `META_OAUTH_SCOPES`, token Fernet,
  publicación al aprobar el cliente, enlace firmado de 1 h para la imagen y métricas agregadas.
- X y TikTok descritos como no activos; condiciones si se activan (X apagada por defecto con
  confirmación; TikTok sin auditoría solo `SELF_ONLY` o borrador en la bandeja del usuario).
- Infraestructura: Render, Vercel, Neon, ngrok (solo pruebas) y GitHub Pages; transferencia
  internacional (art. 15 de la Ley N.° 29733).
- Marco legal: Ley N.° 29733 y Reglamento D.S. N.° 016-2024-JUS (vigente desde el 31/03/2025);
  base legal, derechos ARCO y portabilidad, tutela ante la ANPD (art. 24), menores de 18 años.
- Nueva página `eliminacion-datos.html` (URL de instrucciones que pide Meta), enlazada desde
  índice, privacidad y términos; el preparador de Pages la exige y su test lo comprueba.
- Conservada en `historial/` solo la v0.10, la única que llegó a publicarse en Pages.
- Pendientes visibles: modalidad de facturación de Gemini y región de Render y Neon.
- Sigue siendo borrador: los responsables deben aprobar el texto antes de quitar los avisos.
  Lista de requisitos de Meta, TikTok y X en `REQUISITOS-AUDITORIA.md`.

## Borrador v0.10 — 11 de octubre de 2026

- Conservada v0.9 en `historial/`.
- Conexión TikTok implementada y probada localmente con respuestas simuladas.
- Descritos identificador, nombre mostrado, permisos y credenciales cifradas por usuario.
- Configuración del Sandbox y autorización real pendientes; envío de campañas sin implementar.
- Sin publicación en Pages ni envío de contenido a TikTok.

## Borrador v0.9 — 11 de octubre de 2026

- Conservada v0.8 en `historial/`.
- Contrastado el informe del proyecto con modelos y credencial compartida de la configuración actual.
- Descrito Gemini para texto/imagen, adaptación/resumen, transcripción y generación de voz.
- No se afirma texto gratuito ni facturación pagada sin verificar el proyecto Google.
- Distinguidos créditos internos del saldo del proveedor; sin precios o saldos personales publicados.
- Incluidas condiciones generales de tratamiento gratuitas/pagadas y precauciones para pruebas.
- Sin cambios de aplicación ni modalidad de Google, sin llamadas de generación ni publicación.

## Borrador v0.8 — 11 de octubre de 2026

- Conservada v0.7 en `historial/`.
- Confirmado por el usuario: Jason y Piero atenderán conjuntamente el correo de privacidad.
- Documentado flujo manual de recepción, verificación proporcional, evaluación y respuesta.
- Añadidas referencias oficiales de Google/Gemini, Resend, ngrok y GitHub.
- Pendiente verificar modalidad Gemini, condiciones externas, acceso al buzón y eliminación.
- No se asignaron plazos legales inventados ni se crearon registros privados, accesos o automatizaciones.
- Sin publicación, envío a revisión TikTok ni cambios de aplicación.

## Borrador v0.7 — 11 de octubre de 2026

- Conservada v0.6 en `historial/`.
- Procedimiento manual PostgreSQL implementado y primer dump/SHA256 creado localmente.
- Restauración comprobada en base nueva con 27 tablas; sin sobrescribir la original.
- Persistencia local no protege frente a pérdida de laptop; no hay backup externo ni rutina periódica.
- La rotación de 30 días sigue propuesta, sin eliminación automática de archivos.
- Documentos no publicados; respaldos privados excluidos de Git.

## Borrador v0.6 — 11 de octubre de 2026

- Conservada v0.5 en `historial/`.
- Verificado el webhook de correo y nodo Resend en la versión publicada y activa de n8n.
- El correo está dentro del mismo workflow IA, no en un workflow separado.
- Sin prueba de entrega ni envío de mensajes; no se probaron claves contra Resend.
- No se encontró mecanismo de respaldos PostgreSQL en los archivos inspeccionados.
- Sin cambios de aplicación, infraestructura ni publicación de documentos.

## Borrador v0.5 — 11 de octubre de 2026

- Conservada v0.4 en `historial/`.
- Comprobados motor PostgreSQL local, conexión real de Django y volumen persistente Docker.
- Spring configurado para la misma base local.
- Gmail SMTP configurado para recuperación de contraseñas.
- Campañas enviadas a n8n local; Resend contemplado en código, pendiente de verificar en workflow activo.
- Aclarado que persistencia no es un respaldo y configuración SMTP no prueba entrega.
- Sin cambios de aplicación ni configuración, sin envío de correo y sin publicación.

## Borrador v0.4 — 11 de octubre de 2026

- Conservada v0.3 en `historial/`.
- Registrada la decisión de ejecutar NexoMark en laptop por ahora, sin despliegue público acordado.
- Aclarado el papel del túnel ngrok y que ejecución local no elimina el tratamiento externo.
- Disponibilidad de pruebas condicionada al equipo y servicios en ejecución.
- Base de datos, respaldos y proveedor de correo siguen pendientes de verificación.
- Sin cambios de infraestructura, despliegue, publicación ni configuración de proveedores.

## Borrador v0.3 — 11 de octubre de 2026

- Conservada v0.2 en `historial/`.
- Registrada evaluación académica prevista en aproximadamente nueve semanas desde esta fecha.
- Continuidad del proyecto pendiente de decisión después de la evaluación.
- Revisión de conservación posterior a la evaluación, sin borrado automático ni limitación
  de solicitudes anteriores. Sin promesa de disponibilidad indefinida.
- Solo cambios documentales locales; sin automatización, despliegue ni publicación.

## Borrador v0.2 — 11 de octubre de 2026

- Conservada v0.1 en `historial/`; no hay una versión pública vigente.
- Identificados Gemini, Meta y X; TikTok y GitHub Pages siguen pendientes según su alcance.
- Incorporado el criterio de revisión al cierre de las pruebas de tesis y evidencias anonimizadas.
- Registrada rotación de respaldos de 30 días solo como propuesta no implementada.
- Ampliada la propuesta de atención manual a acceso, rectificación, cancelación y oposición.
- Añadidas reglas para versionado y comunicación de cambios relevantes.
- Pendientes: proveedores de despliegue, conservación concreta, respaldos, atención operativa,
  condiciones de servicio y revisión de adecuación legal antes de aprobar publicación.
- No se modificó la aplicación ni se configuró despliegue, eliminación o TikTok.

## Borrador v0.1 — 11 de octubre de 2026

- Primeros documentos locales con responsables y correo confirmados.
- Descripción de datos y funciones existentes, con pendientes resaltados.
