import express from 'express'
import cors from 'cors'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { hub, auth, requireRole, JWT_SECRET } from './lib.js'
import authRoutes from './routes/auth.js'
import pesertaRoutes from './routes/peserta.js'
import adminRoutes from './routes/admin.js'

const app = express()
// Izinkan CLIENT_ORIGIN, serta localhost di port berapa pun (Vite pindah port bila 5173 terpakai)
const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')
const origin = (o, cb) => cb(null, !o || allowed.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o))
app.use(cors({ origin }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/me', auth, requireRole('peserta'), pesertaRoutes)
app.use('/api/admin', auth, requireRole('admin'), adminRoutes)

// Produksi/percobaan: sajikan hasil build frontend dari server yang sama (satu alamat untuk web + API)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api|socket\.io).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Ukuran berkas maksimal 5 MB' })
  if (err.name === 'MulterError') return res.status(400).json({ message: 'Berkas tidak dapat diunggah. Pilih berkas .xlsx, .xls, atau .csv.' })
  if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message })
  console.error(err)
  res.status(500).json({ message: 'Terjadi kesalahan pada server' })
})

const server = http.createServer(app)
hub.io = new Server(server, { cors: { origin } })
hub.io.on('connection', (socket) => {
  try {
    const p = jwt.verify(socket.handshake.auth?.token ?? '', JWT_SECRET)
    if (p.role === 'admin') socket.join('admins')
  } catch { /* abaikan koneksi tanpa token valid */ }
})

const port = process.env.PORT || 4000
server.listen(port, () => console.log(`API berjalan di http://localhost:${port}`))
