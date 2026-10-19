import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ClipboardList, CheckCircle2, TrendingUp, Timer, Play, Lock, Clock3, Info, Trophy } from 'lucide-react'
import { api } from '../api.js'
import { Button, Card, Modal, Input, ErrorText } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { openCamera, cameraError } from '../components/useCamera.js'

const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

function Chip({ tone, icon: Icon, children }) {
  const t = { amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-700', green: 'bg-emerald-100 text-emerald-700', slate: 'bg-slate-100 text-slate-600', red: 'bg-red-100 text-red-700' }[tone]
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${t}`}>{Icon && <Icon size={12} />}{children}</span>
}

export default function Jadwal() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [exams, setExams] = useState(null)
  const [filter, setFilter] = useState('semua')
  const [pick, setPick] = useState(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { api('/me/exams').then(setExams) }, [])
  if (!exams) return <p className="text-slate-500">Memuat...</p>

  const now = Date.now()
  const h = new Date().getHours()
  const sapa = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'
  const done = exams.filter((e) => e.status === 'selesai')
  const today = exams.filter((e) => e.dibuka && e.status !== 'selesai')
  const scores = done.map((e) => e.skor).filter((s) => s != null)
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1).replace('.', ',') : '–'
  const totalDur = exams.reduce((s, e) => s + e.durasiMenit, 0)
  const shown = exams.filter((e) => filter === 'semua' || (filter === 'selesai' ? e.status === 'selesai' : e.status !== 'selesai'))

  const start = async () => {
    setError('')
    // Kamera wajib: pastikan izin & perangkat tersedia sebelum waktu ujian mulai berjalan
    try { (await openCamera()).getTracks().forEach((t) => t.stop()) }
    catch (err) { setError(cameraError(err)); return }
    try { const d = await api(`/me/exams/${pick.id}/start`, { method: 'POST', body: { token } }); nav(`/ujian/${d.attemptId}`) }
    catch (err) { setError(err.message) }
  }

  const stats = [
    [ClipboardList, 'Ujian dibuka', today.length, `dari ${exams.length} total`],
    [CheckCircle2, 'Selesai', done.length, 'ujian'],
    [TrendingUp, 'Rata-rata nilai', avg, 'dari 100'],
    [Timer, 'Total durasi', totalDur, 'menit'],
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400">{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
        <h2 className="text-3xl font-extrabold text-blue-950 mt-1">{sapa}, {user.nama.split(' ')[0]}</h2>
        <p className="text-slate-500 mt-1 max-w-xl text-sm">{today.length ? `Ada ${today.length} ujian yang sedang dibuka.` : 'Belum ada ujian yang dibuka.'} Siapkan token dari pengawas — waktu pengerjaan berjalan otomatis begitu soal dibuka.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(([Icon, l, v, s]) => (
          <Card key={l} className="!p-4"><p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400"><Icon size={14} /> {l}</p><p className="mt-2"><span className="text-2xl font-extrabold text-blue-950">{v}</span> <span className="text-xs text-slate-400">{s}</span></p></Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white border border-line rounded-full p-1">
          {[['semua', 'Semua'], ['aktif', 'Aktif'], ['selesai', 'Selesai']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${filter === k ? 'bg-blue-950 text-white' : 'text-slate-500 hover:text-blue-950'}`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{shown.length} ujian ditampilkan</span>
      </div>

      {shown.length === 0 && <Card className="text-slate-500 text-center py-10">Belum ada ujian pada kategori ini.</Card>}
      <div className="grid md:grid-cols-2 gap-4">
        {shown.map((e) => {
          const open = e.dibuka
          const status = e.status === 'selesai' ? <Chip tone="green" icon={CheckCircle2}>Selesai</Chip>
            : e.status === 'sedang_mengerjakan' ? <Chip tone="amber" icon={Clock3}>Sedang berjalan</Chip>
            : open ? <Chip tone="blue" icon={Play}>Dibuka</Chip> : <Chip tone="slate" icon={Lock}>Belum dibuka</Chip>
          return (
            <Card key={e.id} className={`space-y-4 ${e.status === 'sedang_mengerjakan' ? '!border-amber-300' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div><p className="text-[11px] uppercase tracking-widest text-slate-400">UJIAN-{String(e.id).padStart(2, '0')} · SELEKSI</p><h3 className="text-lg font-bold text-blue-950 leading-snug">{e.judul}</h3></div>
                {status}
              </div>
              <dl className="grid grid-cols-3 gap-2 border-y border-line py-3 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wider text-slate-400">Soal</dt><dd className="font-bold text-blue-950">{e.jumlahSoal} butir</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-slate-400">Durasi</dt><dd className="font-bold text-blue-950">{e.durasiMenit} menit</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-slate-400">Pendaftaran</dt><dd className="font-bold text-blue-950">{e.dibuka ? 'Dibuka' : 'Ditutup'}<span className="block text-xs font-medium text-slate-500">{e.dibukaSampai ? `s.d. ${fmtTime(e.dibukaSampai)}` : 'menunggu token'}</span></dd></div>
              </dl>

              {e.status === 'selesai' && (e.skor != null ? (
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-1.5 text-slate-500"><Trophy size={14} className="text-amber-500" /> Nilai</span><b className="text-blue-950">{String(e.skor).replace('.', ',')} <span className="text-xs text-slate-400">KKM {e.nilaiKelulusan}</span></b></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${e.kelulusan === 'lulus' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, e.skor)}%` }} /></div>
                </div>
              ) : <p className="text-sm text-slate-500 flex items-center gap-2"><Info size={14} /> Jawaban terkirim. Nilai belum ditampilkan oleh Admin.</p>)}
              {e.status === 'belum_mulai' && <p className="text-sm text-slate-500 flex items-start gap-2"><Info size={14} className="mt-0.5 shrink-0" /> {open ? 'Masukkan token dari pengawas. Waktu berjalan begitu soal dibuka.' : 'Ujian belum dibuka. Tunggu pengawas membagikan token.'}</p>}

              <div className="flex gap-2">
                {e.status === 'belum_mulai' && <Button disabled={!open} onClick={() => { setPick(e); setToken(''); setError('') }}>{open ? <><Play size={15} /> Mulai ujian</> : <><Lock size={15} /> Belum dibuka</>}</Button>}
                {e.status === 'sedang_mengerjakan' && <Button variant="accent" onClick={() => nav(`/ujian/${e.attemptId}`)}><Play size={15} /> Lanjutkan ujian</Button>}
                {e.status === 'selesai' && <Button variant="ghost" onClick={() => nav(`/hasil/${e.id}`)}>Lihat hasil</Button>}
                <Link to="/tata-tertib" className="inline-flex items-center px-3 py-2 text-sm font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-50">Tata tertib</Link>
              </div>
            </Card>
          )
        })}
      </div>

      {pick && (
        <Modal title={pick.judul} onClose={() => setPick(null)}>
          <h3 className="font-semibold text-sm mb-1">Petunjuk pengerjaan</h3>
          <div className="text-sm text-slate-600 whitespace-pre-wrap mb-4 bg-slate-50 rounded-xl p-3">
            {pick.petunjuk || `• Waktu pengerjaan ${pick.durasiMenit} menit dan berjalan di server.\n• Jangan keluar dari halaman ujian; aktivitas Anda dipantau.\n• Jawaban tersimpan otomatis. Kirim jawaban sebelum waktu habis.`}
          </div>
          <p className="text-sm bg-blue-50 text-blue-900 rounded-xl px-3 py-2 mb-4">Ujian ini memakai kamera. Foto wajah Anda diambil setiap 60 detik untuk pengawasan dan dihapus otomatis setelah 7 hari. Saat menekan Buka soal, izinkan akses kamera.</p>
          <Input label="Token ujian (dari Admin)" value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 mt-4"><Button variant="ghost" onClick={() => setPick(null)}>Batal</Button><Button variant="accent" onClick={start} disabled={!token.trim()}>Buka soal</Button></div>
        </Modal>
      )}
    </div>
  )
}
