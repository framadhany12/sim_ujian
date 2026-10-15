import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma, auth, signToken, wrap, audit } from '../lib.js'

const r = Router()

const publicUser = (u) => ({
  id: u.id, username: u.username, role: u.role,
  mustChangePassword: u.mustChangePassword,
  nama: u.profile?.namaLengkap ?? (u.role === 'admin' ? 'Administrator' : u.username),
})

r.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body ?? {}
  const user = await prisma.user.findUnique({ where: { username: String(username ?? '') }, include: { profile: true } })
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash)))
    return res.status(401).json({ message: 'Username atau password salah' })
  if (user.status !== 'aktif') return res.status(403).json({ message: 'Akun dinonaktifkan. Hubungi Admin.' })
  await audit(user.id, 'login')
  res.json({ token: signToken(user), user: publicUser(user) })
}))

r.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }))

r.post('/change-password', auth, wrap(async (req, res) => {
  const { oldPassword, newPassword } = req.body ?? {}
  if (!(await bcrypt.compare(String(oldPassword ?? ''), req.user.passwordHash)))
    return res.status(400).json({ message: 'Password lama salah' })
  if (String(newPassword ?? '').length < 8) return res.status(400).json({ message: 'Password baru minimal 8 karakter' })
  if (newPassword === oldPassword) return res.status(400).json({ message: 'Password baru harus berbeda' })
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
    include: { profile: true },
  })
  await audit(user.id, 'ganti_password')
  res.json({ user: publicUser(user) })
}))

// Bantuan lupa password: hanya mencatat permintaan agar Admin dapat mereset
r.post('/forgot', wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.body?.username ?? '') } })
  if (user) await audit(user.id, 'minta_reset')
  res.json({ message: 'Jika username terdaftar, permintaan reset telah dikirim ke Admin.' })
}))

export default r
