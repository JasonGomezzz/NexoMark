# Cambio seguro de correo

Flujo implementado: Configuración → Cambiar correo → contraseña actual → dos enlaces
de confirmación (correo actual y nuevo) → cambio atómico e invalidación de los JWT
de acceso y refresh mediante `token_version`. No cambia contraseña, rol ni campañas.
El correo anterior continúa siendo el login hasta completar ambas confirmaciones.

Los enlaces vencen a los 30 minutos, son de un solo uso y guardan solo su hash en
la base de datos. Abrirlos no cambia nada: se requiere pulsar Confirmar (POST).
Los secretos viajan en el fragmento de la URL y se retiran de la barra al cargar.
Cambiar contraseña, suspender la cuenta, modificar su correo o invalidar sesiones
deja sin efecto los enlaces anteriores. Se permite consultar y cancelar la
solicitud pendiente desde la cuenta; una solicitud nueva sustituye a la anterior.

## Ejecución local

1. Aplicar migraciones desde backend: `venv\Scripts\python.exe manage.py migrate`.
2. Backend en el puerto configurado (normalmente 8000) y frontend Vite (5173).
3. Revisar `FRONTEND_BASE_URL` en backend/.env: debe ser una URL confiable y
   accesible para quien abra el email. localhost solo sirve en la laptop.
4. Para emails reales configurar el backend SMTP de Django y sus variables
   `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, TLS/SSL y
   `DEFAULT_FROM_EMAIL`. No añadir valores secretos al repositorio.
   La configuración por defecto de consola NO entrega emails reales: imprime los
   mensajes en la terminal; no compartir esos logs ni incluirlos en respaldos públicos.
5. En producción: HTTPS, Redis compartido y verificar entregabilidad real antes
   de habilitarlo a usuarios. Los límites fallan cerrados si la caché no responde.

Límites: 5 solicitudes por cuenta y dirección destino por hora; 30 por IP/hora.
Confirmación: cuota independiente de 30 intentos/IP/hora. Los enlaces no permiten
consultar el estado de la cuenta sin autenticación. No hay reenvío ilimitado.
Un fallo de envío revierte la nueva solicitud sin cambiar la cuenta. Un correo ya
entregado antes de un fallo parcial puede contener un enlace inválido: solicitar de
nuevo desde Configuración. La aceptación por SMTP no garantiza llegada a la bandeja.

Si pierde acceso al correo anterior, NO se omite su confirmación: se requiere
recuperación asistida con comprobación de identidad. No se ha implementado un
procedimiento automatizado para ese caso.

Los tests usan SQLite y el backend de email en memoria: nunca envían emails reales.
Queda por verificar de extremo a extremo con dos buzones y SMTP real.
