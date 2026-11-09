# NexoMark IA — Spring Boot (Bloque Usuario)

API REST de cara al cliente final. Puerto `8080`.
Convive con Django (puerto `8000`) sobre la misma PostgreSQL.

## Regla de oro

> **NUNCA** cambiar `spring.jpa.hibernate.ddl-auto` a `update` o `create`.
> Django es el dueño absoluto del schema. Spring Boot solo valida (`validate`).
> Cambiar esto destruiría o modificaría tablas en producción.

## Responsabilidades

| Spring Boot hace | Spring Boot NO hace |
|-----------------|---------------------|
| Leer campañas y usuarios | Crear/modificar el schema |
| Escribir estado, feedback, valoración, contador de rechazos y versión | Emitir tokens JWT |
| Validar JWT emitidos por Django | Gestionar migraciones |
| Aprobar / rechazar campañas y notificar email mediante n8n | Generar contenido con Gemini |

## Variables de entorno requeridas

```env
DB_HOST=localhost          # postgres (Docker) o localhost (local)
DB_PORT=5433               # 5433 fuera de Docker, 5432 dentro
DB_NAME=marketmind_db
DB_USER=marketmind_user
DB_PASSWORD=localpass123
SECRET_KEY=<mismo SECRET_KEY que usa Django>
SPRING_PROFILES_ACTIVE=dev
```

## Correr localmente (fuera de Docker)

Prerequisito: Django debe tener aplicadas todas las migraciones de la versión actual del repositorio (`python manage.py migrate` en `backend/`). Confirmar primero la base de datos y el ambiente de destino.

```bash
cd springboot

# Con Maven instalado:
DB_HOST=localhost DB_PORT=5433 DB_NAME=marketmind_db \
DB_USER=marketmind_user DB_PASSWORD=localpass123 \
SECRET_KEY=<secret_key> \
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# O exportando las variables primero:
export DB_HOST=localhost DB_PORT=5433 ...
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

El servidor arranca en `http://localhost:8080`.
Al iniciar verás el validate de Hibernate — si ves DDL (`CREATE TABLE`, `ALTER TABLE`) hay un error de configuración.

## Correr con Docker Compose

```bash
# Desde la raíz del repo:
docker compose up -d postgres redis
docker compose up springboot
```

## Abrir en IntelliJ IDEA

1. `File → Open` → seleccionar la carpeta `springboot/` (no la raíz del repo)
2. IntelliJ detecta el `pom.xml` y configura Maven automáticamente
3. Importar como proyecto Maven
4. Configurar SDK: Java 25
5. Para correr: botón Run en `MarketMindApplication.java`
6. Agregar las variables de entorno en `Run/Debug Configurations → Environment variables`

IntelliJ Community Edition es suficiente para este proyecto.

## Endpoints

| Método | Path | Rol | HU |
|--------|------|-----|----|
| GET | `/actuator/health` | Público | — |
| GET | `/api/v1/campaigns/pending` | CLIENTE | HU12 |
| GET | `/api/v1/campaigns/{id}` | Autenticado | HU13 |
| PATCH | `/api/v1/campaigns/{id}/status` | CLIENTE, SUPERADMIN | HU14 |

Todos los endpoints `/api/v1/**` requieren `Authorization: Bearer <token>`.
El token es emitido por Django (`POST /api/auth/token/`) y validado aquí.

## Optimistic locking

El campo `version` permite a JPA detectar actualizaciones concurrentes realizadas por Spring.
Django todavía no participa plenamente de ese protocolo, por lo que no garantiza exclusión entre ambos backends.
El PATCH también valida la versión enviada por el cliente: una discrepancia previa devuelve HTTP 400 con indicación de recargar; un conflicto detectado al guardar por JPA devuelve HTTP 409:

```json
{
  "success": false,
  "message": "La campaña fue modificada por otro proceso. Recarga e intenta de nuevo.",
  "data": null
}
```

## Notificaciones de cliente autenticadas

`/ws/client-campaigns` admite el upgrade del navegador, pero no suscribe ni envía
notificaciones hasta recibir, en un máximo de cinco segundos, el primer mensaje:

```json
{"type":"authenticate","accessToken":"<access JWT de Django>"}
```

El JWT no se coloca en URL ni subprotocolo. El servidor exige token de acceso
con expiración, rol cliente, usuario activo y versión vigente. Responde
`{"type":"authenticated"}` y cierra al expirar. Antes de cada entrega vuelve a
consultar estado, rol, versión y email del usuario mediante una proyección
escalar, evitando datos de autenticación cacheados en JPA.

Las notificaciones sólo contienen `type` (`campaign_submitted` o
`campaign_status_changed`) y `campaignId`. Se entregan exclusivamente a las
conexiones del destinatario; el contenido se obtiene por la API autenticada.
React resincroniza por esa API al conectar/reconectar. Las conexiones anónimas
no reciben IDs ni contenido de campaña.

Códigos de cierre: `4401` credencial inválida o ausente; `4403` sesión revocada o
rol denegado; `4408` access expirado. HTTP devuelve `401` cuando falta una sesión
válida, y conserva `403` para falta de permisos. Django, Spring y WebSocket en
React comparten una sola renovación por pestaña, preservan sesión ante fallos de
red/5xx y descartan respuestas de una sesión reemplazada.

Los cambios de estado se notifican por WebSocket y email sólo después del commit;
Django aplica la misma regla al envío al cliente. Esto evita notificar cambios
revertidos, pero no constituye una cola durable: una caída entre commit y envío
puede perder una notificación. La API sigue siendo la fuente de verdad. La llamada
email Spring tiene límites de conexión de 2 s y lectura de 3 s.

En producción deben usarse HTTPS/WSS y orígenes explícitos del despliegue. La
configuración actual mantiene los orígenes de desarrollo existentes. El canal
en memoria corresponde a una instancia Spring; varias réplicas requieren un
mecanismo compartido de entrega, fuera de este cambio.

Validación: `mvn verify` (Java 25), `cd ../frontend && npm test && npm run lint && npm run build`.
Los tests Spring comprueban destinatarios, anónimo, JWT inválido/expirado/refresh,
revocación y commit/rollback; los de React comprueban rotación, reconexión y
cambios de sesión. Los tests unitarios no sustituyen una prueba integrada con
PostgreSQL y navegador.
