[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/Q8MxYa_E)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=23827676&assignment_repo_type=AssignmentRepo)

# NexoMark IA

Guías actualizadas: [ejecución local y puertos](LOCAL_DEVELOPMENT.md) y
[recuperación de contraseña por correo](RECOVERY_SETUP.md).
Spring usa 8081 en el host y 8080 dentro de Docker. Ejecuta una sola instancia.

SaaS de automatización de campañas publicitarias con IA para agencias de
marketing digital. Genera copy + imagen de anuncios automáticamente y
gestiona el flujo de aprobación entre marketero y cliente.

La identidad visual del proyecto se encuentra en [`brand/`](brand/README.md):
logo principal, isotipo, paleta y reglas básicas de uso.

Arquitectura políglota distribuida sobre una misma base de datos PostgreSQL:

- **Django REST Framework** (Python) — panel de administración, IA (n8n +
  Gemini), autenticación, dueño del schema/migraciones.
- **Spring Boot** (Java) — API de cara al cliente final (revisar/aprobar
  campañas), solo lee/actualiza estado, nunca migra el schema.
- **React** — frontend web (SuperAdmin, Marketero, Cliente).
- **Flutter** — app móvil Android/iOS adaptada al backend actual; incluye dictado y revisión de campañas. Ver alcance y pruebas en [`mobile_flutter/README.md`](mobile_flutter/README.md).
- **n8n** — orquesta la generación asíncrona de copy + imagen con Gemini.

## Índice

