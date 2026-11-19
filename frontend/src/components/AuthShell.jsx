import { ShieldCheck, Timer, Laptop, Award } from 'lucide-react'
import Logo, { INSTITUSI } from './Logo.jsx'
import Footer from './Footer.jsx'

const points = [
  [Laptop, 'Ujian dari mana saja', 'Cukup perangkat dan koneksi internet.'],
  [Timer, 'Timer akurat', 'Waktu berjalan di server, tetap adil walau koneksi terputus.'],
  [ShieldCheck, 'Aman & terpusat', 'Akun dan token ujian dikelola langsung oleh Admin.'],
  [Award, 'Hasil lebih cepat', 'Penilaian otomatis untuk soal objektif.'],
]

export default function AuthShell({ children }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hero-pattern bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full border-[28px] border-amber-400/20" />
        <Logo height={54} onDark className="self-start" />
        <div className="my-10 lg:my-0 relative">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase bg-amber-400 text-blue-950 px-3 py-1 rounded-full">Seleksi Calon Mahasiswa Baru</span>
          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight mt-5">Wujudkan masa depanmu bersama <span className="text-amber-300">{INSTITUSI}</span></h1>
          <p className="mt-4 text-blue-100 max-w-lg">Kerjakan ujian seleksi secara online dengan nyaman, aman, dan transparan.</p>
          <ul className="hidden lg:grid sm:grid-cols-2 gap-4 mt-10">
            {points.map(([Icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-lg bg-white/10 text-amber-300"><Icon size={20} /></span>
                <div><p className="font-semibold text-sm">{t}</p><p className="text-xs text-blue-200">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <Footer onDark className="hidden lg:block" />
      </section>
      <section className="flex flex-col p-6 lg:p-12 bg-slate-50">
        <div className="flex-1 grid place-items-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <Footer className="lg:hidden mt-8" />
      </section>
    </main>
  )
}
