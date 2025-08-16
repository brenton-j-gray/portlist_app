param(
  [string]$ProjectPath,
  [string]$AvdName = "android-medium",
  [switch]$ColdBoot
)

$ErrorActionPreference = "Stop"

# =========================
# Project root resolution
# =========================
function Resolve-ProjectRoot {
  param([string[]]$StartDirs)
  foreach ($start in $StartDirs) {
    if (-not $start) { continue }
    if (-not (Test-Path $start)) { continue }
    $cur = (Get-Item $start)
    while ($cur) {
      $pkg = Join-Path $cur.FullName "package.json"
      if (Test-Path $pkg) { return $cur.FullName }
      $cur = $cur.Parent
    }
  }
  return $null
}

$Candidates = @(
  $ProjectPath,
  (Get-Location).Path,
  $PSScriptRoot,
  (Join-Path $PSScriptRoot "..")
)

Write-Host "=== Project root detection ==="
Write-Host "PSScriptRoot         : $PSScriptRoot"
Write-Host "Invocation Directory : $((Get-Location).Path)"
Write-Host "Provided ProjectPath : $ProjectPath"

$ResolvedRoot = Resolve-ProjectRoot -StartDirs $Candidates
if (-not $ResolvedRoot) {
  Write-Host "Tried these start dirs:" -ForegroundColor Yellow
  $Candidates | ForEach-Object { Write-Host " - $_" }
  throw "Couldn't find package.json. Pass -ProjectPath 'C:\path\to\project' explicitly."
}

$ProjectPath = $ResolvedRoot
Write-Host "Resolved Project Root: $ProjectPath"
Write-Host "package.json exists  : $(Test-Path (Join-Path $ProjectPath 'package.json'))"
Write-Host "==============================="

# =========================
# Android SDK + tools
# =========================
function Find-AndroidSDK {
  if ($env:ANDROID_HOME) { return $env:ANDROID_HOME }
  if ($env:ANDROID_SDK_ROOT) { return $env:ANDROID_SDK_ROOT }
  foreach ($p in @(
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:APPDATA\Local\Android\Sdk",
    "C:\Android\Sdk"
  )) { if (Test-Path $p) { return $p } }
  throw "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
}

$Sdk = Find-AndroidSDK
$Emulator = Join-Path $Sdk "emulator\emulator.exe"
$Adb      = Join-Path $Sdk "platform-tools\adb.exe"
if (-not (Test-Path $Emulator)) { throw "emulator.exe not found under $Sdk" }
if (-not (Test-Path $Adb))      { throw "adb.exe not found under $Sdk" }

# Make sure adb is healthy
& $Adb kill-server 2>$null | Out-Null
& $Adb start-server | Out-Null

# =========================
# Start emulator (if needed)
# =========================
$devicesList = & $Adb devices
$emulatorRunning = ($devicesList -match "^emulator-").Count -gt 0
if (-not $emulatorRunning) {
  Write-Host "Starting Android emulator: $AvdName"
  $args = @("-avd", $AvdName, "-netdelay", "none", "-netspeed", "full")
  if ($ColdBoot) { $args += "-no-snapshot-load" }
  Start-Process -FilePath $Emulator -ArgumentList $args | Out-Null
}

# Find the specific emulator ID like emulator-5554
function Get-EmulatorId {
  param([int]$TimeoutSec = 180)
  $stop = (Get-Date).AddSeconds($TimeoutSec)
  do {
    $out = & $Adb devices
    $id = ($out | Select-String "^emulator-\d+\s+device").Matches.Value -replace "\s+device",""
    if ($id) { return $id }
    Start-Sleep -Seconds 2
  } while (Get-Date) -lt $stop
  throw "Timed out waiting for emulator to appear in 'adb devices'."
}
$DeviceId = Get-EmulatorId

Write-Host "Waiting for $DeviceId to be ready..."
& $Adb -s $DeviceId wait-for-device | Out-Null

