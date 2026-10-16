import { useEffect, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from './ui.jsx'

// Pengganti window.confirm: `await confirmDialog({ title, message, confirmText, danger })` → true / false.
// <ConfirmHost /> harus dirender sekali di root aplikasi.
let open = null
export const confirmDialog = (opts) => new Promise((resolve) => {
  if (!open) return resolve(window.confirm(opts.message))
  open({ ...opts, resolve })
})

export function ConfirmHost() {
  const [d, setD] = useState(null)
  useEffect(() => { open = setD; return () => { open = null } }, [])

  const close = (ok) => { d?.resolve(ok); setD(null) }
  useEffect(() => {
    if (!d) return
    const onKey = (e) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!d) return null
  const danger = d.danger !== false
  const Icon = danger ? AlertTriangle : HelpCircle
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => close(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
        <span className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${danger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}><Icon size={28} /></span>
        <h2 id="confirm-title" className="text-lg font-bold text-blue-950">{d.title || 'Konfirmasi'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => close(false)} autoFocus>{d.cancelText || 'Batal'}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)}>{d.confirmText || 'Ya, lanjutkan'}</Button>
        </div>
      </div>
    </div>
  )
}
