import { X } from 'lucide-react'

export const Button = ({ variant = 'primary', className = '', ...p }) => {
  const v = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 shadow-sm',
    accent: 'bg-amber-400 text-blue-950 font-bold hover:bg-amber-300 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'border border-slate-300 bg-white hover:bg-slate-50',
  }[variant]
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${v} ${className}`} />
}

export const Input = ({ label, className = '', ...p }) => (
  <label className="block text-sm">
    {label && <span className="block mb-1 text-slate-600">{label}</span>}
    <input {...p} className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} />
  </label>
)

export const Textarea = ({ label, ...p }) => (
  <label className="block text-sm">
    {label && <span className="block mb-1 text-slate-600">{label}</span>}
    <textarea {...p} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  </label>
)

export const Select = ({ label, children, ...p }) => (
  <label className="block text-sm">
    {label && <span className="block mb-1 text-slate-600">{label}</span>}
    <select {...p} className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">{children}</select>
  </label>
)

export const Card = ({ className = '', ...p }) => <div {...p} className={`bg-white border border-line rounded-2xl p-5 ${className}`} />

export const Badge = ({ color = 'slate', children }) => {
  const c = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-700', red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-700',
  }[color]
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c}`}>{children}</span>
}

export const ErrorText = ({ children }) => children ? <p role="alert" className="text-sm text-red-600">{children}</p> : null

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-30 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-md'} my-8`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
export const toLocalInput = (d) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}

// Simpan teks (mis. kredensial) sebagai CSV di sisi klien
export function downloadCsv(rows, filename) {
  const keys = Object.keys(rows[0] ?? {})
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
