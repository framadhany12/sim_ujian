import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

const pad = (n) => String(n).padStart(2, '0')
const format = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`

// Hitung mundur berbasis waktu berakhir (bukan decrement), jadi tetap akurat
// walau tab di-throttle. Backend nanti memberi `endsAt` dari server.
export default function ExamTimer({ endsAt, onExpire, paused = false }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
  const expired = useRef(false)

  useEffect(() => {
    if (paused) return
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setLeft(s)
      if (s === 0 && !expired.current) { expired.current = true; onExpire?.() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt, onExpire, paused])

  return (
    <div className={`flex items-center gap-2 font-mono text-lg font-bold px-4 py-2 rounded-xl ${left <= 300 ? 'bg-red-100 text-red-700' : 'bg-page text-blue-950'}`}>
      <Clock size={18} /> {format(left)}
    </div>
  )
}
