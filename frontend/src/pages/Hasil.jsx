import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Hourglass, ArrowLeft, Check, X, Minus } from 'lucide-react'
import { api } from '../api.js'
import { Card } from '../components/ui.jsx'

const fmt = (n) => String(n).replace('.', ',')
const dt = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export default function Hasil() {
  const { examId } = useParams()
  return examId ? <Detail examId={examId} /> : <Daftar />
}

function Daftar() {
  const [exams, setExams] = useState(null)
  useEffect(() => { api('/me/exams').then((l) => setExams(l.filter((e) => e.status === 'selesai'))) }, [])
  if (!exams) return <p className="text-slate-500">Memuat...</p>
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div><h2 className="text-3xl font-extrabold text-blue-950">Hasil ujian</h2><p className="text-slate-500 mt-1 text-sm">Ujian yang sudah Anda kirim. Nilai tampil bila diizinkan oleh Admin.</p></div>
      {exams.length === 0 && <Card className="text-center text-slate-500 py-10">Belum ada ujian yang selesai.</Card>}
      {exams.map((e) => (
        <Card key={e.id} className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48"><p className="font-bold text-blue-950">{e.judul}</p><p className="text-xs text-slate-500">Dikumpulkan {dt(e.waktuSelesai)}</p></div>
          {e.skor != null ? <p className="text-2xl font-extrabold text-blue-950">{fmt(e.skor)}<span className="text-xs text-slate-400 font-medium"> /100</span></p> : <span className="text-sm text-slate-400">Nilai belum dibuka</span>}
          <Link to={`/hasil/${e.id}`} className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 hover:bg-slate-50">Lihat detail</Link>
        </Card>
      ))}
    </div>
  )
}

function Detail({ examId }) {
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/me/exams/${examId}/result`).then(setR).catch((e) => setError(e.message)) }, [examId])

  const back = <Link to="/hasil" className="inline-flex items-center gap-1 text-sm text-blue-700 font-semibold"><ArrowLeft size={15} /> Semua hasil</Link>
  if (error) return <Card>{error}</Card>
  if (!r) return <p className="text-slate-500">Memuat...</p>
  if (!r.tampil) return (
    <div className="max-w-xl mx-auto space-y-4">{back}
      <Card className="text-center py-10"><Hourglass className="mx-auto text-amber-500 mb-3" size={36} /><h3 className="font-bold text-blue-950 text-lg">Jawaban Anda sudah terkirim</h3><p className="text-slate-500 text-sm mt-1">Hasil ujian belum dibuka oleh Admin. Silakan cek kembali nanti.</p></Card>
    </div>
  )

  const objektif = r.rincian.filter((q) => q.tipe !== 'esai')
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  const benar = objektif.filter((q) => q.jawaban && norm(q.jawaban) === norm(q.kunci)).length
  const kosong = r.rincian.filter((q) => !q.jawaban).length
  const salah = objektif.length - benar - objektif.filter((q) => !q.jawaban).length
  const terpakai = r.waktuMulai && r.waktuSelesai ? Math.max(1, Math.round((new Date(r.waktuSelesai) - new Date(r.waktuMulai)) / 60000)) : null
  const st = {
    lulus: ['bg-emerald-100 text-emerald-700', CheckCircle2, `Lulus — di atas KKM ${r.nilaiKelulusan}`],
    tidak_lulus: ['bg-red-100 text-red-700', XCircle, `Belum lulus — di bawah KKM ${r.nilaiKelulusan}`],
    belum: ['bg-amber-100 text-amber-800', Hourglass, 'Menunggu penilaian esai'],
  }[r.status]
  const StIcon = st[1]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>{back}<p className="text-[11px] uppercase tracking-widest text-slate-400 mt-3">Dikumpulkan {dt(r.waktuSelesai)}</p><h2 className="text-3xl font-extrabold text-blue-950">Hasil {r.judul}</h2></div>
      </div>

      <Card className="grid md:grid-cols-[1fr_1fr] gap-6">
        <div>
          <span className={`inline-flex items-center gap-2 text-sm font-semibold rounded-full px-3 py-1.5 ${st[0]}`}><StIcon size={15} /> {st[2]}</span>
          <p className="mt-6 text-7xl font-extrabold text-blue-950 tracking-tight">{fmt(r.skor)}</p>
          <p className="text-sm text-slate-400 mt-1">dari 100</p>
          <div className="h-2 rounded-full bg-slate-100 mt-5"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-amber-400" style={{ width: `${Math.min(100, r.skor)}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">
          {[['Benar', benar, 'text-emerald-600'], ['Salah', Math.max(0, salah), 'text-red-600'], ['Kosong', kosong, 'text-slate-600'], ['Waktu terpakai', terpakai ? `${terpakai} mnt` : '-', 'text-blue-950']].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-page p-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">{l}</p><p className={`text-2xl font-extrabold ${c}`}>{v}</p></div>
          ))}
        </div>
      </Card>

      <h3 className="font-bold text-blue-950 pt-2">Pembahasan per soal</h3>
      {r.rincian.map((q, i) => {
        const isEssay = q.tipe === 'esai'
        const ok = !isEssay && q.jawaban && norm(q.jawaban) === norm(q.kunci)
        const Icon = isEssay ? Minus : !q.jawaban ? Minus : ok ? Check : X
        const tone = isEssay ? 'bg-slate-100 text-slate-500' : ok ? 'bg-emerald-100 text-emerald-700' : !q.jawaban ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'
        return (
          <Card key={q.id} className="space-y-2">
            <div className="flex items-center gap-3"><span className={`grid place-items-center w-8 h-8 rounded-full ${tone}`}><Icon size={15} /></span><span className="text-sm font-semibold text-blue-950">Soal {i + 1}</span><span className="ml-auto text-xs text-slate-400">Nilai {q.nilai ?? '-'} / {q.bobot}</span></div>
            <p className="whitespace-pre-wrap">{q.teks}</p>
            {q.opsi.length > 0 && <ul className="text-sm text-slate-600 space-y-1">{q.opsi.map((o) => <li key={o.label} className={o.label === q.kunci ? 'font-semibold text-emerald-700' : ''}>{o.label}. {o.teks}</li>)}</ul>}
            <p className="text-sm"><b>Jawaban Anda:</b> {q.jawaban || <i className="text-slate-400">(kosong)</i>}</p>
            {!isEssay && <p className="text-sm text-emerald-700"><b>Kunci:</b> {q.kunci}</p>}
            {q.pembahasan && <p className="text-sm bg-amber-50 border border-amber-100 rounded-xl p-3 text-slate-700"><b>Pembahasan:</b> {q.pembahasan}</p>}
          </Card>
        )
      })}
    </div>
  )
}
