# Menjalankan aplikasi ujian dan membukanya ke internet lewat Cloudflare Quick Tunnel.
# Alamat *.trycloudflare.com acak dan berganti setiap kali skrip ini dijalankan.
# Tutup jendela ini atau tekan Ctrl+C untuk menghentikan server dan tunnel.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 4000
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cloudflared)) { $cloudflared = 'cloudflared' }

function Test-Port($p) {
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $p); return $true } catch { return $false } finally { $c.Close() }
}

Write-Host '== Hosting Ujian Online lewat Cloudflare ==' -ForegroundColor Cyan

if (-not (Test-Port 3306)) {
  Write-Host 'MariaDB belum jalan. Buka XAMPP Control Panel lalu Start MySQL, kemudian jalankan skrip ini lagi.' -ForegroundColor Red
  Read-Host 'Tekan Enter untuk keluar'; exit 1
}
if (Test-Port $port) {
  Write-Host "Port $port sudah dipakai. Hentikan server lama (npm run dev / node) dulu." -ForegroundColor Red
  Read-Host 'Tekan Enter untuk keluar'; exit 1
}

Write-Host '[1/3] Build frontend...'
npm run build --prefix "$root\frontend"
if ($LASTEXITCODE -ne 0) { Write-Host 'Build frontend gagal.' -ForegroundColor Red; Read-Host 'Tekan Enter untuk keluar'; exit 1 }

$logDir = Join-Path $env:TEMP 'ujian-cloudflare'
New-Item -ItemType Directory -Force $logDir | Out-Null
$tunnelLog = Join-Path $logDir 'tunnel.log'
Remove-Item $tunnelLog -ErrorAction SilentlyContinue

Write-Host '[2/3] Menjalankan server...'
$server = Start-Process node -ArgumentList 'src/server.js' -WorkingDirectory "$root\backend" -NoNewWindow -PassThru
$tunnel = $null
try {
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try { Invoke-RestMethod "http://localhost:$port/api/health" -TimeoutSec 2 | Out-Null; $ok = $true; break } catch {}
  }
  if (-not $ok) { throw 'Server tidak merespons di port 4000. Periksa pesan error di atas.' }

  Write-Host '[3/3] Membuka tunnel Cloudflare...'
  $tunnel = Start-Process $cloudflared -ArgumentList 'tunnel', '--no-autoupdate', '--url', "http://localhost:$port", '--logfile', $tunnelLog -WindowStyle Hidden -PassThru

  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
    if ($tunnel.HasExited) { throw "cloudflared berhenti. Lihat log: $tunnelLog" }
  }
  if (-not $url) { throw "Alamat tunnel tidak muncul dalam 60 detik. Lihat log: $tunnelLog" }

  try { Set-Clipboard $url } catch {}
  Write-Host ''
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host "  Aplikasi online di: $url" -ForegroundColor Green
  Write-Host '  (alamat sudah disalin ke clipboard)' -ForegroundColor Green
  Write-Host '  Biarkan jendela ini terbuka selama ujian berlangsung.' -ForegroundColor Green
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host ''

  while (-not $server.HasExited -and -not $tunnel.HasExited) { Start-Sleep -Seconds 2 }
  if ($server.HasExited) { Write-Host 'Server berhenti.' -ForegroundColor Red }
  if ($tunnel.HasExited) { Write-Host "Tunnel berhenti. Lihat log: $tunnelLog" -ForegroundColor Red }
} catch {
  Write-Host $_ -ForegroundColor Red
} finally {
  if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force }
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
  Read-Host 'Tekan Enter untuk menutup'
}
