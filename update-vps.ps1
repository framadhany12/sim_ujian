# Mengirim versi terbaru (commit terakhir) ke VPS dan memasangnya.
# Data ujian, peserta, foto kamera, dan pengaturan .env di VPS tidak ditimpa.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$vps = 'root@203.194.115.166'
$key = Join-Path $env:USERPROFILE '.ssh\ujian_vps'
$site = 'https://akuntansi.ujiantedc.cloud'

Write-Host '== Update Ujian Online ke VPS ==' -ForegroundColor Cyan
try {
  if (-not (Test-Path $key)) { throw "Kunci SSH tidak ditemukan: $key" }

  Push-Location $root
  try {
    $dirty = git status --porcelain --untracked-files=no
    if ($dirty) {
      Write-Host 'Ada perubahan yang BELUM di-commit. Yang dikirim hanya commit terakhir:' -ForegroundColor Yellow
      $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
      $ans = Read-Host 'Lanjutkan tanpa perubahan itu? (y/n)'
      if ($ans -ne 'y') { throw 'Dibatalkan. Commit dulu perubahannya, lalu jalankan lagi.' }
    }
    Write-Host ("Versi: " + (git log -1 --format='%h %s'))
    $pkg = Join-Path $env:TEMP 'ujian-app.tar.gz'
    git archive --format=tar.gz -o $pkg HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Gagal membuat paket kode.' }
  } finally { Pop-Location }

  Write-Host 'Mengirim kode ke VPS...'
  scp -i $key -o BatchMode=yes $pkg "${vps}:/root/app.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw 'Gagal mengirim ke VPS. Periksa koneksi internet.' }
  Remove-Item $pkg -ErrorAction SilentlyContinue

  ssh -i $key -o BatchMode=yes $vps ujian-update
  if ($LASTEXITCODE -ne 0) { throw 'Update di VPS gagal. Lihat pesan di atas.' }

  Write-Host ''
  Write-Host "Selesai. Buka $site (tekan Ctrl+F5 bila tampilan belum berubah)." -ForegroundColor Green
} catch {
  Write-Host $_ -ForegroundColor Red
}
Read-Host 'Tekan Enter untuk menutup'