# Wait for full boot (check both props)
$bootComplete = $false
for ($i=0; $i -lt 180; $i++) {
  $sys = (& $Adb -s $DeviceId shell getprop sys.boot_completed 2>$null).Trim()
  $dev = (& $Adb -s $DeviceId shell getprop dev.bootcomplete 2>$null).Trim()
  if ($sys -eq "1" -or $dev -eq "1") { $bootComplete = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $bootComplete) { throw "Emulator $DeviceId did not finish booting in time." }

# Reverse ports so Metro/Expo connects
foreach ($p in 8081,19000,19001) {
  try { & $Adb -s $DeviceId reverse "tcp:$p" "tcp:$p" 2>$null } catch {}
}

# =========================
# Open VS Code
# =========================
Write-Host "Opening VS Code..."
Start-Process -FilePath "code" -ArgumentList $ProjectPath | Out-Null

# =========================
# Find npx.cmd (Windows)   prefer %AppData%\npm\npx.cmd
# =========================
function Find-Npx {
  $order = @(
    "$env:APPDATA\npm\npx.cmd",                  # typical location
    (Get-Command npx.cmd -ErrorAction SilentlyContinue)?.Source,
    (Get-Command npx -ErrorAction SilentlyContinue)?.Source,
    "$env:PROGRAMFILES\nodejs\npx.cmd",
    "$env:PROGRAMFILES(x86)\nodejs\npx.cmd"
  ) | Where-Object { $_ } | Select-Object -Unique

  foreach ($p in $order) { if (Test-Path $p) { return $p } }
  return $null
}
$Npx = Find-Npx
if (-not $Npx) {
  throw "Could not find npx.cmd. Ensure Node.js is installed and that %AppData%\npm is on PATH."
}
Write-Host "Using NPX           : $Npx"

# =========================
# Start Expo (no --android) in a visible terminal
# =========================
Write-Host "Starting Expo (Metro) in a new terminal..."
$launcher = Join-Path ([System.IO.Path]::GetTempPath()) ("expo-launch-" + [guid]::NewGuid().ToString() + ".ps1")
$launcherContent = @"
Write-Host "Expo launcher running in: $ProjectPath"
Set-Location -LiteralPath "$ProjectPath"
Write-Host "Using NPX at: $Npx"
& "$Npx" expo start
"@
Set-Content -Path $launcher -Value $launcherContent -Encoding UTF8

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
  Start-Process wt.exe -ArgumentList @(
    "-w","0","new-tab","PowerShell","-NoExit",
    "-ExecutionPolicy","Bypass","-File", $launcher
  ) | Out-Null
} else {
  $shell = Get-Command pwsh -ErrorAction SilentlyContinue
  if (-not $shell) { $shell = Get-Command powershell -ErrorAction SilentlyContinue }
  Start-Process $shell.Source -ArgumentList @(
    "-NoExit","-ExecutionPolicy","Bypass","-File", $launcher
  ) | Out-Null
}

# =========================
# Wait for Metro (19000), then launch Expo Go and open the project
# =========================
function Wait-ForPort {
  param([string]$Host, [int]$Port, [int]$TimeoutSec = 180)
  $stop = (Get-Date).AddSeconds($TimeoutSec)
  do {
    try {
      if (Test-NetConnection -ComputerName $Host -Port $Port -InformationLevel Quiet) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $stop)
  return $false
}

Write-Host "Waiting for Metro (127.0.0.1:19000)..."
if (Wait-ForPort -Host "127.0.0.1" -Port 19000 -TimeoutSec 240) {
  Write-Host "Metro is up. Launching Expo Go on $DeviceId..."
  try {
    # Launch Expo Go if installed
    & $Adb -s $DeviceId shell monkey -p host.exp.exponent -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  } catch {}

  # Open the project in Expo Go via deep link (adb reverse makes 127.0.0.1 reachable)
  & $Adb -s $DeviceId shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:19000" | Out-Null
  Write-Host "Sent deep link to Expo Go: exp://127.0.0.1:19000"
} else {
  Write-Warning "Metro did not open port 19000 in time. Open Expo Go manually and choose the project, or switch Expo connection to Tunnel."
}

Write-Host "All set. Emulator: $DeviceId  |  Project: $ProjectPath"

# === Auto-open Expo Go once Metro is ready ===
function Wait-ForExpo {
  param([int]$TimeoutSec = 240)
  $stop = (Get-Date).AddSeconds($TimeoutSec)
  do {
    $ok = $false
    try {
      # Expo serves a simple status endpoint on 19000
      $resp = Invoke-WebRequest -Uri "http://127.0.0.1:19000/status" -TimeoutSec 3 -UseBasicParsing
      if ($resp.StatusCode -eq 200) { $ok = $true }
    } catch { $ok = $false }

    if ($ok) { return $true }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $stop)
  return $false
}

Write-Host "Waiting for Metro on 19000..."
if (Wait-ForExpo -TimeoutSec 240) {
  Write-Host "Metro is ready. Opening in Expo Go..."
  try {
    # Make sure Expo Go is running
    & $Adb -s $DeviceId shell monkey -p host.exp.exponent -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  } catch {}

  # Deep link the project
  & $Adb -s $DeviceId shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:19000" | Out-Null
  Write-Host "Sent deep link to Expo Go: exp://127.0.0.1:19000"
} else {
  Write-Warning "Metro did not respond on 19000 in time. Open Expo DevTools and switch Connection to Tunnel or press 'a' in the Expo window."
}

