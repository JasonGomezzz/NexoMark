# CI inicial de MarketMind

El workflow `.github/workflows/ci.yml` cubre los componentes existentes en cinco jobs.
No publica APK/JAR, no despliega, no usa secretos de aplicación ni llama a Gemini o n8n.
Se ejecutará cuando los cambios se publiquen en GitHub; validarlo localmente no equivale a una ejecución alojada.

## Django

Python 3.11.9. En un entorno virtual limpio:

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r backend/requirements/ci.txt -r backend/requirements/ci.in
.venv/bin/python -m pip check
.venv/bin/python scripts/ci/check_backend.py
```

En Ubuntu instalar previamente `libpango-1.0-0`, `libpangoft2-1.0-0` y `libharfbuzz-subset0` para WeasyPrint. En macOS se necesitan las bibliotecas Pango instaladas; si el cargador no las encuentra, establecer `DYLD_FALLBACK_LIBRARY_PATH` al directorio de bibliotecas correspondiente (por ejemplo `/opt/homebrew/lib`).

`check_backend.py` proporciona valores ficticios por proceso, sin modificar `.env`:

- `manage.py check` y `makemigrations --check --dry-run` usan `core.settings.ci_checks`: configuración de producción y SQLite temporal para revisar el estado de migraciones. El chequeo de caché mantiene la declaración Redis real; no prueba disponibilidad de Redis.
- `pytest -q --no-cov --disable-socket` conserva `core.settings.test`, IA simulada, SQLite y LocMemCache. `pytest-socket` bloquea conexiones en la suite. Se guarda JUnit en `ci-artifacts/django.xml`.
- El runner propaga el primer fallo. No crea migraciones ni accede a bases de aplicación.

La cobertura de `pytest.ini` sigue intacta. Por ahora incluye tests/migraciones y omite `services/`; CI no usa ese porcentaje como indicador global ni cambia silenciosamente su umbral. Corregir su alcance requiere un incremento propio.

El lock `requirements/ci.txt` se deriva de `ci.in` y `base.txt`, con hashes de las distribuciones. La instalación usa ambos archivos: un cambio de requisitos incompatible con el lock provoca fallo. Mantiene las versiones directas actuales y fija WeasyPrint 70.0, ya probado; no usa el freeze global divergente que arrastra Celery.

Para regenerar deliberadamente el lock con Python 3.11.9, instalar `pip-tools==7.5.3` en un entorno de herramientas separado y ejecutar desde la raíz:

```sh
python -m piptools compile --generate-hashes --no-emit-index-url --no-emit-trusted-host --output-file=backend/requirements/ci.txt backend/requirements/ci.in
```

Revisar el diff y repetir la instalación limpia y los checks. No añadir `--upgrade` sin evaluar los cambios de dependencias. CI no regenera ni actualiza el lock automáticamente.

## Spring

Java 25.0.2 y Maven 3.9.16 (versiones probadas):

```sh
mvn --batch-mode --no-transfer-progress -DfailIfNoTests=true -f springboot/pom.xml clean verify
```

Incluye compilación, tests y empaquetado; no se usa `-fn` ni `skipTests`, y la ausencia de tests falla explícitamente. El job conserva los informes Surefire incluso si falla. Las pruebas de eventos usan un gestor transaccional simulado: no acreditan locks PostgreSQL.

## React

Node 22.18.0; desde `frontend/`:

```sh
npm ci --no-audit --no-fund
npm run lint
npm test
VITE_API_URL=http://127.0.0.1:8000 VITE_USER_API_URL=http://127.0.0.1:8080 npm run build
```

Se usa `package-lock.json` y las pruebas Node ya existentes. El build de CI fija URLs locales y no se publica. El aviso de tamaño de bundle permanece visible.

## Android

SDK Android 36/build-tools 36.0.0 y JVM JetBrains 21, según los criterios Gradle existentes. El runner Ubuntu provee `ANDROID_HOME`; localmente definirlo si no existe `mobile/local.properties`.

Desde `mobile/`:

```sh
./gradlew --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

Se conserva el wrapper Gradle 9.4.1 y su checksum. El JAR del wrapper, restaurado en el incremento anterior, debe incluirse en la futura base publicada. CI valida el wrapper y guarda JUnit; no firma releases, publica APK ni ejecuta emulador. `--rerun-tasks` permite comprobar localmente sin reutilizar resultados de tareas.

## n8n y sintaxis del workflow CI

Desde la raíz:

```sh
python -m unittest discover -s scripts/ci -p 'test_*.py' -v
python scripts/ci/check_n8n.py
actionlint .github/workflows/ci.yml
```

El validador inspecciona todos los exports `n8n/*.json`: JSON válido, nombres/IDs únicos, conexiones existentes y patrones habituales de claves, JWT, claves privadas y credenciales literales. Los errores no muestran el valor encontrado. Las expresiones y referencias de credenciales son permitidas; no se ejecutan.

También exige el contrato de autenticación de los webhooks: cada webhook responde desde un nodo "Respond to Webhook" y pasa primero por un Code node que compara `x-nexomark-token` con `$env.N8N_WEBHOOK_TOKEN`; ningún HTTP Request toma `callback_url` del payload, y los que llaman a `$env.DJANGO_CALLBACK_BASE_URL` envían `X-NexoMark-Token`. Comprueba la forma del export, no que la instancia desplegada se comporte así.

Es una protección estática acotada, no un escáner exhaustivo de secretos, ni prueba del contrato, HMAC, reintentos o seguridad de n8n. **NO VERIFICADO CONTRA INSTANCIA**. No necesita instalar dependencias Python adicionales.

## Límites y mantenimiento

Sin Flutter ni integraciones pagadas. La prueba PostgreSQL/HTTP/WebSocket del incremento anterior sigue siendo local y separada; este workflow no acredita concurrencia de créditos ni interoperabilidad completa. Se incorporarán pruebas PostgreSQL al cambio que necesite esas garantías.

Las acciones están fijadas por SHA de versiones oficiales; revisar actualizaciones conscientemente. Las cachés aceleran descargas y los informes se retienen siete días. Los paquetes del runner, bibliotecas de sistema y parches JBR 21 pueden cambiar: no es un entorno binariamente inmutable.

Referencias oficiales consultadas para configuración:
[GitHub setup-java](https://github.com/actions/setup-java),
[setup-python](https://github.com/actions/setup-python),
[setup-node](https://github.com/actions/setup-node),
[Gradle Actions](https://github.com/gradle/actions),
[runner Ubuntu 24.04](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md),
[pytest-socket](https://github.com/miketheman/pytest-socket).
