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

En un teléfono real Django debe escuchar en la red (`python manage.py runserver 0.0.0.0:8000`);
`dev.py` ya acepta la IP que tenga el Mac al arrancar. Para no depender del Mac,
`tool/instalar_iphone_release.sh` instala en el iPhone una versión release que habla
con Render (`… local` usa el Mac). En iPhone, la primera vez: abrir
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

### Entrar con Google

Google da un client ID por plataforma, todos en el mismo proyecto de Google Cloud
que el client ID web de `backend/.env` (`GOOGLE_CLIENT_ID`). El servidor entrega el
web (`GET /api/auth/google/config/`) y la app lo usa como `serverClientId`; ningún
client ID ni secreto va escrito en el código.

| Plataforma | Qué crear en Google Cloud (Credenciales → ID de cliente OAuth) | Dónde va |
|---|---|---|
| iOS | Tipo **iOS**, bundle ID `com.marketmind.nexomark` | `tool/configurar_google_ios.sh <client-id>` (escribe `ios/Flutter/Google.xcconfig`, fuera de git, con el ID y su esquema invertido para `Info.plist`) |
| Android | Tipo **Android**, paquete `com.marketmind.nexomark` y el SHA-1 de la firma | Nada en la app: Google solo exige que exista |
| Servidor | — | Los dos ID, separados por coma, en `GOOGLE_CLIENT_IDS_NATIVOS` de `backend/.env` |

SHA-1 de la firma de Android (hoy la compilación release también firma con la
clave debug, `android/app/build.gradle.kts`, así que basta uno):

```bash
cd android && ./gradlew signingReport   # buscar «SHA1» en la variante debug
```

Si la pantalla de consentimiento está en modo *Testing*, solo entran las cuentas
agregadas como usuarios de prueba. Los scripts `tool/run_iphone.sh` y
`tool/instalar_iphone_release.sh` pasan solos el `--dart-define=GOOGLE_IOS_CLIENT_ID`
cuando existe `Google.xcconfig`.

## Decisiones

- **Voz en el dispositivo.** `speech_to_text` transcribe en el teléfono; el canal
  nativo `nexomark/voz` (`MainActivity.kt`, `AppDelegate.swift`) dice con
  certeza si hay español para dictar sin conexión. Si no, el aviso cambia a
  "el sistema puede enviar el audio a Google/Apple". A Django solo llega el texto.
- **Conectar redes** con `flutter_web_auth_2` (ASWebAuthenticationSession / Custom
  Tabs). Django vuelve por `nexomark://oauth/<red>#code&state`; el canje exige el
  JWT del mismo usuario que inició la conexión.
- **Destinos sin marcar por defecto**: publicar en una cuenta real es una decisión explícita.
- **Diseño** (dirección C · Conforme, 31/10): la mesa marina enmarca, el trabajo va en un
  pliego con marcas de corte y la navegación es la orden de trabajo (casillas). Detalle de
  marco, navegación, gestos, hápticos, tamaños y movimiento en `DESIGN.md`.
- **Movimiento** (`lib/core/theme/motion.dart`): 140–240 ms en la interfaz, 420 ms solo para el
  sello del cliente, nada desde escala 0 y todo se apaga con "reducir movimiento".
- **Pantalla de carga** (`features/auth/splash_screen.dart`): momento firma, una vez por
  arranque (0,8 s). La N es `widgets/nexo_mark_logo.dart`, dos `Path` ajustados al maestro
  de `brand/`: la pieza clara y la turquesa parten separadas por la diagonal, encajan y el
  nombre se funde. Termina en el mismo tamaño y lugar que el arranque nativo (120 pt al
  centro). `SplashGate` retiene la entrada hasta que acaba (como mucho 0,8 s, y nada si la
  sesión tarda más) y el reloj arranca con el primer cuadro a la vista. Con "reducir
  movimiento" la N ya está encajada y solo se funde el nombre.

## Pruebas

```bash
flutter analyze && flutter test
```
