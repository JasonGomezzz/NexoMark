# NexoMark IA — app Flutter (Android e iOS)

## Integración local con `piero` (26/10/2026)

Importada **solo `mobile_flutter/`** desde `origin/remejora` en `61798c7c`.
No se fusionó toda la rama: no se modifican Django, Spring, la web ni la app
Kotlin de `mobile/`. Se conserva el PNG aprobado de la marca de `piero`.
Los dos tests compartidos web/móvil solo ajustan las rutas de la nueva estructura.

### Qué se puede probar con este backend

- Acceso/registro con correo y contraseña, sesión cifrada y renovación JWT.
- Perfil, foto privada, cambio de correo con doble confirmación y contraseña.
- Listar/detallar campañas, dictar instrucciones localmente y completar sus
  campos manualmente antes de crear/generar. La creación ya genera contenido:
  **no** se llama una segunda vez a `/generate/`.
- Enviar a revisión sin publicación automática; el cliente revisa desde Spring.
- Estadísticas guardadas de las cuatro redes, con nulos preservados, series
  mensuales e impresiones de X correctamente identificadas.

### Límites deliberados: no se presentan como funciones terminadas

- Este backend no tiene `/api/intents/` ni `/api/social/`. No se afirma que una
  IA haya extraído campos del dictado: el texto queda en instrucciones y se
  completan los campos. No se envía la medición voz/formulario de la otra rama.
- Conectar/desconectar redes, publicar, variantes de X y actualizar contadores
  externos se realizan **en la web**, no desde esta integración nativa. La app
  puede leer las cuentas y contadores ya guardados; no se modifican permisos,
  no se consume presupuesto X y aprobar no publica automáticamente.
- Google nativo permanece deshabilitado: el servidor actual valida un Origin
  de navegador. No se falsifica ese encabezado ni se debilita su validación.
- La lista actual incluye imágenes completas porque no existe `/miniatura/`;
  puede consumir más memoria y datos que la versión liviana de `remejora`.
- No se han portado al móvil el nuevo dashboard comparativo ni el ranking web.
- iOS se conserva como código fuente; compilarlo/firmarlo requiere un Mac.

### Emulador Android en esta laptop (PowerShell)

Se preparó un SDK aislado en
`C:\Users\piero\.cache\tooling\flutter-3.47.5`, sin sustituir `C:\flutter`
(que contiene Flutter 3.35.3, insuficiente para las dependencias importadas).

1. Arranca PostgreSQL, Django en `:8000` y Spring en `:8080` como habitualmente.
2. Abre el emulador desde Android Studio. No es necesario iniciar uno desde el script.
3. En esta carpeta ejecuta:

```powershell
.\tool\run_android.ps1 -DeviceId emulator-5554
```

Por defecto usa `10.0.2.2`, que representa la laptop desde el emulador Android.
Django debe aceptar ese host; si devuelve `DisallowedHost`, añade **solo**
`10.0.2.2` a `ALLOWED_HOSTS` de tu `.env` local y reinicia Django. No uses `*`.
Para un teléfono físico, configura tu IP local explícitamente y escucha en la
interfaz de red solo cuando vayas a probar; no hace falta para el emulador.
No pases contraseñas ni claves al comando, ni subas `.env`, `local.properties`,
keystores, archivos de firma, cachés o APKs al repositorio.

La documentación que sigue describe la app original de `remejora`; las funciones
que difieran del contrato actual están limitadas por lo descrito arriba.

### Validación de esta integración

- Flutter 3.47.5 / Dart 3.13.4, instalados en caché separada.
- `flutter analyze --no-pub`: sin incidencias.
- `flutter test --no-pub`: 59 pruebas correctas, incluidas pruebas de contratos
  con HTTP simulado (no generación real, envío de correo ni publicación).
- Pruebas compartidas del frontend: 94 correctas; lint sin errores.
- `flutter build apk --debug --target-platform android-x64 --no-pub`: correcto.
  APK local en `build/app/outputs/flutter-apk/app-debug.apk`; no se versiona.
- Pendiente: login real de ambos roles, acceso a los servidores desde el
  emulador, micrófono/permiso de voz, generación con créditos reales y
  aprobación contra Spring. No se ha instalado ni ejecutado el APK en un dispositivo.
- Aviso no bloqueante de Gradle: `flutter_web_auth_2` usa KGP; revisar esa
  dependencia antes de actualizar nuevamente Flutter/AGP o habilitar OAuth nativo.

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
