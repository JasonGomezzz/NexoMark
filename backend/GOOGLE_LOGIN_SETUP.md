# Inicio de sesión y registro con Google

Implementación web con Google Identity Services (GIS). Botón oficial con icono,
login local independiente y JWT propios de Django compatibles con Spring.
No es la conexión para publicar en redes; no solicita Gmail, Drive ni permisos
para publicar. No se guardan access/refresh tokens de Google ni su contraseña.

## Habilitar en esta laptop

1. Google Cloud Console / Google Auth Platform: crear o elegir un proyecto.
2. Configurar Branding (NexoMark, correo de soporte y URLs legales públicas),
   Audience según los usuarios previstos. Para Gmail y cuentas externas usar
   External; en Testing añadir las cuentas de prueba cuando corresponda.
3. Clients → crear cliente OAuth de tipo **Web application**.
4. Authorized JavaScript origins: `http://localhost:5173` y, si se usa,
   `http://127.0.0.1:5173`. Añadir el origen HTTPS real cuando se despliegue.
5. Copiar el Client ID web a `backend/.env` como `GOOGLE_CLIENT_ID=...`.
   Este flujo GIS popup con callback JavaScript NO usa un Client Secret ni
   una URL de callback OAuth de backend. No añadir un secreto a variables VITE.
6. Aplicar migraciones (`venv\Scripts\python.exe manage.py migrate`) y reiniciar
   Django si no recarga automáticamente. No requiere instalar dependencias nuevas.
   La migración de este avance es authentication.0013_googleloginticket_user_google_subject.
7. Verificar frontend/backend y que FRONTEND_BASE_URL/CORS_ALLOWED_ORIGINS incluyan
   el origen de la web. El origen de Google debe coincidir exactamente con puerto.

Sin Client ID, el botón se presenta deshabilitado con explicación, sin simular un
login ni cargar el SDK. El usuario sigue pudiendo usar correo y contraseña.
Si bloquean el SDK, revisar extensiones/red y reintentar; no desactivar protecciones
globalmente. Revisar COOP/CSP del servidor que sirve el HTML antes de desplegar
(GIS popup puede necesitar same-origin-allow-popups según FedCM). HTTPS en producción.

## Reglas de cuenta

- Login: un identificador Google previamente vinculado (`sub`) entra en su cuenta
  activa, conservando rol, nombre, foto local y créditos. El email no es el ID del
  proveedor; cambiarlo en Google no crea otra cuenta ni modifica el email local.
- Si el mismo email ya existe pero no está vinculado, pide la contraseña actual de
  **NexoMark** antes de vincular por primera vez. No enlaza automáticamente por
  coincidencia de dirección, no reasigna otro Google ya vinculado ni reactiva cuentas.
- Una cuenta nueva se crea solo desde Registro, con elección explícita de Marketero
  o Cliente, nunca SuperAdmin. El registro Google nuevo acepta Gmail o Workspace
  verificado (Google autoritativo para ese correo); un Google con email externo sin
  Workspace debe usar registro local y luego vincular con contraseña.
- Cuenta nueva Google no recibe contraseña inventada ni se pide la de Google.
  Para obtener contraseña local usar el enlace de /forgot-password enviado al correo;
  ese flujo queda habilitado para Google-only. Luego puede cambiar correo o desvincular.
- Configuración muestra vinculación y permite desvincular con contraseña local.
  Desvincular invalida sesiones previas; Google-only debe crear contraseña antes.
  Cambiar correo/contraseña local NO desvincula Google por sí mismo.
- No se copia automáticamente la foto remota. La foto de perfil sigue bajo control
  del usuario y su flujo de carga privada.

## Seguridad y validación

Servidor verifica firma RS256 con claves JWK de URL fija de Google (PyJWT existente,
sin tokeninfo de depuración), aud del cliente web, iss permitido, exp/iat, email
verificado, sub y nonce. Tickets de 10 minutos, nonce y prueba de navegador aleatorios
con hashes en BD; propósito/rol vinculados al ticket, consumo atómico de un solo uso.
Origin permitido y prueba enviada en JSON por la web complementan el nonce; no hay
callback HTML de login POST externo ni One Tap automático. No registrar credenciales,
pruebas ni tokens. El SDK y verificador solo deben contactar hosts oficiales de Google.

Límites de POST: 30 por IP/hora, más 5 intentos de contraseña de vinculación por
cuenta/hora. Redis compartido en producción; falla cerrado cuando la caché falla.
Este límite complementa protección del gateway, no sustituye monitorización de abuso.

Pruebas usan claves RSA sintéticas y JWK mockeado, sin llamar a Google ni crear
cuentas reales. Falta OAuth real y verificación en navegador con Client ID válido,
cuenta nueva y existente, roles, consentimiento, popup/bloqueadores y temas/móvil.
La política de privacidad y términos deben reflejar Google antes de habilitarlo
públicamente; los borradores legales existentes no se modificaron automáticamente.
La integración no envía la app a revisión ni publica el proyecto.

Fuentes:
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/reference/js-reference
- https://developers.google.com/identity/branding-guidelines
