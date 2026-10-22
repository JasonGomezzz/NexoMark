# NexoMark IA — app Flutter (Android e iOS)

App móvil de NexoMark IA para **marketeros** (dictar, generar, enviar, ver
estadísticas) y **clientes** (revisar, aprobar o pedir cambios, conectar sus
redes). Habla con el mismo backend que la web: Django (`:8000`) y Spring
(`:8080`, solo la revisión del cliente). La app Kotlin de `mobile/` sigue
intacta; esta es la versión multiplataforma decidida el 21/10/2026.

## Correrla

Requisitos: Flutter 3.47, Xcode (iOS) o Android SDK, y el backend local
encendido (`docker compose up -d postgres redis springboot` y Django en `:8000`).

```bash
# Simulador de iOS (llega al Mac por localhost)
flutter run -d "iPhone 18 Pro"

# Emulador de Android (llega al Mac por 10.0.2.2)
flutter run -d emulator-5554

# iPhone o Android real en la misma Wi-Fi que el Mac
flutter run --dart-define=API_HOST=192.168.1.20
```

En un teléfono real Django debe escuchar en la red (`python manage.py runserver 0.0.0.0:8000`)
y `ALLOWED_HOSTS` debe incluir la IP del Mac. En iPhone, la primera vez: abrir
`ios/Runner.xcworkspace` en Xcode, elegir tu Apple ID en *Signing & Capabilities*
y activar el modo desarrollador del iPhone (con la cuenta gratuita la app caduca
a los 7 días).

Solo para pruebas en el simulador (no hay teclado ni micrófono reales):
`--dart-define=DEMO_EMAIL=… --dart-define=DEMO_PASSWORD=… --dart-define=DEMO_BRIEF=…`
precargan el login y el brief. No existen en una compilación release.

## Configuración

| `--dart-define` | Para qué |
|---|---|
| `API_HOST` | IP o nombre del Mac (por defecto `10.0.2.2` en Android y `localhost` en iOS) |
| `DJANGO_URL`, `SPRING_URL` | URL completa, para un despliegue HTTPS |
| `GOOGLE_IOS_CLIENT_ID` | Client ID de iOS de Google; sin él el botón de Google no aparece en iPhone |

Google en iOS además necesita el esquema invertido del client ID en
`ios/Runner/Info.plist` (`CFBundleURLTypes`). En Android hace falta un cliente
Android en Google Cloud con el paquete `com.marketmind.nexomark` y el SHA-1 del
keystore; el servidor entrega el client ID web (`GET /api/auth/google/config/`).

## Decisiones

- **Voz en el dispositivo.** `speech_to_text` transcribe en el teléfono; el canal
  nativo `nexomark/voz` (`MainActivity.kt`, `AppDelegate.swift`) dice con
  certeza si hay español para dictar sin conexión. Si no, el aviso cambia a
  "el sistema puede enviar el audio a Google/Apple". A Django solo llega el texto.
- **Conectar redes** con `flutter_web_auth_2` (ASWebAuthenticationSession / Custom
  Tabs). Django vuelve por `nexomark://oauth/<red>#code&state`; el canje exige el
  JWT del mismo usuario que inició la conexión.
- **Destinos sin marcar por defecto**: publicar en una cuenta real es una decisión explícita.
- **Movimiento** (`lib/core/theme/motion.dart`): curvas de `index.css`, 140–320 ms,
  nada desde escala 0, escalonado de 50 ms y todo se apaga con "reducir movimiento".

## Pruebas

```bash
flutter analyze && flutter test
```
