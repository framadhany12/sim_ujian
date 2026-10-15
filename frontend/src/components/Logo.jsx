import { useState } from 'react'

export const INSTITUSI = 'Politeknik TEDC'

// Logo resmi: frontend/public/logo.png (wordmark). onDark = dibungkus kartu putih agar terbaca di latar gelap.
export default function Logo({ height = 34, onDark = false, className = '' }) {
  const [failed, setFailed] = useState(false)
  const img = failed ? (
    <span className="font-extrabold text-blue-900 tracking-tight" style={{ fontSize: height * 0.55 }}>{INSTITUSI}</span>
  ) : (
    <img src="/logo.png" alt="Logo Politeknik TEDC" style={{ height }} className="w-auto object-contain" onError={() => setFailed(true)} />
  )
  return onDark
    ? <span className={`inline-flex items-center bg-white rounded-2xl px-4 py-2.5 shadow-lg ${className}`}>{img}</span>
    : <span className={`inline-flex items-center ${className}`}>{img}</span>
}
