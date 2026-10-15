import { Router } from 'express'
import { effBobot, prisma, wrap, audit, notifyMonitor, seededShuffle, attemptEnd, finalizeAttempt } from '../lib.js'

const r = Router()

// Ujian yang boleh diakses peserta: ujian untuk grupnya, atau yang sudah pernah dikerjakan
const accessWhere = (user) => ({
  OR: [
    ...(user.profile?.groupId ? [{ groups: { some: { groupId: user.profile.groupId } } }] : []),
    { attempts: { some: { userId: user.id } } },
  ],
})

// Jadwal Ujian Saya
r.get('/exams', wrap(async (req, res) => {
  const exams = await prisma.exam.findMany({
    where: { AND: [accessWhere(req.user), { OR: [{ aktif: true }, { attempts: { some: { userId: req.user.id } } }] }] },
    orderBy: { id: 'desc' }, include: { _count: { select: { questions: true } } },
  })
  const attempts = await prisma.examAttempt.findMany({ where: { userId: req.user.id } })
  const byExam = new Map(attempts.map((a) => [a.examId, a]))
  const tokens = await prisma.examToken.findMany({ where: { examId: { in: exams.map((e) => e.id) }, revokedAt: null, expiresAt: { gt: new Date() } } })
  const openUntil = new Map()
  for (const t of tokens) if (!openUntil.get(t.examId) || t.expiresAt > openUntil.get(t.examId)) openUntil.set(t.examId, t.expiresAt)
  res.json(exams.map((e) => {
    const a = byExam.get(e.id)
    return {
      id: e.id, judul: e.judul, petunjuk: e.petunjuk, durasiMenit: e.durasiMenit,
      jumlahSoal: e._count.questions, tampilkanHasil: e.tampilkanHasil,
      dibuka: e.aktif && openUntil.has(e.id), dibukaSampai: e.aktif ? openUntil.get(e.id) ?? null : null,
      attemptId: a?.id ?? null, status: a?.status ?? 'belum_mulai',
      skor: a?.status === 'selesai' && e.tampilkanHasil && a.skorTotal != null ? Number(a.skorTotal) : null,
      kelulusan: a?.status === 'selesai' && e.tampilkanHasil ? a.statusKelulusan : null,
      nilaiKelulusan: Number(e.nilaiKelulusan), waktuSelesai: a?.waktuSelesai ?? null,
    }
  }))
}))

async function buildPayload(attempt, exam) {
  const eqs = await prisma.examQuestion.findMany({ where: { examId: exam.id }, include: { question: { include: { options: { orderBy: { label: 'asc' } } } } }, orderBy: { urutan: 'asc' } })
  const questions = eqs.map((eq) => ({ ...eq.question, bobot: effBobot(eq) }))
  const answers = await prisma.answer.findMany({ where: { attemptId: attempt.id } })
  let list = exam.acakSoal ? seededShuffle(questions, attempt.id) : questions
  list = list.map((q) => ({
    id: q.id, tipe: q.tipe, teks: q.teksSoal, bobot: Number(q.bobot),
    options: q.tipe === 'pilihan_ganda'
      ? (q.acakOpsi ? seededShuffle(q.options, attempt.id * 1000 + q.id) : q.options).map((o) => ({ label: o.label, teks: o.teksOpsi }))
      : undefined,
  }))
  return {
    attemptId: attempt.id,
    exam: { id: exam.id, judul: exam.judul },
    endsAt: attemptEnd(attempt, exam).getTime(),
    serverNow: Date.now(),
    questions: list,
    answers: Object.fromEntries(answers.map((a) => [a.questionId, { jawaban: a.jawaban ?? '', isRagu: a.isRagu }])),
  }
}

// Masuk ujian dengan token (atau lanjutkan sesi yang sedang berjalan)
r.post('/exams/:id/start', wrap(async (req, res) => {
  const exam = await prisma.exam.findFirst({ where: { id: +req.params.id, ...accessWhere(req.user) } })
  if (!exam) return res.status(404).json({ message: 'Ujian tidak ditemukan' })
  let attempt = await prisma.examAttempt.findUnique({ where: { examId_userId: { examId: exam.id, userId: req.user.id } } })
  if (attempt?.status === 'selesai') return res.status(409).json({ message: 'Anda sudah menyelesaikan ujian ini' })

  if (!attempt) {
    const now = new Date()
    if (!exam.aktif) return res.status(403).json({ message: 'Ujian ini sedang dinonaktifkan' })
    const active = await prisma.examToken.findMany({ where: { examId: exam.id, revokedAt: null, expiresAt: { gt: now } } })
    if (active.length === 0) return res.status(403).json({ message: 'Ujian belum dibuka oleh Admin' })
    const given = String(req.body?.token ?? '').trim().toUpperCase()
    if (!active.some((t) => t.token === given)) return res.status(403).json({ message: 'Token salah atau sudah kedaluwarsa' })
    attempt = await prisma.examAttempt.create({
      data: { examId: exam.id, userId: req.user.id, waktuMulai: now, status: 'sedang_mengerjakan', lastSeen: now },
    })
    await audit(req.user.id, 'mulai', null, attempt.id)
    notifyMonitor(exam.id)
  } else {
    if (new Date() >= attemptEnd(attempt, exam)) {
      await finalizeAttempt(attempt, exam)
      return res.status(409).json({ message: 'Waktu ujian Anda sudah habis' })
    }
    await audit(req.user.id, 'reconnect', null, attempt.id)
    notifyMonitor(exam.id)
  }
  res.json(await buildPayload(attempt, exam))
}))

