#!/bin/zsh
# Compila en release e instala en el iPhone de Jason (iOS no abre builds debug
# desde la pantalla de inicio). El backend debe escuchar en 0.0.0.0:8000.
# Uso: tool/instalar_iphone_release.sh   (API_HOST=<ip> para forzar la IP del Mac)
set -e
cd "$(dirname "$0")/.."
source tool/google_ios_define.sh
IP="${API_HOST:-$(ipconfig getifaddr en0)}"
echo "Backend: http://$IP:8000 · Google en iOS: ${GOOGLE_IOS:-sin configurar}"
/Users/jason/dev/flutter/bin/flutter build ios --release --dart-define=API_HOST="$IP" "${GOOGLE_DEFINE[@]}"
xcrun devicectl device install app --device 00008150-000A4DDE2E8B401C build/ios/iphoneos/Runner.app
