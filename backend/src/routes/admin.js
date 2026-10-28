import { Router } from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { listShots, shotFile, removeAttemptShots } from '../camera.js'
import XLSX from 'xlsx'
import { readTable, buildWorkbook, sendBuffer, sendCsv, parseBool, parseNumber, parseTipe, parseBenarSalah, SheetError, MAX_ROWS } from '../sheets.js'
import { effBobot, prisma, wrap, audit, randomPassword, randomToken, gradeAttempt, notifyMonitor } from '../lib.js'

const r = Router()
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (/\.(xlsx|xls|csv)$/i.test(file.originalname) ? cb(null, true) : cb(new SheetError('Format berkas harus .xlsx, .xls, atau .csv'))),
})

const sendSheet = (res, rows, name, format = 'xlsx') => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1')
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
    return res.send('﻿' + XLSX.utils.sheet_to_csv(wb.Sheets.Sheet1))
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`)
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

/* ───────────── Dashboard ───────────── */

r.get('/dashboard', wrap(async (req, res) => {
  const now = new Date()
  const since = new Date(Date.now() - 14 * 86400000)
  const [pesertaAktif, pesertaTotal, ujian, soal, attempts, aktifSekarang, mendatang, logs, perUjian, esaiBelumDinilai, mintaReset, ujianTanpaSoal, terputus, recent] = await Promise.all([
    prisma.user.count({ where: { role: 'peserta', status: 'aktif' } }),
    prisma.user.count({ where: { role: 'peserta' } }),
    prisma.exam.count(),
    prisma.question.count(),
    prisma.examAttempt.groupBy({ by: ['status'], _count: true }),
    prisma.examToken.findMany({ where: { revokedAt: null, expiresAt: { gt: now }, exam: { aktif: true } }, orderBy: { expiresAt: 'asc' }, include: { exam: { select: { judul: true } } } }),
    prisma.exam.findMany({ where: { aktif: true, tokens: { none: { revokedAt: null, expiresAt: { gt: now } } } }, orderBy: { id: 'desc' }, take: 5, select: { id: true, judul: true, durasiMenit: true } }),
    prisma.activityLog.findMany({ where: { event: { notIn: ['heartbeat'] } }, orderBy: { id: 'desc' }, take: 10 }),
    prisma.examAttempt.findMany({ where: { status: 'selesai' }, select: { examId: true, skorTotal: true, statusKelulusan: true } }),
    prisma.answer.count({ where: { nilai: null, question: { tipe: 'esai' }, attempt: { status: 'selesai' } } }),
    prisma.activityLog.count({ where: { event: 'minta_reset' } }),
    prisma.exam.count({ where: { questions: { none: {} } } }),
    prisma.examAttempt.count({ where: { status: 'sedang_mengerjakan', lastSeen: { lt: new Date(Date.now() - 45000) } } }),
    prisma.examAttempt.findMany({ where: { waktuMulai: { gte: since } }, select: { waktuMulai: true } }),
  ])
  const bins = [0, 0, 0, 0, 0]
  for (const x of perUjian) if (x.skorTotal != null) bins[Math.min(4, Math.floor(Number(x.skorTotal) / 20))]++
  const perHari = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000)
    const key = d.toDateString()
    return { tanggal: d.toISOString(), jumlah: recent.filter((r) => r.waktuMulai.toDateString() === key).length }
  })
  const cnt = Object.fromEntries(attempts.map((a) => [a.status, a._count]))
  const scored = perUjian.filter((a) => a.skorTotal != null)
  const avg = scored.length ? scored.reduce((s, a) => s + Number(a.skorTotal), 0) / scored.length : null
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId).filter(Boolean))] } }, include: { profile: true } })
  const nameOf = new Map(users.map((u) => [u.id, u.profile?.namaLengkap ?? u.username]))
  res.json({
    pesertaAktif, pesertaTotal, ujian, soal,
    sedangMengerjakan: cnt.sedang_mengerjakan ?? 0, selesai: cnt.selesai ?? 0,
    rataRata: avg == null ? null : Math.round(avg * 10) / 10,
    lulus: perUjian.filter((a) => a.statusKelulusan === 'lulus').length,
    tidakLulus: perUjian.filter((a) => a.statusKelulusan === 'tidak_lulus').length,
    menungguNilai: perUjian.filter((a) => a.statusKelulusan === 'belum').length,
    aktifSekarang: aktifSekarang.map((t) => ({ id: t.examId, judul: t.exam.judul, expiresAt: t.expiresAt })), tanpaToken: mendatang, distribusiSkor: bins, perHari, esaiBelumDinilai, mintaReset, ujianTanpaSoal, terputus,
    aktivitas: logs.map((l) => ({ id: l.id, event: l.event, detail: l.detail, waktu: l.timestamp, siapa: nameOf.get(l.userId) ?? '-' })),
  })
}))

/* ───────────── Grup ───────────── */

const grupName = (s) => String(s ?? '').trim().slice(0, 60)

r.get('/groups', wrap(async (req, res) => {
  const groups = await prisma.group.findMany({ orderBy: { nama: 'asc' }, include: { _count: { select: { profiles: true, exams: true } } } })
  res.json(groups.map((g) => ({ id: g.id, nama: g.nama, jumlahPeserta: g._count.profiles, jumlahUjian: g._count.exams })))
}))

r.post('/groups', wrap(async (req, res) => {
  const nama = grupName(req.body?.nama)
  if (!nama) return res.status(400).json({ message: 'Nama grup wajib diisi' })
  if (await prisma.group.findUnique({ where: { nama } })) return res.status(409).json({ message: 'Nama grup sudah ada' })
  const g = await prisma.group.create({ data: { nama } })
  await audit(req.user.id, 'buat_grup', nama)
  res.status(201).json(g)
}))

r.put('/groups/:id', wrap(async (req, res) => {
  const nama = grupName(req.body?.nama)
  if (!nama) return res.status(400).json({ message: 'Nama grup wajib diisi' })
  const dup = await prisma.group.findUnique({ where: { nama } })
  if (dup && dup.id !== +req.params.id) return res.status(409).json({ message: 'Nama grup sudah ada' })
  const g = await prisma.group.update({ where: { id: +req.params.id }, data: { nama } })
  await audit(req.user.id, 'ubah_grup', nama)
  res.json(g)
}))

r.delete('/groups/:id', wrap(async (req, res) => {
  const g = await prisma.group.delete({ where: { id: +req.params.id } })
  await audit(req.user.id, 'hapus_grup', g.nama)
  res.json({ ok: true })
}))

// Cari grup menurut nama; buat bila belum ada (dipakai impor)
async function findOrCreateGroup(nama) {
  const n = grupName(nama)
  if (!n) return null
  return (await prisma.group.findUnique({ where: { nama: n } })) ?? prisma.group.create({ data: { nama: n } })
}

/* ───────────── Peserta ───────────── */

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'peserta'
async function uniqueUsername(base) {
  let name = base, n = 1
  while (await prisma.user.findUnique({ where: { username: name } })) name = `${base}${++n}`
  return name
}
async function createPeserta(d, groupId) {
  const username = d.username ? d.username : await uniqueUsername(slug(d.nama_lengkap))
  const password = d.password || randomPassword()
  await prisma.user.create({
    data: {
      username, passwordHash: await bcrypt.hash(password, 10), role: 'peserta', mustChangePassword: true,
      profile: { create: { namaLengkap: d.nama_lengkap, email: d.email || null, groupId: groupId ?? null } },
    },
  })
  return { username, password, nama_lengkap: d.nama_lengkap }
}

r.get('/peserta', wrap(async (req, res) => {
  const users = await prisma.user.findMany({ where: { role: 'peserta' }, include: { profile: { include: { group: true } } }, orderBy: { id: 'desc' } })
  const reqs = await prisma.activityLog.findMany({ where: { event: 'minta_reset' }, select: { userId: true } })
  const asked = new Set(reqs.map((x) => x.userId))
  res.json(users.map((u) => ({
    id: u.id, username: u.username, status: u.status, mustChangePassword: u.mustChangePassword,
    namaLengkap: u.profile?.namaLengkap, email: u.profile?.email,
    groupId: u.profile?.groupId ?? null, grup: u.profile?.group?.nama ?? null,
    mintaReset: asked.has(u.id),
  })))
}))

r.post('/peserta', wrap(async (req, res) => {
  const b = req.body ?? {}
  if (!b.nama_lengkap?.trim()) return res.status(400).json({ message: 'Nama lengkap wajib diisi' })
  if (b.password && String(b.password).length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter' })
  if (b.username && (await prisma.user.findUnique({ where: { username: b.username.trim() } })))
    return res.status(409).json({ message: 'Username sudah dipakai' })
  const groupId = b.groupId ? +b.groupId : null
  if (groupId && !(await prisma.group.findUnique({ where: { id: groupId } }))) return res.status(400).json({ message: 'Grup tidak ditemukan' })
  const cred = await createPeserta({ ...b, nama_lengkap: b.nama_lengkap.trim(), username: b.username?.trim() }, groupId)
  await audit(req.user.id, 'tambah_peserta', cred.username)
  res.status(201).json(cred)
}))

/* ── Impor / ekspor / template peserta ── */

const PESERTA_COLS = [
  { key: 'nama_lengkap', header: 'nama_lengkap', width: 30, required: true, note: 'WAJIB. Nama lengkap peserta.' },
  { key: 'email', header: 'email', width: 30, note: 'Opsional. Harus berformat email yang valid.' },
  { key: 'grup', header: 'grup', width: 18, strictList: false, note: 'Opsional. Pilih dari daftar atau ketik nama grup baru (otomatis dibuat).' },
  { key: 'username', header: 'username', width: 20, note: 'Opsional. 3–30 karakter: huruf, angka, titik, strip, underscore. Kosong = dibuat otomatis dari nama.' },
  { key: 'password', header: 'password', width: 20, note: 'Opsional. Minimal 8 karakter. Kosong = dibuat acak.' },
]
const PESERTA_ALIASES = {
  nama: 'nama_lengkap', nama_peserta: 'nama_lengkap', name: 'nama_lengkap', fullname: 'nama_lengkap', full_name: 'nama_lengkap',
  group: 'grup', kelompok: 'grup', e_mail: 'email', surel: 'email', user: 'username', user_name: 'username',
  kata_sandi: 'password', sandi: 'password', pass: 'password',
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/

// Validasi baris peserta; dipakai untuk pratinjau dan penyimpanan
async function validatePeserta(rows) {
  const groups = await prisma.group.findMany()
  const groupByLower = new Map(groups.map((g) => [g.nama.toLowerCase(), g.nama]))
  const existing = new Set((await prisma.user.findMany({ select: { username: true } })).map((u) => u.username.toLowerCase()))
  const seen = new Set()
  const valid = [], invalid = []
  const newGroups = new Set()
  for (const row of rows) {
    const baris = row._baris ?? row.baris
    const nama = String(row.nama_lengkap ?? '').trim()
    const email = String(row.email ?? '').trim()
    const username = String(row.username ?? '').trim()
    const password = String(row.password ?? '')
    const grupIn = String(row.grup ?? '').trim()
    const fail = (alasan) => invalid.push({ baris, alasan, nama })
    if (!nama) { fail('nama_lengkap kosong'); continue }
    if (nama.length > 100) { fail('nama_lengkap terlalu panjang (maks. 100 karakter)'); continue }
    if (email && !EMAIL_RE.test(email)) { fail(`email "${email}" tidak valid`); continue }
    if (username) {
      if (!USERNAME_RE.test(username)) { fail(`username "${username}" tidak valid (3–30 karakter: huruf, angka, titik, strip, underscore)`); continue }
      const k = username.toLowerCase()
      if (existing.has(k)) { fail(`username "${username}" sudah dipakai`); continue }
      if (seen.has(k)) { fail(`username "${username}" ganda di dalam berkas`); continue }
    }
    if (password && password.length < 8) { fail('password minimal 8 karakter'); continue }
    if (grupIn.length > 60) { fail('nama grup terlalu panjang (maks. 60 karakter)'); continue }
    let grup = ''
    if (grupIn) {
      grup = groupByLower.get(grupIn.toLowerCase()) ?? grupIn
      if (!groupByLower.has(grupIn.toLowerCase())) newGroups.add(grup)
    }
    if (username) seen.add(username.toLowerCase())
    valid.push({ baris, nama_lengkap: nama, email, grup, username, password })
  }
  return { valid, invalid, grupBaru: [...newGroups] }
}

r.post('/peserta/import/preview', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Berkas belum dipilih' })
  const rows = readTable(req.file.buffer, req.file.originalname, { required: ['nama_lengkap'], aliases: PESERTA_ALIASES })
  res.json(await validatePeserta(rows))
}))

// Simpan baris yang sudah lolos pratinjau (divalidasi ulang di server)
r.post('/peserta/import', wrap(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, MAX_ROWS) : []
  const { valid, invalid } = await validatePeserta(rows)
  const created = []
  for (const row of valid) {
    const g = await findOrCreateGroup(row.grup)
    try { created.push({ ...(await createPeserta(row, g?.id)), grup: g?.nama ?? '' }) }
    catch { invalid.push({ baris: row.baris, alasan: 'gagal disimpan (username bentrok)', nama: row.nama_lengkap }) }
  }
  await audit(req.user.id, 'impor_peserta', `${created.length} berhasil, ${invalid.length} gagal`)
  res.json({ created, failed: invalid })
}))

r.get('/peserta/template', wrap(async (req, res) => {
  const groups = (await prisma.group.findMany({ orderBy: { nama: 'asc' } })).map((g) => g.nama)
  const rows = [
    { nama_lengkap: 'Contoh Peserta Satu', email: 'peserta1@contoh.com', grup: groups[0] ?? 'kip2026', username: '', password: '' },
    { nama_lengkap: 'Contoh Peserta Dua', email: '', grup: groups[0] ?? 'kip2026', username: '', password: '' },
  ]
  if (req.query.format === 'csv') return sendCsv(res, PESERTA_COLS, rows, 'template-peserta')
  sendBuffer(res, await buildWorkbook({
    title: 'Data Peserta', columns: PESERTA_COLS, rows, dropdowns: { grup: groups },
    instructions: [
      'PETUNJUK PENGISIAN — IMPOR PESERTA',
      'Isi data di lembar "Data Peserta", mulai dari baris ke-2. Jangan mengubah, menghapus, atau menambah kolom pada baris judul.',
      'HAPUS dua baris contoh sebelum mengunggah.',
      'KOLOM:',
      '• nama_lengkap (WAJIB, judul kuning) — nama lengkap peserta.',
      '• email — opsional, harus berformat email (contoh: nama@domain.com).',
      '• grup — opsional. Pilih dari dropdown, atau ketik nama grup baru (akan dibuat otomatis). Huruf besar/kecil diabaikan.',
      '• username — opsional. 3–30 karakter: huruf, angka, titik, strip, underscore. Kosong = dibuat otomatis dari nama. Tidak boleh sama dengan username lain.',
      '• password — opsional, minimal 8 karakter. Kosong = dibuat acak. Peserta wajib menggantinya saat login pertama.',
      'SETELAH UNGGAH:',
      '• Sistem menampilkan pratinjau: baris yang valid dan baris yang bermasalah beserta alasannya. Perbaiki berkas lalu unggah ulang, atau simpan baris yang valid saja.',
      '• Kredensial (username & password) ditampilkan sekali setelah disimpan dan dapat diunduh sebagai CSV.',
      'Format berkas yang diterima: .xlsx, .xls, atau .csv (pemisah koma atau titik koma). Maksimal 5 MB / 2000 baris.',
    ],
  }), 'template-peserta')
}))

r.get('/peserta/export', wrap(async (req, res) => {
  const users = await prisma.user.findMany({ where: { role: 'peserta' }, include: { profile: { include: { group: true } } }, orderBy: { id: 'asc' } })
  const cols = [...PESERTA_COLS, { key: 'status', header: 'status', width: 12 }]
  const rows = users.map((u) => ({ nama_lengkap: u.profile?.namaLengkap ?? '', email: u.profile?.email ?? '', grup: u.profile?.group?.nama ?? '', username: u.username, password: '', status: u.status }))
  await audit(req.user.id, 'ekspor_peserta', `${rows.length} peserta`)
  if (req.query.format === 'csv') return sendCsv(res, cols, rows, 'data-peserta')
  sendBuffer(res, await buildWorkbook({
    title: 'Data Peserta', columns: cols, rows,
    instructions: ['EKSPOR DATA PESERTA', 'Kolom password sengaja kosong: password disimpan terenkripsi dan tidak dapat dilihat. Gunakan menu Ubah → Password untuk membuat password baru.', 'Berkas ini untuk arsip. Mengunggah ulang tanpa menghapus baris yang sudah ada akan ditolak karena username sudah terdaftar.'],
  }), 'data-peserta')
}))

r.put('/peserta/:id', wrap(async (req, res) => {
  const b = req.body ?? {}
  const id = +req.params.id
  const user = await prisma.user.findFirst({ where: { id, role: 'peserta' } })
  if (!user) return res.status(404).json({ message: 'Peserta tidak ditemukan' })
  const profile = {}
  if ('namaLengkap' in b) profile.namaLengkap = String(b.namaLengkap).trim()
  if ('email' in b) profile.email = b.email || null
  if ('groupId' in b) profile.groupId = b.groupId ? +b.groupId : null
  await prisma.user.update({
    where: { id },
    data: { ...(b.status ? { status: b.status } : {}), ...(Object.keys(profile).length ? { profile: { update: profile } } : {}) },
  })
  await audit(req.user.id, 'ubah_peserta', user.username)
  res.json({ ok: true })
}))

r.post('/peserta/:id/reset-password', wrap(async (req, res) => {
  const id = +req.params.id
  const user = await prisma.user.findFirst({ where: { id, role: 'peserta' } })
  if (!user) return res.status(404).json({ message: 'Peserta tidak ditemukan' })
  const manual = req.body?.password ? String(req.body.password) : ''
  if (manual && manual.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter' })
  const password = manual || randomPassword()
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } })
  await prisma.activityLog.deleteMany({ where: { userId: id, event: 'minta_reset' } })
  await audit(req.user.id, 'reset_password', `${user.username}${manual ? ' (manual)' : ' (acak)'}`)
  res.json({ username: user.username, password })
}))

r.delete('/peserta/:id', wrap(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: +req.params.id, role: 'peserta' } })
  if (!user) return res.status(404).json({ message: 'Peserta tidak ditemukan' })
  await prisma.user.delete({ where: { id: user.id } })
  await audit(req.user.id, 'hapus_peserta', user.username)
  res.json({ ok: true })
}))

r.post('/peserta/bulk-delete', wrap(async (req, res) => {
  const ids = [...new Set((req.body?.ids ?? []).map(Number).filter(Number.isInteger))]
  if (!ids.length) return res.status(400).json({ message: 'Tidak ada peserta yang dipilih' })
  const users = await prisma.user.findMany({ where: { id: { in: ids }, role: 'peserta' }, select: { id: true, username: true } })
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } })
  await audit(req.user.id, 'hapus_peserta', `${users.length} peserta: ${users.map((u) => u.username).join(', ')}`.slice(0, 180))
  res.json({ deleted: users.length })
}))

/* ───────────── Ujian: jadwal, token & grup ───────────── */

const examData = (b) => ({
  judul: String(b.judul ?? '').trim(),
  petunjuk: b.petunjuk || null,
  durasiMenit: Math.max(1, parseInt(b.durasiMenit, 10) || 0),
  aktif: b.aktif !== false,
  tampilkanHasil: !!b.tampilkanHasil,
  acakSoal: !!b.acakSoal,
  jumlahSoalTampil: parseInt(b.jumlahSoalTampil, 10) > 0 ? parseInt(b.jumlahSoalTampil, 10) : null,
  nilaiKelulusan: Number(b.nilaiKelulusan ?? 60),
})
const validExam = (d) =>
  !d.judul ? 'Judul wajib diisi'
  : !d.durasiMenit ? 'Durasi wajib diisi'
  : !(d.nilaiKelulusan >= 0 && d.nilaiKelulusan <= 100) ? 'Nilai kelulusan harus 0–100' : null
const groupIds = (b) => [...new Set((Array.isArray(b.groupIds) ? b.groupIds : []).map(Number).filter(Boolean))]
const withGroups = (e) => ({
  ...e, nilaiKelulusan: Number(e.nilaiKelulusan),
  jumlahSoal: e._count?.questions, jumlahPeserta: e._count?.attempts,
  totalBobot: Math.round((e.questions ?? []).reduce((s, eq) => s + effBobot(eq), 0) * 100) / 100,
  questions: undefined,
  groups: (e.groups ?? []).map((x) => ({ id: x.group.id, nama: x.group.nama })),
  tokenAktif: e.tokens?.[0] ? { token: e.tokens[0].token, expiresAt: e.tokens[0].expiresAt } : null,
  tokens: undefined,
})

r.get('/exams', wrap(async (req, res) => {
  const exams = await prisma.exam.findMany({
    orderBy: { id: 'desc' },
    include: {
      _count: { select: { questions: true, attempts: true } }, groups: { include: { group: true } },
      questions: { select: { bobot: true, question: { select: { bobot: true } } } },
      tokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  res.json(exams.map(withGroups))
}))

r.post('/exams', wrap(async (req, res) => {
  const d = examData(req.body ?? {})
  const err = validExam(d)
  if (err) return res.status(400).json({ message: err })
  const exam = await prisma.exam.create({
    data: { ...d, createdBy: req.user.id, groups: { create: groupIds(req.body).map((groupId) => ({ groupId })) } },
  })
  await audit(req.user.id, 'buat_ujian', exam.judul)
  res.status(201).json(exam)
}))

r.put('/exams/:id', wrap(async (req, res) => {
  const d = examData(req.body ?? {})
  const err = validExam(d)
  if (err) return res.status(400).json({ message: err })
  const id = +req.params.id
  const [, exam] = await prisma.$transaction([
    prisma.examGroup.deleteMany({ where: { examId: id } }),
    prisma.exam.update({ where: { id }, data: { ...d, groups: { create: groupIds(req.body).map((groupId) => ({ groupId })) } } }),
  ])
  await audit(req.user.id, 'ubah_ujian', exam.judul)
  res.json(exam)
}))

r.delete('/exams/:id', wrap(async (req, res) => {
  await prisma.exam.delete({ where: { id: +req.params.id } })
  await audit(req.user.id, 'hapus_ujian', req.params.id)
  res.json({ ok: true })
}))

r.put('/exams/:id/aktif', wrap(async (req, res) => {
  const exam = await prisma.exam.update({ where: { id: +req.params.id }, data: { aktif: !!req.body?.aktif } })
  await audit(req.user.id, 'atur_ujian_aktif', exam.judul + ': ' + (exam.aktif ? 'aktif' : 'nonaktif'))
  res.json({ aktif: exam.aktif })
}))

/* ───────────── Token ujian ───────────── */

const TOKEN_DURATIONS = { '30m': 30, '1h': 60, '4h': 240, '12h': 720, '1d': 1440 }

const serializeToken = (t) => {
  const now = Date.now()
  const status = t.revokedAt ? 'dicabut' : t.expiresAt.getTime() <= now ? 'kedaluwarsa' : 'aktif'
  return { id: t.id, examId: t.examId, judul: t.exam?.judul, token: t.token, expiresAt: t.expiresAt, createdAt: t.createdAt, status }
}

r.get('/tokens', wrap(async (req, res) => {
  // Riwayat tidak disimpan: token kedaluwarsa/dicabut dibersihkan setiap daftar dibuka
  await prisma.examToken.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] } })
  const tokens = await prisma.examToken.findMany({ orderBy: { id: 'desc' }, take: 100, include: { exam: { select: { judul: true } } } })
  res.json(tokens.map(serializeToken))
}))

// Buat token otomatis untuk ujian terpilih; token aktif sebelumnya untuk ujian yang sama langsung dihapus
r.post('/tokens', wrap(async (req, res) => {
  const examId = +req.body?.examId
  const minutes = TOKEN_DURATIONS[req.body?.durasi]
  if (!minutes) return res.status(400).json({ message: 'Pilih masa berlaku token: 30 menit, 1 jam, 4 jam, 12 jam, atau 1 hari' })
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { _count: { select: { questions: true, groups: true } } } })
  if (!exam) return res.status(404).json({ message: 'Ujian tidak ditemukan' })
  if (!exam.aktif) return res.status(400).json({ message: 'Ujian sedang nonaktif. Aktifkan dulu di menu Ujian Tersedia.' })
  if (exam._count.questions === 0) return res.status(400).json({ message: 'Ujian belum punya soal. Isi bank soal terlebih dahulu.' })
  if (exam._count.groups === 0) return res.status(400).json({ message: 'Ujian belum dipilihkan grup pelaksana. Atur di menu Ujian Tersedia.' })

  const now = new Date()
  const inUse = new Set((await prisma.examToken.findMany({ where: { revokedAt: null, expiresAt: { gt: now } }, select: { token: true } })).map((t) => t.token))
  let token
  do { token = randomToken(6) } while (inUse.has(token))
  const [, created] = await prisma.$transaction([
    prisma.examToken.deleteMany({ where: { OR: [{ examId, expiresAt: { gt: now } }, { revokedAt: { not: null } }] } }),
    prisma.examToken.create({ data: { examId, token, expiresAt: new Date(now.getTime() + minutes * 60000), createdBy: req.user.id }, include: { exam: { select: { judul: true } } } }),
  ])
  await audit(req.user.id, 'buat_token', exam.judul + ' (' + req.body.durasi + ')')
  res.status(201).json(serializeToken(created))
}))

r.delete('/tokens/:id', wrap(async (req, res) => {
  // Dicabut = dihapus permanen dari database (tidak disimpan sebagai riwayat)
  const t = await prisma.examToken.delete({ where: { id: +req.params.id }, include: { exam: { select: { judul: true } } } })
  await audit(req.user.id, 'cabut_token', t.exam.judul)
  res.json({ ok: true })
}))

/* ───────────── Bank soal ───────────── */

const serializeQ = (q) => ({
  id: q.id, tipe: q.tipe, teksSoal: q.teksSoal, kunciJawaban: q.kunciJawaban,
  bobot: Number(q.bobot), acakOpsi: q.acakOpsi, pembahasan: q.pembahasan, kategori: q.kategori ?? '',
  createdAt: q.createdAt, jumlahUjian: q._count?.examLinks ?? 0,
  options: (q.options ?? []).sort((a, b) => a.label.localeCompare(b.label)).map((o) => ({ label: o.label, teksOpsi: o.teksOpsi, isBenar: o.isBenar })),
})

// Validasi + normalisasi satu soal; kembalikan { error } atau { data, options }
function normalizeQuestion(b) {
  const tipe = b.tipe
  if (!['pilihan_ganda', 'esai', 'benar_salah'].includes(tipe)) return { error: 'tipe_soal tidak valid' }
  const teksSoal = String(b.teksSoal ?? '').trim()
  if (!teksSoal) return { error: 'teks_soal wajib diisi' }
  const bobot = Number(b.bobot)
  if (!(bobot > 0)) return { error: 'bobot harus berupa angka > 0' }
  let kunci = String(b.kunciJawaban ?? '').trim()
  let options = []
  if (tipe === 'pilihan_ganda') {
    options = (b.options ?? []).filter((o) => String(o.teksOpsi ?? '').trim()).map((o) => ({ label: String(o.label).toUpperCase(), teksOpsi: String(o.teksOpsi).trim() }))
    const labels = options.map((o) => o.label)
    if (!labels.includes('A') || !labels.includes('B')) return { error: 'opsi_a dan opsi_b wajib diisi' }
    kunci = kunci.toUpperCase()
    if (!labels.includes(kunci)) return { error: 'kunci_jawaban harus salah satu opsi yang terisi (A-E)' }
    options = options.map((o) => ({ ...o, isBenar: o.label === kunci }))
  } else if (tipe === 'benar_salah') {
    kunci = kunci.toLowerCase()
    if (!['benar', 'salah'].includes(kunci)) return { error: 'kunci_jawaban harus benar/salah' }
  } else kunci = ''
  return {
    data: { tipe, teksSoal, kunciJawaban: kunci || null, bobot, acakOpsi: !!b.acakOpsi && tipe === 'pilihan_ganda', pembahasan: b.pembahasan || null, kategori: String(b.kategori ?? '').trim().slice(0, 80) || null },
    options,
  }
}

// Bank soal umum: semua soal, dengan filter opsional
r.get('/questions', wrap(async (req, res) => {
  const { q, tipe, kategori } = req.query
  const where = {
    ...(tipe ? { tipe: String(tipe) } : {}),
    ...(kategori ? { kategori: String(kategori) } : {}),
    ...(q ? { teksSoal: { contains: String(q) } } : {}),
  }
  const [items, cats, registered] = await Promise.all([
    prisma.question.findMany({ where, include: { options: true, _count: { select: { examLinks: true } } }, orderBy: { id: 'desc' } }),
    prisma.question.findMany({ where: { kategori: { not: null } }, distinct: ['kategori'], select: { kategori: true }, orderBy: { kategori: 'asc' } }),
    prisma.questionCategory.findMany({ select: { nama: true } }),
  ])
  const daftarKategori = [...new Set([...cats.map((c) => c.kategori), ...registered.map((c) => c.nama)])].sort((a, b) => a.localeCompare(b))
  res.json({ items: items.map(serializeQ), kategori: daftarKategori })
}))

// Kategori: daftar terdaftar + kategori yang hanya muncul dari soal, beserta jumlah soalnya
r.get('/question-categories', wrap(async (req, res) => {
  const [used, registered] = await Promise.all([
    prisma.question.groupBy({ by: ['kategori'], where: { kategori: { not: null } }, _count: { _all: true } }),
    prisma.questionCategory.findMany({ select: { nama: true } }),
  ])
  const count = new Map(used.map((u) => [u.kategori, u._count._all]))
  const names = [...new Set([...count.keys(), ...registered.map((c) => c.nama)])].sort((a, b) => a.localeCompare(b))
  res.json({ items: names.map((nama) => ({ nama, jumlahSoal: count.get(nama) ?? 0 })) })
}))

r.post('/question-categories', wrap(async (req, res) => {
  const nama = String(req.body?.nama ?? '').trim().slice(0, 80)
  if (!nama) return res.status(400).json({ message: 'Nama kategori wajib diisi' })
  const exists = await prisma.questionCategory.findFirst({ where: { nama } }) ?? await prisma.question.findFirst({ where: { kategori: nama }, select: { id: true } })
  if (exists) return res.status(409).json({ message: 'Kategori sudah ada' })
  await prisma.questionCategory.create({ data: { nama } })
  await audit(req.user.id, 'tambah_kategori_soal', nama)
  res.status(201).json({ nama, jumlahSoal: 0 })
}))

// Hanya kategori yang tidak dipakai soal manapun yang boleh dihapus
r.delete('/question-categories', wrap(async (req, res) => {
  const nama = String(req.query.nama ?? '').trim()
  if (await prisma.question.count({ where: { kategori: nama } })) return res.status(409).json({ message: 'Kategori masih dipakai soal, tidak dapat dihapus.' })
  await prisma.questionCategory.deleteMany({ where: { nama } })
  await audit(req.user.id, 'hapus_kategori_soal', nama)
  res.json({ ok: true })
}))

r.post('/questions', wrap(async (req, res) => {
  const n = normalizeQuestion(req.body ?? {})
  if (n.error) return res.status(400).json({ message: n.error })
  const q = await prisma.question.create({ data: { ...n.data, options: { create: n.options } }, include: { options: true } })
  await audit(req.user.id, 'tambah_soal', 'soal ' + q.id)
  res.status(201).json(serializeQ(q))
}))

r.post('/questions/:qid/duplicate', wrap(async (req, res) => {
  const src = await prisma.question.findUnique({ where: { id: +req.params.qid }, include: { options: true } })
  if (!src) return res.status(404).json({ message: 'Soal tidak ditemukan' })
  const q = await prisma.question.create({
    data: {
      tipe: src.tipe, teksSoal: src.teksSoal + ' (salinan)', kunciJawaban: src.kunciJawaban, bobot: src.bobot, acakOpsi: src.acakOpsi, pembahasan: src.pembahasan, kategori: src.kategori,
      options: { create: src.options.map((o) => ({ label: o.label, teksOpsi: o.teksOpsi, isBenar: o.isBenar })) },
    },
    include: { options: true },
  })
  res.status(201).json(serializeQ(q))
}))

// Soal yang dipilih sebuah ujian (urut), dengan bobot efektif
r.get('/exams/:id/questions', wrap(async (req, res) => {
  const eqs = await prisma.examQuestion.findMany({ where: { examId: +req.params.id }, include: { question: { include: { options: true } } }, orderBy: { urutan: 'asc' } })
  const items = eqs.map((eq) => ({ ...serializeQ(eq.question), questionId: eq.questionId, bobotBawaan: Number(eq.question.bobot), bobot: effBobot(eq), urutan: eq.urutan }))
  res.json({ items, total: Math.round(items.reduce((s, x) => s + x.bobot, 0) * 100) / 100 })
}))

// Simpan susunan soal ujian: daftar berurutan { questionId, bobot }
r.put('/exams/:id/questions', wrap(async (req, res) => {
  const examId = +req.params.id
  if (!(await prisma.exam.findUnique({ where: { id: examId } }))) return res.status(404).json({ message: 'Ujian tidak ditemukan' })
  const raw = Array.isArray(req.body?.items) ? req.body.items : []
  const seen = new Set()
  const items = []
  for (const it of raw) {
    const questionId = +it.questionId
    if (!questionId || seen.has(questionId)) continue
    seen.add(questionId)
    const bobot = it.bobot === '' || it.bobot == null ? null : Number(it.bobot)
    if (bobot !== null && !(bobot > 0 && bobot <= 9999)) return res.status(400).json({ message: 'Bobot harus berupa angka lebih dari 0' })
    items.push({ questionId, bobot })
  }
  const found = await prisma.question.findMany({ where: { id: { in: items.map((i) => i.questionId) } }, select: { id: true, bobot: true } })
  if (found.length !== items.length) return res.status(400).json({ message: 'Ada soal yang tidak ditemukan di bank soal' })
  const def = new Map(found.map((f) => [f.id, Number(f.bobot)]))
  await prisma.$transaction([
    prisma.examQuestion.deleteMany({ where: { examId } }),
    prisma.examQuestion.createMany({ data: items.map((it, i) => ({ examId, questionId: it.questionId, urutan: i, bobot: it.bobot !== null && it.bobot !== def.get(it.questionId) ? it.bobot : null })) }),
  ])
  await audit(req.user.id, 'atur_soal_ujian', items.length + ' soal pada ujian ' + examId)
  res.json({ jumlah: items.length })
}))

r.put('/questions/:qid', wrap(async (req, res) => {
  const n = normalizeQuestion(req.body ?? {})
  if (n.error) return res.status(400).json({ message: n.error })
  const id = +req.params.qid
  const [, q] = await prisma.$transaction([
    prisma.option.deleteMany({ where: { questionId: id } }),
    prisma.question.update({ where: { id }, data: { ...n.data, options: { create: n.options } }, include: { options: true } }),
  ])
  res.json(serializeQ(q))
}))

r.delete('/questions/:qid', wrap(async (req, res) => {
  const id = +req.params.qid
  if (await prisma.answer.count({ where: { questionId: id } })) return res.status(409).json({ message: 'Soal ini sudah pernah dikerjakan peserta sehingga tidak dapat dihapus. Lepaskan dari ujian jika tidak ingin dipakai lagi.' })
  await prisma.question.delete({ where: { id } })
  await audit(req.user.id, 'hapus_soal', 'soal ' + id)
  res.json({ ok: true })
}))

// Hapus banyak soal sekaligus; soal yang sudah pernah dijawab peserta dilewati
r.post('/questions/bulk-delete', wrap(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger))]
  if (!ids.length) return res.status(400).json({ message: 'Pilih minimal satu soal' })
  const answered = new Set((await prisma.answer.findMany({ where: { questionId: { in: ids } }, distinct: ['questionId'], select: { questionId: true } })).map((a) => a.questionId))
  const deletable = ids.filter((id) => !answered.has(id))
  const { count } = await prisma.question.deleteMany({ where: { id: { in: deletable } } })
  await audit(req.user.id, 'hapus_soal_massal', `${count} soal`)
  res.json({ deleted: count, skipped: answered.size })
}))

/* ── Impor / ekspor / template soal ── */

const SOAL_COLS = [
  { key: 'kategori', header: 'kategori', width: 18, note: 'Opsional. Pengelompokan soal, mis. Matematika, Bahasa Indonesia.' },
  { key: 'tipe_soal', header: 'tipe_soal', width: 16, required: true, note: 'WAJIB. pilihan_ganda, esai, atau benar_salah.' },
  { key: 'teks_soal', header: 'teks_soal', width: 55, required: true, note: 'WAJIB. Isi pertanyaan.' },
  { key: 'opsi_a', header: 'opsi_a', width: 22, note: 'Wajib untuk pilihan_ganda.' },
  { key: 'opsi_b', header: 'opsi_b', width: 22, note: 'Wajib untuk pilihan_ganda.' },
  { key: 'opsi_c', header: 'opsi_c', width: 22, note: 'Opsional.' },
  { key: 'opsi_d', header: 'opsi_d', width: 22, note: 'Opsional.' },
  { key: 'opsi_e', header: 'opsi_e', width: 22, note: 'Opsional.' },
  { key: 'kunci_jawaban', header: 'kunci_jawaban', width: 16, required: true, note: 'pilihan_ganda: A–E · benar_salah: benar/salah · esai: kosongkan.' },
  { key: 'bobot', header: 'bobot', width: 10, required: true, numeric: true, note: 'WAJIB. Angka > 0 (boleh desimal, mis. 1 atau 2.5).' },
  { key: 'pembahasan', header: 'pembahasan', width: 40, note: 'Opsional. Penjelasan jawaban.' },
  { key: 'acak_opsi', header: 'acak_opsi', width: 12, note: 'ya / tidak. Kosong = tidak. Hanya berlaku untuk pilihan_ganda.' },
]
const SOAL_ALIASES = {
  topik: 'kategori', materi: 'kategori', mapel: 'kategori', tipe: 'tipe_soal', jenis_soal: 'tipe_soal', jenis: 'tipe_soal', soal: 'teks_soal', pertanyaan: 'teks_soal', teks: 'teks_soal',
  a: 'opsi_a', b: 'opsi_b', c: 'opsi_c', d: 'opsi_d', e: 'opsi_e', pilihan_a: 'opsi_a', pilihan_b: 'opsi_b', pilihan_c: 'opsi_c', pilihan_d: 'opsi_d', pilihan_e: 'opsi_e',
  kunci: 'kunci_jawaban', jawaban: 'kunci_jawaban', jawaban_benar: 'kunci_jawaban', nilai: 'bobot', skor: 'bobot', penjelasan: 'pembahasan', acak: 'acak_opsi',
}
const SOAL_INSTRUCTIONS = [
  'PETUNJUK PENGISIAN — IMPOR BANK SOAL',
  'Isi soal di lembar "Data Soal", mulai dari baris ke-2. Satu baris = satu soal. Jangan mengubah, menghapus, atau menambah kolom pada baris judul.',
  'HAPUS tiga baris contoh sebelum mengunggah.',
  'KOLOM (judul kuning = wajib):',
  '• tipe_soal — pilih dari dropdown: pilihan_ganda, esai, atau benar_salah.',
  '• teks_soal — isi pertanyaan.',
  '• opsi_a … opsi_e — pilihan jawaban. Untuk pilihan_ganda opsi_a dan opsi_b wajib diisi; opsi_c–opsi_e boleh kosong. Kosongkan untuk esai dan benar_salah.',
  '• kunci_jawaban — pilihan_ganda: huruf A–E (harus opsi yang terisi) · benar_salah: benar atau salah · esai: kosongkan (dinilai manual).',
  '• bobot — angka lebih dari 0 (boleh desimal, mis. 2.5).',
  '• pembahasan — opsional, penjelasan yang tampil di hasil peserta.',
  '• acak_opsi — ya atau tidak (kosong = tidak). Hanya untuk pilihan_ganda.',
  'SETELAH UNGGAH:',
  '• Sistem menampilkan pratinjau: soal yang valid dan baris bermasalah beserta alasannya. Hanya baris valid yang disimpan ketika Anda menekan Simpan.',
  '• Soal hasil impor masuk ke ujian yang sedang dipilih dan dapat diubah lewat Ubah soal.',
  'Format berkas yang diterima: .xlsx, .xls, atau .csv (pemisah koma atau titik koma). Maksimal 5 MB / 2000 baris.',
]
const blank = { kategori: '', opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '', opsi_e: '', pembahasan: '', acak_opsi: 'tidak' }
const TEMPLATE_ROWS = [
  { ...blank, kategori: 'Umum', tipe_soal: 'pilihan_ganda', teks_soal: 'Ibu kota Indonesia adalah', opsi_a: 'Jakarta', opsi_b: 'Bandung', opsi_c: 'Surabaya', opsi_d: 'Medan', kunci_jawaban: 'A', bobot: 1, pembahasan: 'Jakarta adalah ibu kota Indonesia' },
  { ...blank, tipe_soal: 'benar_salah', teks_soal: '2 + 2 = 4', kunci_jawaban: 'benar', bobot: 1 },
  { ...blank, tipe_soal: 'esai', teks_soal: 'Jelaskan penyebab perubahan iklim', kunci_jawaban: '', bobot: 5 },
]
const soalWorkbook = (rows, extra = {}) => buildWorkbook({
  title: 'Data Soal', columns: SOAL_COLS, rows, dropdowns: { tipe_soal: ['pilihan_ganda', 'esai', 'benar_salah'], acak_opsi: ['ya', 'tidak'], kunci_jawaban: ['A', 'B', 'C', 'D', 'E', 'benar', 'salah'] },
  instructions: SOAL_INSTRUCTIONS, ...extra,
})

r.get('/questions/template', wrap(async (req, res) => {
  if (req.query.format === 'csv') return sendCsv(res, SOAL_COLS, TEMPLATE_ROWS, 'template-soal')
  sendBuffer(res, await soalWorkbook(TEMPLATE_ROWS), 'template-soal')
}))

// Ekspor bank soal dalam format yang sama dengan template (dapat diimpor ulang ke ujian lain)
async function sendQuestionExport(req, res, qs, label) {
  const rows = qs.map((q) => {
    const o = Object.fromEntries(q.options.map((x) => ['opsi_' + x.label.toLowerCase(), x.teksOpsi]))
    return { ...blank, ...o, kategori: q.kategori ?? '', tipe_soal: q.tipe, teks_soal: q.teksSoal, kunci_jawaban: q.kunciJawaban ?? '', bobot: q.eqBobot ?? Number(q.bobot), pembahasan: q.pembahasan ?? '', acak_opsi: q.acakOpsi ? 'ya' : 'tidak' }
  })
  await audit(req.user.id, 'ekspor_soal', rows.length + ' soal ' + label)
  if (req.query.format === 'csv') return sendCsv(res, SOAL_COLS, rows, 'bank-soal')
  sendBuffer(res, await soalWorkbook(rows), 'bank-soal')
}

// Ekspor seluruh bank soal (format sama dengan template; dapat diimpor ulang)
r.get('/questions/export', wrap(async (req, res) => {
  await sendQuestionExport(req, res, await prisma.question.findMany({ include: { options: true }, orderBy: { id: 'asc' } }), 'dari bank soal')
}))

// Ekspor soal yang dipilih sebuah ujian
r.get('/exams/:id/questions/export', wrap(async (req, res) => {
  const eqs = await prisma.examQuestion.findMany({ where: { examId: +req.params.id }, include: { question: { include: { options: true } } }, orderBy: { urutan: 'asc' } })
  await sendQuestionExport(req, res, eqs.map((eq) => ({ ...eq.question, eqBobot: effBobot(eq) })), 'dari ujian ' + req.params.id)
}))

// Ubah satu baris berkas menjadi objek soal yang sudah dinormalisasi
function rowToQuestion(row) {
  const tipe = parseTipe(row.tipe_soal)
  if (!tipe) return { error: `tipe_soal "${row.tipe_soal ?? ''}" tidak valid — gunakan pilihan_ganda, esai, atau benar_salah` }
  let kunci = String(row.kunci_jawaban ?? '').trim()
  if (tipe === 'pilihan_ganda') kunci = kunci.toUpperCase()
  else if (tipe === 'benar_salah') {
    kunci = parseBenarSalah(kunci)
    if (!kunci) return { error: 'kunci_jawaban untuk benar_salah harus "benar" atau "salah"' }
  } else kunci = ''
  const q = {
    tipe, kategori: row.kategori, teksSoal: row.teks_soal, kunciJawaban: kunci, bobot: parseNumber(row.bobot), pembahasan: row.pembahasan,
    acakOpsi: parseBool(row.acak_opsi),
    options: ['a', 'b', 'c', 'd', 'e'].map((l) => ({ label: l, teksOpsi: row['opsi_' + l] })),
  }
  const n = normalizeQuestion(q)
  return n.error ? { error: n.error } : { q }
}

// Pratinjau impor: validasi tiap baris, belum menyimpan
r.post('/questions/import/preview', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Berkas belum dipilih' })
  const rows = readTable(req.file.buffer, req.file.originalname, { required: ['tipe_soal', 'teks_soal', 'bobot'], aliases: SOAL_ALIASES })
  const valid = [], invalid = []
  for (const row of rows) {
    const { q, error } = rowToQuestion(row)
    if (error) invalid.push({ baris: row._baris, alasan: error, teks: row.teks_soal })
    else valid.push({ ...q, baris: row._baris })
  }
  res.json({ valid, invalid })
}))

r.post('/questions/import/save', wrap(async (req, res) => {
  const items = Array.isArray(req.body?.questions) ? req.body.questions.slice(0, MAX_ROWS) : []
  let saved = 0
  const failed = []
  for (const item of items) {
    const n = normalizeQuestion(item)
    if (n.error) { failed.push({ baris: item.baris, alasan: n.error }); continue }
    await prisma.question.create({ data: { ...n.data, options: { create: n.options } } })
    saved++
  }
  await audit(req.user.id, 'impor_soal', `${saved} soal ke bank soal`)
  res.json({ saved, failed })
}))

/* ───────────── Pemantauan ───────────── */

r.get('/exams/:id/monitor', wrap(async (req, res) => {
  const examId = +req.params.id
  const [peserta, attempts] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'peserta', status: 'aktif', OR: [{ profile: { group: { exams: { some: { examId } } } } }, { attempts: { some: { examId } } }] },
      include: { profile: { include: { group: true } } },
    }),
    prisma.examAttempt.findMany({ where: { examId }, include: { logs: { select: { event: true } } } }),
  ])
  const byUser = new Map(attempts.map((a) => [a.userId, a]))
  const shots = new Map(await Promise.all(attempts.map(async (a) => [a.id, await listShots(a.id)])))
  const now = Date.now()
  res.json(peserta.map((u) => {
    const a = byUser.get(u.id)
    const keluar = a?.logs.filter((l) => ['keluar_halaman', 'pindah_tab'].includes(l.event)).length ?? 0
    const terputus = a?.status === 'sedang_mengerjakan' && a.lastSeen && now - a.lastSeen.getTime() > 45000
    const s = a ? shots.get(a.id) : []
    return {
      userId: u.id, attemptId: a?.id ?? null, nama: u.profile?.namaLengkap ?? u.username, username: u.username, grup: u.profile?.group?.nama ?? null,
      status: a?.status ?? 'belum_mulai', waktuMulai: a?.waktuMulai ?? null, lastSeen: a?.lastSeen ?? null,
      keluarHalaman: keluar, terputus: !!terputus,
      kameraTerakhir: s[0] ?? null, jumlahFoto: s.length,
      kameraMati: a?.logs.filter((l) => l.event === 'kamera_mati').length ?? 0,
    }
  }))
}))

// Foto kamera satu pengerjaan: daftar waktu, lalu berkas per foto
r.get('/attempts/:id/camera', wrap(async (req, res) => {
  res.json({ shots: await listShots(+req.params.id) })
}))
r.get('/attempts/:id/camera/:ts', wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.ts)) return res.status(400).json({ message: 'Foto tidak valid' })
  res.set('Cache-Control', 'private, max-age=604800')
  res.sendFile(shotFile(+req.params.id, req.params.ts), (err) => { if (err && !res.headersSent) res.status(404).json({ message: 'Foto tidak ditemukan' }) })
}))

// Reset pengerjaan peserta → kembali "belum mulai" (jawaban & log attempt ikut terhapus) agar bisa mengulang
r.post('/exams/:id/monitor/:userId/reset', wrap(async (req, res) => {
  const examId = +req.params.id, userId = +req.params.userId
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_userId: { examId, userId } }, include: { user: { include: { profile: true } } } })
  if (!attempt) return res.status(404).json({ message: 'Peserta belum memulai ujian ini' })
  await prisma.examAttempt.delete({ where: { id: attempt.id } })
  await removeAttemptShots(attempt.id)
  await audit(req.user.id, 'reset_ujian', `${attempt.user.profile?.namaLengkap ?? attempt.user.username} pada ujian ${examId} (status sebelumnya: ${attempt.status})`)
  notifyMonitor(examId)
  res.json({ ok: true })
}))

/* ───────────── Penilaian esai ───────────── */

r.get('/exams/:id/essays', wrap(async (req, res) => {
  const answers = await prisma.answer.findMany({
    where: { question: { tipe: 'esai' }, attempt: { examId: +req.params.id, status: 'selesai' } },
    include: { question: true, attempt: { include: { user: { include: { profile: true } } } } },
    orderBy: [{ questionId: 'asc' }, { id: 'asc' }],
  })
  const eqs = await prisma.examQuestion.findMany({ where: { examId: +req.params.id }, include: { question: true } })
  const bobotOf = new Map(eqs.map((eq) => [eq.questionId, effBobot(eq)]))
  res.json(answers.map((a) => ({
    id: a.id, peserta: a.attempt.user.profile?.namaLengkap ?? a.attempt.user.username,
    soal: a.question.teksSoal, bobot: bobotOf.get(a.questionId) ?? Number(a.question.bobot), jawaban: a.jawaban ?? '', nilai: a.nilai == null ? null : Number(a.nilai),
  })))
}))

r.put('/answers/:id/nilai', wrap(async (req, res) => {
  const answer = await prisma.answer.findUnique({ where: { id: +req.params.id }, include: { question: true, attempt: true } })
  if (!answer || answer.question.tipe !== 'esai') return res.status(404).json({ message: 'Jawaban tidak ditemukan' })
  const eq = await prisma.examQuestion.findUnique({ where: { examId_questionId: { examId: answer.attempt.examId, questionId: answer.questionId } }, include: { question: true } })
  const maks = eq ? effBobot(eq) : Number(answer.question.bobot)
  const nilai = Number(req.body?.nilai)
  if (isNaN(nilai) || nilai < 0 || nilai > maks)
    return res.status(400).json({ message: `Nilai harus 0 – ${maks}` })
  await prisma.answer.update({ where: { id: answer.id }, data: { nilai, dinilaiOleh: req.user.id } })
  const result = await gradeAttempt(answer.attemptId)
  await audit(req.user.id, 'nilai_esai', `jawaban ${answer.id} = ${nilai}`, answer.attemptId)
  res.json(result)
}))

/* ───────────── Rekap & laporan ───────────── */

// from/to: batas waktu mulai pengerjaan (ISO, dihitung di zona waktu browser admin)
async function rekap(examId, { from, to } = {}) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } })
  const range = {}
  if (from && !isNaN(Date.parse(from))) range.gte = new Date(from)
  if (to && !isNaN(Date.parse(to))) range.lt = new Date(to)
  const attempts = await prisma.examAttempt.findMany({
    where: { examId, ...(Object.keys(range).length && { waktuMulai: range }) }, include: { user: { include: { profile: { include: { group: true } } } } }, orderBy: { skorTotal: 'desc' },
  })
  return { exam, rows: attempts.map((a) => ({
    username: a.user.username, nama: a.user.profile?.namaLengkap ?? a.user.username, grup: a.user.profile?.group?.nama ?? '',
    status: a.status, skor: a.skorTotal == null ? null : Number(a.skorTotal), kelulusan: a.statusKelulusan,
    waktuMulai: a.waktuMulai, waktuSelesai: a.waktuSelesai,
  })) }
}

r.get('/exams/:id/rekap', wrap(async (req, res) => {
  const { exam, rows } = await rekap(+req.params.id, req.query)
  res.json({ judul: exam?.judul, nilaiKelulusan: exam ? Number(exam.nilaiKelulusan) : 0, rows })
}))

r.get('/exams/:id/report', wrap(async (req, res) => {
  const { exam, rows } = await rekap(+req.params.id, req.query)
  const label = { lulus: 'Lulus', tidak_lulus: 'Tidak Lulus', belum: 'Belum dinilai' }
  sendSheet(res, rows.map((x, i) => ({
    No: i + 1, Username: x.username, Nama: x.nama, Grup: x.grup, Status: x.status,
    Skor: x.skor ?? '', Kelulusan: label[x.kelulusan],
    Mulai: x.waktuMulai?.toISOString() ?? '', Selesai: x.waktuSelesai?.toISOString() ?? '',
  })), `laporan-${(exam?.judul ?? 'ujian').replace(/[^\w]+/g, '-')}`, req.query.format)
}))

r.put('/exams/:id/tampil-hasil', wrap(async (req, res) => {
  const exam = await prisma.exam.update({ where: { id: +req.params.id }, data: { tampilkanHasil: !!req.body?.tampil } })
  await audit(req.user.id, 'atur_tampil_hasil', `${exam.judul}: ${exam.tampilkanHasil}`)
  res.json({ tampilkanHasil: exam.tampilkanHasil })
}))

export default r
