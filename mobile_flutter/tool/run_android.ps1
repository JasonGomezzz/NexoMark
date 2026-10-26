param(
    [string]$DeviceId = 'emulator-5554',
    [string]$ApiHost = '10.0.2.2',
    [string]$FlutterPath = ''
)
$ErrorActionPreference = 'Stop'
if (-not $FlutterPath) {
    $isolatedSdk = Join-Path $env:LOCALAPPDATA '../../.cache/tooling/flutter-3.47.5/bin/flutter.bat'
    $isolatedSdk = [IO.Path]::GetFullPath($isolatedSdk)
    if (Test-Path -LiteralPath $isolatedSdk) { $FlutterPath = $isolatedSdk }
    else {
        $flutterCommand = Get-Command flutter -ErrorAction SilentlyContinue
        if (-not $flutterCommand) { throw 'Instala Flutter >= 3.47 o indica -FlutterPath con la ruta a flutter.bat.' }
        $FlutterPath = $flutterCommand.Source
    }
}
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    & $FlutterPath pub get
    if ($LASTEXITCODE -ne 0) { throw 'No se resolvieron las dependencias. Revisa que el SDK sea Flutter >= 3.47.' }
    & $FlutterPath run -d $DeviceId "--dart-define=API_HOST=$ApiHost"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar la app. Revisa el emulador y el SDK Android.' }
} finally { Pop-Location }