- [Requisitos previos](#requisitos-previos)
- [Puertos locales](#puertos-locales)
- [1. Clonar el proyecto](#1-clonar-el-proyecto)
- [2. Variables de entorno](#2-variables-de-entorno)
- [3. Levantar servicios con Docker](#3-levantar-servicios-base-con-docker)
- [4-8. Backend Django](#4-crear-y-activar-el-entorno-virtual-del-backend)
- [9. Spring Boot](#9-levantar-spring-boot)
- [10. Frontend React](#10-correr-el-frontend-web)
- [11. App móvil Flutter](#11-correr-la-app-movil-flutter)
- [Usuarios de prueba (3 roles)](#usuarios-de-prueba-3-roles)
- [Arranque rápido del día a día](#orden-recomendado-para-volver-a-correr-el-proyecto)
- [Despliegue en producción](#despliegue-en-producción)
- [Problemas comunes (Mac y Windows)](#problemas-comunes-mac-y-windows)

## Requisitos previos

- Python 3.11 o 3.12 recomendado.
- Docker Desktop instalado y corriendo (Mac, Windows o WSL).
- Node.js 18 o superior.
- Git.
- Java 21 (solo si vas a compilar Spring Boot fuera de Docker).
- Android Studio (solo si vas a correr la app móvil).

> **Windows:** si usas WSL, ejecuta todos los comandos desde la terminal de
> WSL. Evita mezclar un `venv` creado en Windows (PowerShell/CMD) con
> comandos ejecutados desde Linux/WSL — son entornos incompatibles entre sí.
> Si no usas WSL, PowerShell o CMD funcionan igual; las diferencias puntuales
> están marcadas más abajo.

## Puertos locales

| Servicio | URL / Puerto |
|---|---|
| Django API | `http://localhost:8000` |
| React / Vite | `http://localhost:5173` |
| Spring Boot API | `http://localhost:8081` |
| n8n | `http://localhost:5678` |
| PostgreSQL (desde tu máquina) | `localhost:5433` |
| PostgreSQL (dentro de Docker) | `postgres:5432` |
| Redis | `localhost:6379` |

Todos estos puertos son configurables (ver [Problemas comunes](#problemas-comunes-mac-y-windows)
si alguno ya está ocupado en tu máquina).

## 1. Clonar el proyecto

```bash
git clone https://github.com/Tecsupsoft/2026-1-4c24-pi-2b
cd 2026-1-4c24-pi-2b
```

## 2. Variables de entorno

Hay **tres** archivos `.env` distintos (uno por bloque). Ninguno se sube al
repositorio — cada uno tiene su propio `.env.example` como plantilla.

### 2.1 Backend Django (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

Para desarrollo local con el `docker-compose.yml` de la raíz, deja estos
valores en `backend/.env`:

```env
SECRET_KEY=django-insecure-dev-key-marketmind-2026-local
DJANGO_SETTINGS_MODULE=core.settings.dev
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

DB_NAME=marketmind_db
DB_USER=marketmind_user
DB_PASSWORD=localpass123
DB_HOST=localhost
DB_PORT=5433
DB_SSLMODE=disable

REDIS_URL=redis://localhost:6379/0

# IA — MUY IMPORTANTE en desarrollo
USE_MOCK_AI=True
GEMINI_API_KEY=tu-api-key-de-google-ai-studio
RESEND_API_KEY=tu-api-key-de-resend
RESEND_FROM_EMAIL=onboarding@resend.dev

SPRINGBOOT_INTERNAL_URL=http://localhost:8081
INTERNAL_EVENT_TOKEN=dev-internal-event-token
```

`DB_PORT=5433` es importante: Docker expone PostgreSQL hacia tu máquina en
`5433`, aunque dentro de Docker el puerto siga siendo `5432`.

> **`USE_MOCK_AI=True` es crítico en desarrollo.** Sin esto cada generación de
> campaña llama a Gemini de verdad y consume cuota real (que se agota rápido
> en el free tier). En modo mock, Django devuelve copy + imagen simulados al
> instante, sin gastar cuota ni depender de que n8n esté corriendo. Solo pon
> `USE_MOCK_AI=False` cuando quieras probar el flujo de IA real end-to-end.

### 2.2 Raíz del proyecto (`.env`) — Docker Compose / Spring Boot

Docker Compose y n8n leen variables desde un `.env` en la **raíz** del
proyecto (no confundir con `backend/.env`). Es clave porque Spring Boot valida
los JWT que emite Django usando el mismo `SECRET_KEY`.

```bash
cp .env.example .env
```

Debe quedar así:

```env
SECRET_KEY=django-insecure-dev-key-marketmind-2026-local
DB_NAME=marketmind_db
DB_USER=marketmind_user
DB_PASSWORD=localpass123
SPRINGBOOT_HOST_PORT=8081
INTERNAL_EVENT_TOKEN=dev-internal-event-token
GEMINI_API_KEY=tu-api-key-de-google-ai-studio
RESEND_API_KEY=tu-api-key-de-resend
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Reglas importantes:

- `SECRET_KEY` debe ser **exactamente igual** en `backend/.env` y en este
  `.env` de la raíz. Si no coincide, Spring Boot rechaza los tokens de Django
  y el login del cliente falla silenciosamente en pantallas que consumen
  `:8081`.
- `INTERNAL_EVENT_TOKEN` también debe coincidir en ambos archivos (lo usa
  Django para avisar a Spring Boot cuando se envía una campaña al cliente).
- n8n lee `GEMINI_API_KEY` y `RESEND_API_KEY` desde `backend/.env` (ver
  `docker-compose.yml`, servicio `n8n` usa `env_file: ./backend/.env`). Si
  cambias esas variables, recrea el contenedor:

```bash
docker compose up -d --force-recreate n8n
```

### 2.3 Frontend React (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_URL=http://localhost:8000
VITE_USER_API_URL=http://localhost:8081
```

Vite no lee `.env.example` automáticamente — el archivo real debe llamarse
`frontend/.env`. Después de cambiar cualquier variable `VITE_*`, reinicia
`npm run dev` (Vite no hace hot-reload de variables de entorno).

## 3. Levantar servicios base con Docker

```bash
docker compose up -d postgres redis n8n
```

Verifica el estado:

```bash
docker compose ps
```

`postgres` debe aparecer como `healthy`.

## 4. Crear y activar el entorno virtual del backend

```bash
cd backend
python -m venv venv
```

**Windows PowerShell:**

```powershell
venv\Scripts\Activate.ps1
```

Si PowerShell bloquea la ejecución de scripts, corre una vez (como admin):
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

**Windows CMD:**

```bat
venv\Scripts\activate.bat
```

**Mac / Linux / WSL:**

```bash
source venv/bin/activate
```

Verifica que aparezca `(venv)` al inicio de la terminal.

## 5. Instalar dependencias del backend

Con el `venv` activado, dentro de `backend`:

```bash
python -m pip install --upgrade pip
pip uninstall psycopg2 psycopg2-binary -y
pip install -r requirements.txt
pip install psycopg2-binary
```

El paso de desinstalar/reinstalar `psycopg2-binary` evita problemas comunes de
compilación en Windows.

## 6. Migrar la base de datos

Con Docker corriendo y el `venv` activado:

```bash
python manage.py migrate
```

Crea las tablas que usan tanto Django como Spring Boot. Si no se ejecuta,
Spring Boot falla al arrancar con errores como `missing table [campaigns]`.

## 7. Crear usuarios de prueba

Abre el shell de Django:

```bash
python manage.py shell
```

Pega esto (crea los 3 roles de una vez):

```python
from django.contrib.auth import get_user_model

User = get_user_model()

usuarios = [
    ("marketero@test.com", "Marketero Test", "marketero"),
    ("cliente@test.com", "Cliente Test", "cliente"),
    ("admin@test.com", "Admin Test", "superadmin"),
]

for email, nombre, rol in usuarios:
    u, created = User.objects.get_or_create(
        email=email,
        defaults={"nombre": nombre, "rol": rol, "is_active": True},
    )
    u.nombre = nombre
    u.rol = rol
    u.is_active = True
    if rol == "superadmin":
        u.is_staff = True
        u.is_superuser = True
    u.set_password("MarketMind2026!")
    u.save()
    print("OK:", u.email, "rol=", u.rol, "created=", created)
```

Sal del shell:

```python
exit()
```

Ver [Usuarios de prueba](#usuarios-de-prueba-3-roles) más abajo para las
credenciales completas.

## 8. Correr el backend Django

Desde `backend`, con el `venv` activado:

```bash
python manage.py runserver
```

Debe verse:

```text
Starting development server at http://127.0.0.1:8000/
```

Deja esta terminal abierta.

## 9. Levantar Spring Boot

En otra terminal, desde la raíz del proyecto:

```bash
docker compose up -d --build springboot
```

Verifica el health check:

```bash
curl http://localhost:8081/actuator/health
```

Respuesta esperada:

```json
{"status":"UP"}
```

## 10. Correr el frontend web

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre:

```text
http://localhost:5173
```

El dashboard del cliente se conecta por WebSocket a Spring Boot
(`ws://localhost:8081/ws/client-campaigns`) para recibir campañas nuevas sin
refrescar la página.

## 11. Correr la app móvil Flutter

La única app móvil mantenida está en `mobile_flutter/`. Se retiró el cliente
Android/Kotlin anterior; su código permanece en el historial de Git.

Consultar [`mobile_flutter/README.md`](mobile_flutter/README.md) para requisitos,
ejecución en A56 por USB, emulador, alcance y límites. Requiere un SDK Flutter
compatible con Dart 3.13 y los servicios Django/Spring de la laptop encendidos.

Desde `mobile_flutter/`, con Flutter compatible en PATH:

```bash
flutter pub get
flutter run --dart-define=API_HOST=10.0.2.2
```

El emulador usa `10.0.2.2`; un Android por USB puede usar `127.0.0.1` con los
puertos reenviados mediante `adb reverse`, como explica la guía móvil. Flutter
usa Django en 8000 y Spring en 8080 por defecto. Si Spring corre en 8081, indicar
también `--dart-define=SPRING_URL=http://10.0.2.2:8081` en el emulador (o el host
y puerto que correspondan al dispositivo). No usar el antiguo `API_BASE_URL`.

El dictado móvil usa el reconocedor del dispositivo; se envía el texto confirmado.
La app no contiene claves de Gemini. Google nativo, conexión/publicación social y
consulta de contadores externos no están habilitados en esta integración móvil;
las funciones sociales se realizan desde la web.

## Usuarios de prueba (3 roles)

Después de correr el paso 7, estas son las credenciales para las 3 vistas
(web y móvil comparten el mismo login contra Django):

| Rol | Email | Password | Dónde entra |
|---|---|---|---|
| SuperAdmin | `admin@test.com` | `MarketMind2026!` | Solo web (`/admin` del panel React + Django Admin en `localhost:8000/admin/`) |
| Marketero | `marketero@test.com` | `MarketMind2026!` | Web y móvil |
| Cliente | `cliente@test.com` | `MarketMind2026!` | Web y móvil (revisa/aprueba, no crea campañas) |

El registro (`/register` en web o pantalla de registro en móvil) también
funciona con cualquier email nuevo — no hace falta que sea uno de estos.

Django Admin (`http://localhost:8000/admin/`) usa las credenciales del
SuperAdmin y muestra la base de datos completa: usuarios, campañas,
versiones, tokens disponibles, etc.

## Orden recomendado para volver a correr el proyecto

Cuando ya instalaste todo una vez:

```bash
docker compose up -d postgres redis n8n springboot
cd backend
source venv/bin/activate   # Windows: venv\Scripts\Activate.ps1
python manage.py runserver
```

En otra terminal:

```bash
cd frontend
npm run dev
```

Android: solo abre Android Studio y corre la app (Django y Spring Boot deben
estar arriba primero).

## Despliegue en producción

El proyecto ya está desplegado y funcionando end-to-end. Arquitectura de
despliegue:

| Componente | Plataforma | Notas |
|---|---|---|
| Django (backend admin) | [Render](https://render.com) | Dockerfile propio; migraciones corren dentro del `CMD` al arrancar (Render free tier no tiene Pre-Deploy Command) |
| Spring Boot (backend cliente) | Render | `ddl-auto=validate` — nunca migra, solo lee/valida contra el schema de Django |
| n8n | Render | PostgreSQL propio (Neon, schema separado `n8n`) en vez de SQLite, para sobrevivir el disco efímero de Render |
| React (frontend) | [Vercel](https://vercel.com) | `vercel.json` con rewrites SPA (obligatorio para que las rutas de React Router no den 404) |
| PostgreSQL | [Neon.tech](https://neon.tech) | Única base de datos compartida entre Django y Spring Boot |
| APK Android | Build local firmado | Variante `release` apunta a las URLs de Render |

### Pasos generales para desplegar cada bloque

**Django (Render, Web Service con Docker):**

1. Conectar el repo a Render, indicar `backend/` como contexto de build y su
   `Dockerfile`.
2. Configurar variables de entorno equivalentes a `backend/.env`, pero con:
   - `DJANGO_SETTINGS_MODULE=core.settings.prod`
   - `DB_HOST`, `DB_PORT`, `DB_SSLMODE=require` apuntando a Neon.
   - `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` con los dominios reales de
     Render/Vercel (no `localhost`).
   - `USE_MOCK_AI=False` (o `True` temporalmente si se quiere demo sin gastar
     cuota Gemini).
   - `N8N_WEBHOOK_BASE_URL` apuntando a la URL de n8n en Render.
3. El `Dockerfile` corre `python manage.py migrate` antes de levantar
   `gunicorn` (migración idempotente, segura en cada deploy).
4. Exponer `/api/health/` (público, sin auth) y configurar un keep-alive
   externo (ej. cron-job.org) cada ~14 min — el free tier de Render duerme el
   servicio tras inactividad.

**Spring Boot (Render, Web Service con Docker):**

1. Mismo patrón: contexto `springboot/`, su propio `Dockerfile`.
2. Variables clave: `SPRING_PROFILES_ACTIVE=prod`, credenciales de la misma
   BD Neon, y el **mismo `SECRET_KEY`** que usa Django (imprescindible para
   validar JWT).
3. `application-prod.yml` debe tener `ddl-auto=validate` — nunca `update` ni
   `create`.
4. Exponer `/actuator/health` (público) y agregar su propio keep-alive.

**n8n (Render, Docker):**

1. Usar `ENTRYPOINT` (no `CMD`) en el `Dockerfile` para evitar el entrypoint
   base de la imagen oficial de n8n, que no soporta bien el `$PORT` dinámico
   de Render.
2. Configurar PostgreSQL (Neon) como base de datos de n8n vía
   `DB_TYPE=postgresdb` + `DB_POSTGRESDB_*`, con `DB_POSTGRESDB_SCHEMA=n8n`
   (separado del schema `public` de Django).
3. Variables de entorno: `GEMINI_API_KEY`, `RESEND_API_KEY`,
   `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (sin esto, `$env.GEMINI_API_KEY` da
   "access to env vars denied" dentro de los nodos).
4. Importar el workflow (`n8n/marketmind_ia_workflow.json`) desde la UI con
   **"Import from File"** — las escrituras al API de n8n en producción son
   bloqueadas por el WAF delante de Render; la UI sí funciona.

**React (Vercel):**

1. Conectar el repo, indicar `frontend/` como root directory.
2. Variables de entorno: `VITE_API_URL` y `VITE_USER_API_URL` apuntando a las
   URLs de Render de Django y Spring Boot respectivamente.
3. `vercel.json` ya trae los rewrites necesarios para SPA — sin esto, cualquier
   ruta que no sea `/` da 404 al refrescar o compartir un link directo.

**APK Android (release):**

1. La app Flutter no fija URLs públicas de producción por defecto. Configurar
   `DJANGO_URL` y `SPRING_URL` mediante `--dart-define` para un entorno HTTPS verificado.
2. Configurar la firma Android de Flutter con credenciales privadas fuera del
   repositorio antes de distribuir un release. No se ha validado un release firmado;
   las pruebas documentadas corresponden al APK debug.

## Problemas comunes (Mac y Windows)

### Spring Boot no arranca y dice `missing table [campaigns]`

Faltan migraciones:

```bash
cd backend
source venv/bin/activate   # Windows: venv\Scripts\Activate.ps1
python manage.py migrate
cd ..
docker compose up -d springboot
```

### Un puerto ya está ocupado (8000, 8081, 5173, 5433, 6379, 5678)

- **Spring Boot (`8081`):** cambia `SPRINGBOOT_HOST_PORT` en el `.env` de la
  raíz, y actualiza también `VITE_USER_API_URL` en `frontend/.env` y
  `SPRINGBOOT_INTERNAL_URL` en `backend/.env` para que todos apunten al mismo
  puerto nuevo.
- **Django (`8000`):** corre `python manage.py runserver 0.0.0.0:8001` (u otro
  puerto libre) y actualiza `VITE_API_URL` en `frontend/.env`.
- **PostgreSQL (`5433`), Redis (`6379`) o n8n (`5678`):** edita el mapeo de
  puertos en `docker-compose.yml` (ej. `"5434:5432"`) y actualiza
  `DB_PORT` en `backend/.env` si tocaste Postgres.
- En Windows, si el puerto ocupado es por otro proceso, revisa con
  `netstat -ano | findstr :8081` y cierra el proceso con
  `taskkill /PID <pid> /F`. En Mac/Linux: `lsof -i :8081` y `kill -9 <pid>`.

### Login funciona en Django pero falla en pantallas del cliente (web o móvil)

Revisa que `SECRET_KEY` sea **exactamente igual** en:

- `backend/.env`
- `.env` en la raíz del proyecto

Spring Boot necesita validar el mismo JWT que genera Django; si no coincide,
el login web/móvil parece funcionar (Django responde bien) pero cualquier
pantalla que consuma `:8081` (revisión del cliente) devuelve 401/403.

### El frontend no encuentra la API

Confirma que exista `frontend/.env` con:

```env
VITE_API_URL=http://localhost:8000
VITE_USER_API_URL=http://localhost:8081
```

Reinicia `npm run dev` después de cualquier cambio a variables `VITE_*`.

### Login funciona pero el dashboard dice "no se pudieron cargar los datos" (error de CORS)

Si la terminal de `npm run dev` muestra `Port 5173 is in use, trying another
one...` y Vite arrancó en `5174` (o `5175`), Django va a **rechazar por CORS**
cualquier petición que no venga de un origen dentro de `CORS_ALLOWED_ORIGINS`.
El login puede llegar a funcionar (a veces pasa antes de que el navegador
bloquee) pero las llamadas siguientes (stats, campañas, analytics) fallan.

Dos soluciones:

1. **Libera el puerto 5173** antes de correr `npm run dev` (cierra cualquier
   otro `npm run dev` que haya quedado abierto en otra terminal), o
2. **Agrega el puerto real a `backend/.env`** y reinicia `runserver`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000
```

`backend/.env.example` ya trae estos 3 puertos por defecto — si tu `.env` es
viejo (de antes de este fix) o te lo pasó un compañero, actualízalo a mano.

### La app móvil no conecta (emulador Android)

- Usa `10.0.2.2`, nunca `localhost` ni `127.0.0.1` — ya viene configurado así
  por defecto en la variante `debug`, no debería tocarse.
- Confirma que Django (`:8000`) y Spring Boot (`:8081`) estén corriendo en tu
  Mac/PC antes de abrir la app.
- Si ves errores de "cleartext traffic not permitted", revisa que no se haya
  modificado `network_security_config.xml` ni el manifiesto de la app.

### Error instalando `psycopg2`

```bash
pip uninstall psycopg2 psycopg2-binary -y
pip install psycopg2-binary
```

### Docker no responde desde WSL (Windows)

Abre Docker Desktop y verifica que la integración con tu distro WSL esté
activada (Settings → Resources → WSL Integration). Luego prueba:

```bash
docker compose ps
```

### Generación de campañas consume cuota de Gemini muy rápido

Verifica que `USE_MOCK_AI=True` esté en `backend/.env` durante desarrollo.
Con mock activado, el copy y la imagen se simulan al instante sin llamar a
Gemini ni depender de que n8n esté corriendo.

## Notas importantes

- Siempre levanta Docker antes de ejecutar `python manage.py runserver`.
- Siempre activa el `venv` antes de usar comandos Python del backend.
- **Nunca subas archivos `.env` al repositorio** (ya están en `.gitignore`).
- Después de cambiar cualquier `.env` del frontend, reinicia Vite.
- Después de cambiar `docker-compose.yml` o el `.env` de la raíz, recrea el
  servicio afectado: `docker compose up -d <servicio>`.
- `USE_MOCK_AI=True` en desarrollo, `False` solo cuando se necesite probar el
  flujo real de IA (consume cuota Gemini).
