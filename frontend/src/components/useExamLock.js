import { useEffect, useState } from 'react'

const BLOCKED_CTRL = ['c', 'v', 'x', 'a', 'p', 's', 'u']

// Safari iPad hanya punya API berawalan webkit; Safari iPhone tidak punya Fullscreen API
// untuk halaman sama sekali, jadi di sana layar penuh tidak diwajibkan.
const root = () => document.documentElement
const fsSupported = () => !!(root().requestFullscreen || root().webkitRequestFullscreen)
const fsActive = () => !fsSupported() || !!(document.fullscreenElement || document.webkitFullscreenElement)
const requestFs = () => {
  try {
    const p = root().requestFullscreen ? root().requestFullscreen() : root().webkitRequestFullscreen?.()
    p?.catch?.(() => {})
  } catch { /* ditolak browser */ }
}

// Mengunci halaman ujian: blok salin/tempel/klik kanan, deteksi pindah tab/jendela,
// wajib layar penuh, dan tutup isi halaman saat tombol screenshot ditekan.
export default function useExamLock(active, report) {
  const [violations, setViolations] = useState(0)
  const [warning, setWarning] = useState('')
  const [hidden, setHidden] = useState(false)
  const [fullscreen, setFullscreen] = useState(true)

  useEffect(() => {
    if (!active) return
    const stop = (e) => e.preventDefault()
    const flag = (event, msg) => { setViolations((n) => n + 1); setWarning(msg); report(event) }
    const wipeClipboard = () => navigator.clipboard?.writeText('').catch(() => {})

    const onKey = (e) => {
      const k = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey
      if (k === 'printscreen' || k === 'snapshot') {
        e.preventDefault(); wipeClipboard(); setHidden(true)
        flag('screenshot', 'Percobaan screenshot terdeteksi dan dicatat.')
        setTimeout(() => setHidden(false), 1500)
      } else if (e.metaKey && e.shiftKey && k === 's') { // Win+Shift+S
        e.preventDefault(); setHidden(true); flag('screenshot', 'Percobaan screenshot terdeteksi dan dicatat.')
      } else if (k === 'f12' || (ctrl && e.shiftKey && ['i', 'j', 'c', 's'].includes(k))) {
        e.preventDefault(); flag('pelanggaran', 'Membuka alat pengembang tidak diizinkan.')
      } else if (ctrl && BLOCKED_CTRL.includes(k)) {
        e.preventDefault()
        if (k === 'c' || k === 'v' || k === 'x') flag('salin_tempel', 'Salin/tempel dinonaktifkan selama ujian.')
      }
    }
    const onKeyUp = (e) => { if (e.key === 'PrintScreen') { wipeClipboard(); setHidden(true); setTimeout(() => setHidden(false), 1500) } }
    const onLeave = (event) => () => { setHidden(true); flag(event, 'Anda meninggalkan halaman ujian. Pelanggaran dicatat dan dilaporkan ke pengawas.') }
    const onVisible = () => { if (document.hidden) { setHidden(true); flag('pindah_tab', 'Anda berpindah tab/aplikasi. Pelanggaran dicatat dan dilaporkan ke pengawas.') } }
    const onBlur = onLeave('pindah_tab')
    const onFocus = () => { if (!document.hidden) setHidden(false) }
    const onFs = () => setFullscreen(fsActive())
    const onBeforePrint = () => setHidden(true)
    const onAfterPrint = () => setHidden(false)

    const clip = (e) => { e.preventDefault(); flag('salin_tempel', 'Salin/tempel dinonaktifkan selama ujian.') }
    const pairs = [['copy', clip], ['cut', clip], ['paste', clip], ['contextmenu', stop], ['dragstart', stop]]
    pairs.forEach(([ev, fn]) => document.addEventListener(ev, fn))
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('webkitfullscreenchange', onFs)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    setFullscreen(fsActive())
    return () => {
      pairs.forEach(([ev, fn]) => document.removeEventListener(ev, fn))
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('webkitfullscreenchange', onFs)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [active, report])

  const enterFullscreen = requestFs
  const dismiss = () => { setWarning(''); setHidden(false) }
  return { violations, warning, hidden, fullscreen, enterFullscreen, dismiss }
}
