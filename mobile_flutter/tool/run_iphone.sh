#!/bin/zsh
# Corre la app en el iPhone de Jason contra el backend del Mac (misma Wi-Fi).
# Uso: tool/run_iphone.sh [marketero|cliente]
# En depuración precarga el usuario de prueba del README (no existe en release).
set -e
cd "$(dirname "$0")/.."
ROL="${1:-marketero}"
IP="${API_HOST:-$(ipconfig getifaddr en0)}"
exec /Users/jason/dev/flutter/bin/flutter run -d 00008150-000A4DDE2E8B401C \
  --dart-define=API_HOST="$IP" \
  --dart-define=DEMO_EMAIL="$ROL@test.com" \
  --dart-define=DEMO_PASSWORD='MarketMind2026!'
