# NexoMark IA — app Flutter

Actualizado el 30 de octubre de 2026. Integración en `piero` importada desde
`origin/remejora` (`61798c7c`), adaptada al backend actual. No se fusionaron los
backends ni las pantallas web de esa rama. La app Kotlin de `mobile/` permanece
separada. Se utiliza el PNG aprobado de NexoMark y su paleta clara/oscura.

## Alcance actual

- Acceso y registro con correo y contraseña, almacenamiento seguro de sesión y renovación JWT.
- Perfil, foto privada, cambio de correo con doble confirmación y contraseña.
- Listado y detalle de campañas, dictado local de instrucciones, edición y generación.
  Crear una campaña ya inicia la generación: no se repite `/generate/`.
- Envío a revisión y revisión del cliente mediante Spring, sin publicación automática.
- Lectura de cuentas conectadas y estadísticas guardadas de las cuatro redes;
  los contadores desconocidos siguen siendo nulos y X muestra impresiones.

Son funciones implementadas y cubiertas por pruebas de contratos con HTTP
simulado. La instalación real no acredita haber probado todos sus flujos.

## Límites que siguen pendientes

- Conectar/desconectar redes, publicar, variantes de X y consultar contadores
  externos se realizan en la **web**. La app lee los registros guardados;
  recargar estadísticas móviles no llama a las APIs sociales ni gasta presupuesto X.
- Google nativo está deshabilitado: el backend actual exige un Origin de navegador.
  Un client ID móvil por sí solo no habilita ese flujo; no se falsifica el encabezado.
- No hay `/api/intents/` ni `/api/social/` en el backend actual. El dictado se conserva
  como instrucciones y los campos se completan manualmente, sin afirmar extracción por IA.
- La lista utiliza imágenes completas porque no hay `/miniatura/`; puede consumir
  más datos y memoria. El nuevo dashboard comparativo y ranking web no se portaron al móvil.
- iOS se conserva como código fuente y no fue compilado ni probado en un dispositivo;
  necesita un Mac con Xcode y su configuración de firma.

## Requisitos

- Flutter 3.47 o superior compatible con las dependencias bloqueadas en `pubspec.lock`.
- Android SDK y una herramienta de Java compatible con el proyecto Android.
- PostgreSQL y los servidores de la laptop: Django en `8000` y Spring en `8080`.
- Configuración privada del backend en su entorno local; nunca se incorpora al APK.

En esta laptop se usa el SDK aislado
`C:\Users\piero\.cache\tooling\flutter-3.47.5`, sin sustituir `C:\flutter`
(3.35.3, insuficiente para las dependencias actuales). El script intenta localizar
ese SDK y permite indicar otro mediante `-FlutterPath`.

## Android físico por USB — PowerShell

Ruta comprobada con un Samsung Galaxy A56 el 30/10/2026:

1. Activar Opciones de desarrollador → Depuración USB y conectar un cable de datos.
2. Autorizar la computadora en el teléfono y mantener los servidores encendidos.
3. Desde `mobile_flutter/`, ejecutar:

```powershell
$adb = "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
& $adb devices

# Sustituir por el ID que aparece como «device»; no por «unauthorized».
$phoneId = 'ID_DEL_CELULAR'
& $adb -s $phoneId reverse tcp:8000 tcp:8000
& $adb -s $phoneId reverse tcp:8080 tcp:8080
.\tool\run_android.ps1 -DeviceId $phoneId -ApiHost 127.0.0.1
```

La app accede a la laptop por esos puertos reenviados por USB. No hace falta
exponer Django a la red ni cambiar `ALLOWED_HOSTS` para este método. Mantener el
cable conectado y repetir `reverse` tras reconectar/reiniciar. Si no cambió el
código y el APK sigue instalado, basta restablecer los dos puertos y abrir el
icono de NexoMark. Si cambió el código, repetir el script para recompilar/instalar.

## Emulador Android

Abrir el emulador desde Android Studio y, desde esta carpeta:

```powershell
.\tool\run_android.ps1 -DeviceId emulator-5554
```

El valor por defecto `10.0.2.2` representa la laptop desde el emulador. Django
debe aceptar ese host. La configuración de desarrollo actual ya lo incluye;
no es necesario usar un comodín en `ALLOWED_HOSTS`.

## Red local y otras direcciones

Para una prueba por Wi-Fi, ambos equipos deben tener conectividad y se configura
la IP de la laptop explícitamente. Django debe escuchar en esa interfaz, aceptar
esa IP y el firewall debe permitir los puertos necesarios. No se configuró ni
verificó este método en la prueba del A56; por USB no es necesario.

```powershell
.\tool\run_android.ps1 -DeviceId ID_DEL_CELULAR -ApiHost IP_DE_LA_LAPTOP
```

| `--dart-define` | Uso |
|---|---|
| `API_HOST` | Host del backend; Android usa `10.0.2.2` e iOS `localhost` por defecto. |
| `DJANGO_URL`, `SPRING_URL` | URLs completas, si se dispone de un entorno HTTPS configurado. |

Un APK no contiene ni despliega Django, Spring, PostgreSQL, n8n o los servicios
externos. No se promete funcionamiento independiente de la laptop en esta etapa.

## Voz, marca y movimiento

El dictado móvil usa `speech_to_text` y el reconocimiento del dispositivo. El
proveedor del sistema puede recibir audio cuando el reconocimiento no es local;
a NexoMark se envía el texto confirmado. El permiso de micrófono y la disponibilidad
del reconocimiento deben comprobarse en el dispositivo.

La marca usa `assets/brand/nexomark-icon.png`, copia del maestro aprobado de
`brand/`. La animación de entrada encaja sus piezas, respeta reducir movimiento
y utiliza las mismas dimensiones que el arranque nativo. Las pruebas verifican
el estado final frente al icono aprobado; no sustituye una revisión visual de todos los equipos.

## Verificación

- `flutter analyze --no-pub`: sin incidencias; `flutter test --no-pub`: 59 pruebas correctas.
- APK debug compilado para emulador Android x64 y, posteriormente, para el A56.
- El 30/10/2026 se instaló y arrancó en el A56, se comprobó su proceso y los puertos
  USB. Django respondió HTTP 200; Spring estaba escuchando en 8080. Esto no acredita
  login completo, generación o aprobación real desde el teléfono.
- Pendientes: ambos roles de extremo a extremo, micrófono/dictado, cambios de perfil,
  generación con créditos y revisión contra Spring en el dispositivo.
- Aviso no bloqueante: `flutter_web_auth_2` aplica Kotlin Gradle Plugin. Revisar
  compatibilidad antes de futuras actualizaciones de Flutter/AGP u OAuth nativo.

El APK queda en `build/app/outputs/flutter-apk/app-debug.apk` y no se versiona.
Tampoco se suben `.env`, `local.properties`, keystores, configuraciones privadas de
OAuth, sesiones, cachés ni credenciales de demostración.

Para repetir las comprobaciones, usando el SDK compatible:

```powershell
flutter pub get
flutter analyze --no-pub
flutter test --no-pub
```
