# Cambio de contraseña

Configuración → Seguridad: contraseña actual, nueva contraseña y confirmación.
La coincidencia se exige en la interfaz; la API exige contraseña actual válida y
aplica los validadores Django con el usuario como contexto. La nueva contraseña
debe ser distinta; se aceptan de 8 a 128 caracteres sin recortar espacios.

El servidor bloquea la fila del usuario y vuelve a comprobar contraseña y versión
de sesión antes de guardar. Cambiar la contraseña incrementa `token_version` en la
misma transacción e invalida los JWT de acceso y refresh anteriores. Spring ya
comprueba esa versión contra la base compartida. Se eliminan solicitudes pendientes
de cambio de correo para que sus enlaces no sobrevivan al cambio de contraseña.

La web limpia sus credenciales locales y redirige al login mostrando el resultado.
El cierre invalida el acceso a las APIs; no borra físicamente el almacenamiento de
otros dispositivos: se les exigirá login en su siguiente solicitud autenticada.

Límite: 5 solicitudes por cuenta/hora y 20/IP/hora, incluidos intentos fallidos.
Redis debe estar compartido entre workers. Si la caché falla, se rechaza el cambio.
La respuesta 429 incluye Retry-After y la web muestra un contador. Errores borran
los campos de contraseña y nunca se almacenan en localStorage/sessionStorage.

Después de guardar se intenta enviar un aviso al correo registrado, sin claves,
tokens ni contraseñas. Si SMTP falla, NO se revierte el cambio: la respuesta 200
indica que la contraseña cambió pero el aviso no pudo enviarse. El envío es
síncrono y de mejor esfuerzo: todavía no hay cola durable ni reintentos automáticos.
Que SMTP acepte el mensaje no garantiza su llegada a la bandeja de entrada.

No se añadió código OTP para cambiar contraseña: la recomendación aceptada usa
reauthenticación mediante contraseña actual. La recuperación por enlace temporal
sigue en /forgot-password, sin cambios de flujo. No revelar valores de .env.
Los tests usan backend de correo en memoria, no SMTP real.

No requiere nueva migración. Ejecutar Django y Vite como de costumbre. Falta validar
manualmente con una cuenta de prueba el envío SMTP, logout/redirección y nuevo login.
No realizar una prueba cambiando la contraseña real del usuario sin que él la ingrese.
