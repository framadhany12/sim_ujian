import { Card } from '../components/ui.jsx'
import { Clock, Wifi, Eye, KeyRound, Send, Ban } from 'lucide-react'

const rules = [
  [KeyRound, 'Token ujian', 'Masukkan token dari Admin saat ujian dibuka. Jangan membagikan token kepada orang lain.'],
  [Clock, 'Waktu berjalan di server', 'Timer tidak berhenti walau koneksi terputus atau halaman ditutup. Waktu habis = jawaban dikirim otomatis.'],
  [Eye, 'Tetap di halaman ujian', 'Berpindah tab atau keluar dari halaman ujian dicatat dan dapat dilihat pengawas.'],
  [Wifi, 'Koneksi stabil', 'Jawaban tersimpan otomatis. Bila ada peringatan koneksi, pastikan internet Anda stabil.'],
  [Send, 'Kirim jawaban', 'Periksa soal ragu-ragu dan belum dijawab, lalu kirim. Jawaban tidak dapat diubah setelah dikirim.'],
  [Ban, 'Larangan', 'Dilarang bekerja sama, memakai joki, atau menyebarkan soal ujian dalam bentuk apa pun.'],
]

export default function TataTertib() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div><h2 className="text-3xl font-extrabold text-blue-950">Tata tertib ujian</h2><p className="text-slate-500 mt-1">Baca sebelum memulai agar ujian berjalan lancar dan adil.</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        {rules.map(([Icon, t, d]) => (
          <Card key={t}><span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-100 text-blue-800"><Icon size={19} /></span><h3 className="font-bold text-blue-950 mt-3">{t}</h3><p className="text-sm text-slate-500 mt-1">{d}</p></Card>
        ))}
      </div>
    </div>
  )
}
