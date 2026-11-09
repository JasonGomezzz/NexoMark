#!/bin/zsh
# Compila en release e instala en el iPhone de Jason (iOS no abre builds debug
# desde la pantalla de inicio).
#
# Uso:
#   tool/instalar_iphone_release.sh              → backend de Render (no necesita el Mac encendido)
#   tool/instalar_iphone_release.sh local        → Django y Spring del Mac en la misma Wi-Fi
#                                                  (runserver 0.0.0.0:8000; API_HOST=<ip> fuerza la IP)
set -e
cd "$(dirname "$0")/.."
source tool/google_ios_define.sh
if [[ "${1:-}" == "local" ]]; then
  IP="${API_HOST:-$(ipconfig getifaddr en0)}"
  DESTINO=(--dart-define=API_HOST="$IP")
  echo "Backend: Mac en http://$IP:8000"
else
  DESTINO=(
    --dart-define=DJANGO_URL=https://marketmind-django.onrender.com
    --dart-define=SPRING_URL=https://marketmind-springboot.onrender.com
  )
  echo "Backend: Render (marketmind-django y marketmind-springboot)"
fi
echo "Google en iOS: ${GOOGLE_IOS:-sin configurar}"
/Users/jason/dev/flutter/bin/flutter build ios --release "${DESTINO[@]}" "${GOOGLE_DEFINE[@]}"
xcrun devicectl device install app --device 00008150-000A4DDE2E8B401C build/ios/iphoneos/Runner.app
