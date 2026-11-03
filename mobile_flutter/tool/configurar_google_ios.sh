#!/bin/zsh
# Guarda el client ID de iOS de Google para compilar la app (no se sube a git).
# Uso: tool/configurar_google_ios.sh 1234-abcd.apps.googleusercontent.com
# Escribe ios/Flutter/Google.xcconfig con el client ID y su esquema invertido;
# tool/run_iphone.sh y tool/instalar_iphone_release.sh lo pasan como --dart-define.
set -e
cd "$(dirname "$0")/.."
ID="$1"
if [[ "$ID" != *.apps.googleusercontent.com ]]; then
  echo "Pasa el client ID de iOS completo (termina en .apps.googleusercontent.com)." >&2
  exit 1
fi
PREFIJO="${ID%.apps.googleusercontent.com}"
cat > ios/Flutter/Google.xcconfig <<XC
GOOGLE_IOS_CLIENT_ID = $ID
GOOGLE_REVERSED_CLIENT_ID = com.googleusercontent.apps.$PREFIJO
XC
echo "Listo: ios/Flutter/Google.xcconfig. Agrega este ID también a GOOGLE_CLIENT_IDS_NATIVOS en backend/.env."
