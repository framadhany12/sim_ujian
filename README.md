# Ujian Online — Politeknik TEDC

Sistem ujian seleksi calon mahasiswa. Dua peran: **Admin** dan **Calon Mahasiswa** (peserta tidak mendaftar sendiri; akun dibuat Admin).
PRD lengkap: `sistem-ujian-online-PRD.md`.

**Stack:** React 19 + Vite + Tailwind v4 (frontend) · Node.js + Express + Prisma 6 (backend) · MySQL/MariaDB (XAMPP) · Socket.IO (pemantauan) · JWT + bcrypt.

## Menjalankan

Prasyarat: Node 20+, MySQL/MariaDB menyala (XAMPP).

```bash
npm run install:all                 # sekali saja, dari folder root
# buat database (sekali): CREATE DATABASE ujian_online CHARACTER SET utf8mb4;
cp backend/.env.example backend/.env   # lalu sesuaikan DATABASE_URL & JWT_SECRET
cd backend && npx prisma migrate deploy && npm run seed && cd ..
npm run dev                         # API :4000 + web :5173
```

Admin awal (seed): `admin` / `admin12345` — ganti lewat menu **Ganti password**.
Bila login macet, pastikan tidak ada dua server Vite berjalan sekaligus (matikan semua proses `node`, jalankan ulang).

## Struktur

```
backend/
  prisma/schema.prisma, migrations/   skema + riwayat migrasi (MySQL)
  src/server.js                       Express + Socket.IO + CORS (localhost:* diizinkan)
  src/lib.js                          auth/JWT, audit, penilaian (gradeAttempt), timer, shuffle berbenih
  src/sheets.js                       parser xlsx/csv toleran + pembuat template Excel (exceljs)
  src/routes/{auth,peserta,admin}.js  /api/auth, /api/me (peserta), /api/admin
frontend/src/
  components/                         AppShell (sidebar+topbar), AdminLayout, PesertaLayout, Logo, ui.jsx, ExamTimer
  pages/                              Login, ChangePassword, Jadwal(Ruang Ujian), ExamPage, Hasil, TataTertib
  pages/admin/                        Dashboard, Peserta, Grup, Ujian, SusunSoal, Token, Soal(Bank), Monitor, Nilai
frontend/public/                      logo.png (wordmark), favicon.png
```

## Model data & aturan penting

- **Grup** (`groups`): dibuat dinamis (mis. `kip2026`). Peserta punya **satu** grup. Ujian dipilihkan **grup pelaksana** (`exam_groups`); peserta hanya melihat ujian untuk grupnya. Ujian tanpa grup tidak tampil ke siapa pun.
- **Ujian Tersedia** (`exams`): judul, petunjuk, durasi, nilai kelulusan, acak soal, tampilkan hasil, **aktif/nonaktif**. Tidak ada jadwal/token di sini.
- **Token Ujian** (`exam_tokens`): dibuat otomatis (6 karakter) untuk satu ujian dengan masa berlaku 30 menit / 1 jam / 4 jam / 12 jam / 1 hari. Token baru mencabut token lama ujian yang sama. Token hanya untuk **masuk**; peserta yang sudah mulai tetap menyelesaikan ujiannya. Syarat membuat token: ujian aktif, punya soal, punya grup.
- **Bank Soal** (`questions`): umum, bukan milik ujian; punya `kategori` dan bobot bawaan. **Ujian memilih soal** lewat `exam_questions` (urutan + bobot khusus ujian, `NULL` = pakai bobot bawaan). Soal yang pernah dikerjakan tidak dapat dihapus.
- **Penilaian**: skor = persen dari total bobot ujian (bobot efektif = `exam_questions.bobot ?? questions.bobot`). PG/benar-salah otomatis; esai manual. Status `belum` sampai semua esai dinilai. Status lulus dihitung saat submit/nilai esai.
- **Timer** dihitung di server: `waktuMulai + durasi`; jawaban setelah itu ditolak dan sesi otomatis diselesaikan.
- **Pemantauan**: Socket.IO + polling; event keluar halaman, reconnect, heartbeat (koneksi terputus bila >45 dtk).
- Password peserta wajib diganti saat login pertama; Admin dapat mengatur/reset password lewat **Peserta → Ubah → Password**.

## Impor / ekspor

Template Excel (dropdown, lembar Petunjuk) tersedia di Peserta dan Bank Soal. Impor selalu lewat **pratinjau** (baris valid/bermasalah + alasan, nomor baris sesuai Excel) sebelum disimpan. Menerima `.xlsx/.xls/.csv` (koma/titik koma), header toleran (alias), maks. 5 MB / 2000 baris. Ekspor peserta & bank soal memakai format yang dapat diimpor ulang.

## Menu Admin (sidebar)

Dashboard · Ujian Tersedia · Token Ujian · Pantau Ujian · Bank Soal · Kelola Grup · Peserta · Nilai & Laporan.
Alur: buat grup → tambah/impor peserta (pilih grup) → isi Bank Soal → buat ujian (pilih grup) → **Atur soal** (pilih dari bank, atur bobot) → **Token Ujian** (generate) → pantau → nilai esai → rekap/unduh laporan.

## Catatan pengembangan

- Desain mengikuti prototipe HTML di root (`Dashboard.html`, `Ruang-Ujian.html`, `Pengerjaan-Ujian.html`, `Hasil-Ujian.html`) dengan palet biru navy + kuning TEDC (token di `frontend/src/index.css`).
- Layar pengerjaan ujian sengaja tanpa sidebar (fokus).
- Migrasi Prisma ditulis tangan bila perlu menjaga data (lihat `20261015164137_bank_soal_global`).
- Setelah mengubah `schema.prisma`: hentikan server (DLL Prisma terkunci di Windows), `npx prisma migrate dev`, `npx prisma generate`.
- NgodingPakeAI: workspace/plan terhubung (`.ngodingpakeai/config.json`); sync akhir belum dijalankan.
