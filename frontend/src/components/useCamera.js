import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE, getToken } from '../api.js'

const INTERVAL_MS = 60000

// Pesan untuk tiap kegagalan getUserMedia; dipakai juga sebelum ujian dimulai (Jadwal)
export function cameraError(err) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'Kamera hanya bisa dipakai lewat alamat https. Buka ujian dari alamat resmi yang dibagikan pengawas.'
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') return 'Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.'
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini. Ujian wajib memakai perangkat yang memiliki kamera.'
  if (err?.name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.'
  return 'Kamera tidak dapat diaktifkan. Coba lagi.'
}

export const openCamera = () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false })

// Kamera wajib selama ujian: pratinjau kecil + foto JPEG tiap 60 detik dikirim ke server.
// status: 'meminta' | 'aktif' | 'gagal' | 'mati' (kamera terputus di tengah ujian, mis. pindah aplikasi di iOS)
export default function useCamera(active, attemptId, report) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('meminta')
  const [error, setError] = useState('')

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }

  const lost = useCallback(() => {
    stop(); setStatus('mati'); setError('Kamera terputus. Aktifkan lagi untuk melanjutkan ujian.'); report('kamera_mati')
  }, [report])

  const start = useCallback(async () => {
    setStatus('meminta'); setError('')
    try {
      const stream = streamRef.current?.active ? streamRef.current : await openCamera()
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', lost, { once: true })
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      setStatus('aktif')
    } catch (err) { setStatus('gagal'); setError(cameraError(err)) }
  }, [lost])

  const capture = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth || !streamRef.current?.active) return
    const c = document.createElement('canvas')
    c.width = 320; c.height = Math.round(320 * v.videoHeight / v.videoWidth)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => {
      if (!blob) return
      const fd = new FormData(); fd.append('foto', blob, 'foto.jpg')
      fetch(`${API_BASE}/api/me/attempts/${attemptId}/camera`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd }).catch(() => {})
    }, 'image/jpeg', 0.6)
  }, [attemptId])

  useEffect(() => {
    if (!active) return
    start()
    return stop
  }, [active, start])

  useEffect(() => {
    if (!active || status !== 'aktif') return
    const first = setTimeout(capture, 3000)
    const every = setInterval(capture, INTERVAL_MS)
    // iOS menghentikan kamera saat pindah aplikasi tanpa selalu memicu 'ended'
    const onVisible = () => { if (!document.hidden && streamRef.current && !streamRef.current.active) lost() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(first); clearInterval(every); document.removeEventListener('visibilitychange', onVisible) }
  }, [active, status, capture, lost])

  return { videoRef, status, error, start }
}
