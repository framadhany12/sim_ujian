import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './lib.js'

// Foto kamera peserta disimpan sebagai berkas: uploads/camera/<attemptId>/<epoch-ms>.jpg
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/camera')
const KEEP_MS = 7 * 24 * 60 * 60 * 1000
const dirOf = (attemptId) => path.join(ROOT, String(+attemptId))

export async function saveShot(attemptId, buffer) {
  await fs.mkdir(dirOf(attemptId), { recursive: true })
  const ts = Date.now()
  await fs.writeFile(path.join(dirOf(attemptId), `${ts}.jpg`), buffer)
  return ts
}

// Waktu (epoch ms) semua foto satu pengerjaan, terbaru dulu
export async function listShots(attemptId) {
  const files = await fs.readdir(dirOf(attemptId)).catch(() => [])
  return files.map((f) => /^(\d+)\.jpg$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => b - a)
}

export const shotFile = (attemptId, ts) => path.join(dirOf(attemptId), `${+ts}.jpg`)

export const removeAttemptShots = (attemptId) => fs.rm(dirOf(attemptId), { recursive: true, force: true })

// Hapus foto lebih dari 7 hari, dan folder milik pengerjaan yang sudah tidak ada (reset/hapus peserta/hapus ujian)
export async function cleanupShots() {
  const dirs = await fs.readdir(ROOT).catch(() => [])
  const ids = dirs.map(Number).filter(Number.isInteger)
  const alive = new Set((await prisma.examAttempt.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((a) => a.id))
  const cutoff = Date.now() - KEEP_MS
  for (const id of ids) {
    if (!alive.has(id)) { await removeAttemptShots(id); continue }
    const shots = await listShots(id)
    await Promise.all(shots.filter((ts) => ts < cutoff).map((ts) => fs.rm(shotFile(id, ts), { force: true })))
    if (shots.every((ts) => ts < cutoff)) await removeAttemptShots(id)
  }
}

export function scheduleCleanup() {
  const run = () => cleanupShots().catch((e) => console.error('Gagal membersihkan foto kamera:', e))
  run()
  setInterval(run, 6 * 60 * 60 * 1000).unref()
}