// Muat ulang sesi (mis. setelah refresh)
async function ownAttempt(req, res) {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: +req.params.id }, include: { exam: true } })
  if (!attempt || attempt.userId !== req.user.id) { res.status(404).json({ message: 'Sesi tidak ditemukan' }); return null }
  return attempt
}

r.get('/attempts/:id', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, res); if (!attempt) return
  if (attempt.status === 'selesai') return res.status(409).json({ message: 'Ujian sudah selesai' })
  if (new Date() >= attemptEnd(attempt, attempt.exam)) {
    await finalizeAttempt(attempt, attempt.exam)
    return res.status(409).json({ message: 'Waktu ujian sudah habis' })
  }
  res.json(await buildPayload(attempt, attempt.exam))
}))

// Simpan jawaban berkala
r.put('/attempts/:id/answers/:qid', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, res); if (!attempt) return
  if (attempt.status === 'selesai') return res.status(409).json({ message: 'Ujian sudah selesai' })
  if (new Date() >= attemptEnd(attempt, attempt.exam)) {
    await finalizeAttempt(attempt, attempt.exam)
    return res.status(409).json({ message: 'Waktu habis', expired: true })
  }
  const qid = +req.params.qid
  const q = await prisma.examQuestion.findUnique({ where: { examId_questionId: { examId: attempt.examId, questionId: qid } } })
  if (!q) return res.status(404).json({ message: 'Soal tidak ditemukan' })
  const data = {}
  if ('jawaban' in req.body) data.jawaban = String(req.body.jawaban ?? '')
  if ('isRagu' in req.body) data.isRagu = !!req.body.isRagu
  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: qid } },
    create: { attemptId: attempt.id, questionId: qid, ...data },
    update: data,
  })
  await prisma.examAttempt.update({ where: { id: attempt.id }, data: { lastSeen: new Date() } })
  res.json({ ok: true })
}))

const EVENTS = ['keluar_halaman', 'kembali_halaman', 'reconnect', 'heartbeat']
r.post('/attempts/:id/event', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, res); if (!attempt) return
  const ev = req.body?.event
  if (!EVENTS.includes(ev)) return res.status(400).json({ message: 'Event tidak valid' })
  await prisma.examAttempt.update({ where: { id: attempt.id }, data: { lastSeen: new Date() } })
  if (ev !== 'heartbeat') await audit(req.user.id, ev, null, attempt.id)
  notifyMonitor(attempt.examId)
  res.json({ ok: true })
}))

r.post('/attempts/:id/submit', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, res); if (!attempt) return
  await finalizeAttempt(attempt, attempt.exam)
  res.json({ ok: true })
}))

// Skor, kelulusan, dan rincian jawaban (hanya jika Admin mengizinkan)
r.get('/exams/:id/result', wrap(async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: +req.params.id } })
  const attempt = exam && await prisma.examAttempt.findUnique({ where: { examId_userId: { examId: exam.id, userId: req.user.id } } })
  if (!attempt || attempt.status !== 'selesai') return res.status(404).json({ message: 'Belum ada hasil' })
  if (!exam.tampilkanHasil) return res.json({ tampil: false })
  const eqs = await prisma.examQuestion.findMany({ where: { examId: exam.id }, include: { question: { include: { options: true } } }, orderBy: { urutan: 'asc' } })
  const questions = eqs.map((eq) => ({ ...eq.question, bobot: effBobot(eq) }))
  const answers = new Map((await prisma.answer.findMany({ where: { attemptId: attempt.id } })).map((a) => [a.questionId, a]))
  res.json({
    tampil: true, judul: exam.judul, durasiMenit: exam.durasiMenit, waktuMulai: attempt.waktuMulai, waktuSelesai: attempt.waktuSelesai,
    skor: Number(attempt.skorTotal ?? 0), nilaiKelulusan: Number(exam.nilaiKelulusan), status: attempt.statusKelulusan,
    rincian: questions.map((q) => {
      const a = answers.get(q.id)
      return {
        id: q.id, tipe: q.tipe, teks: q.teksSoal, bobot: Number(q.bobot),
        opsi: q.options.map((o) => ({ label: o.label, teks: o.teksOpsi })),
        jawaban: a?.jawaban ?? '', kunci: q.kunciJawaban, nilai: a?.nilai == null ? null : Number(a.nilai), pembahasan: q.pembahasan,
      }
    }),
  })
}))

export default r
