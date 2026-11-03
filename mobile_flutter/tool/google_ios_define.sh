# Se incluye desde los scripts del iPhone: deja en GOOGLE_DEFINE el --dart-define
# del client ID de iOS si existe ios/Flutter/Google.xcconfig (o la variable de entorno).
GOOGLE_IOS="${GOOGLE_IOS_CLIENT_ID:-$(sed -n 's/^GOOGLE_IOS_CLIENT_ID = //p' ios/Flutter/Google.xcconfig 2>/dev/null)}"
GOOGLE_DEFINE=()
[[ -n "$GOOGLE_IOS" ]] && GOOGLE_DEFINE=(--dart-define=GOOGLE_IOS_CLIENT_ID="$GOOGLE_IOS")
