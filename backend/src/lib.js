import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

export const prisma = new PrismaClient()
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// io diisi dari server.js (Socket.IO) agar route bisa memancarkan event pemantauan
export const hub = { io: null }
export const notifyMonitor = (examId) => hub.io?.to('admins').emit('monitor:update', { examId })

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' })

export async function auth(req, res, next) {
  const h = req.headers.authorization || ''
  try {
    const payload = jwt.verify(h.replace(/^Bearer /, ''), JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { profile: true } })
    if (!user || user.status !== 'aktif') return res.status(401).json({ message: 'Sesi tidak valid' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Silakan login kembali' })
  }
}

export const requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ message: 'Akses ditolak' })

// Catatan audit aktivitas penting
export const audit = (userId, event, detail, attemptId = null) =>
  prisma.activityLog.create({ data: { userId, event, detail, attemptId } }).catch(() => {})

export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next)

export const randomPassword = (len = 8) => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(len), (b) => chars[b % chars.length]).join('')
}
export const randomToken = (len = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(len), (b) => chars[b % chars.length]).join('')
}

// PRNG berbenih supaya urutan acak konsisten untuk satu peserta tiap kali dimuat ulang
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seededShuffle(arr, seed) {
  const rnd = mulberry32(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const attemptEnd = (attempt, exam) => new Date(attempt.waktuMulai.getTime() + exam.durasiMenit * 60000)

// Bobot efektif soal di sebuah ujian: bobot khusus ujian bila diatur, jika tidak memakai bobot bawaan soal
export const effBobot = (eq) => Number(eq.bobot ?? eq.question.bobot)

const norm = (s) => String(s ?? '').trim().toLowerCase()

// Hitung ulang skor (persen dari total bobot). Status 'belum' bila masih ada esai yang belum dinilai.
export async function gradeAttempt(attemptId, { autoOnly = false } = {}) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: { include: { questions: { include: { question: true } } } }, answers: true },
  })
  const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]))
  let total = 0, got = 0, essayPending = false
  for (const eq of attempt.exam.questions) {
    const q = eq.question
    const bobot = effBobot(eq)
    total += bobot
    const ans = byQ.get(q.id)
    if (q.tipe === 'esai') {
      if (ans?.nilai == null) essayPending = true
      else got += Number(ans.nilai)
      continue
    }
    const benar = ans && norm(ans.jawaban) === norm(q.kunciJawaban)
    const nilai = benar ? bobot : 0
    if (ans) {
      await prisma.answer.update({ where: { id: ans.id }, data: { nilai } })
    }
    got += nilai
  }
  const skor = total > 0 ? Math.round((got / total) * 10000) / 100 : 0
  const status = essayPending ? 'belum' : skor >= Number(attempt.exam.nilaiKelulusan) ? 'lulus' : 'tidak_lulus'
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { skorTotal: skor, statusKelulusan: status } })
  return { skor, status }
}

export async function finalizeAttempt(attempt, exam) {
  if (attempt.status === 'selesai') return attempt
  const end = attemptEnd(attempt, exam)
  const updated = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: { status: 'selesai', waktuSelesai: new Date(Math.min(Date.now(), end.getTime())) },
  })
  await gradeAttempt(attempt.id)
  await audit(attempt.userId, 'submit', null, attempt.id)
  notifyMonitor(exam.id)
  return updated
}
