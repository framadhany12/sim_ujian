export const NAMA_APLIKASI = 'SIM Ujian Politeknik TEDC'
export const PEMBUAT = 'Faishal Ramadhany Sukandar'

export default function Footer({ onDark = false, className = '' }) {
  const muted = onDark ? 'text-blue-200' : 'text-slate-500'
  const strong = onDark ? 'text-white' : 'text-blue-950'
  return (
    <footer className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs ${muted} ${className}`}>
      <p><span className={`font-semibold ${strong}`}>{NAMA_APLIKASI}</span> &copy; {new Date().getFullYear()}</p>
      <p>Dibuat oleh <span className={`font-semibold ${strong}`}>{PEMBUAT}</span></p>
    </footer>
  )
}
