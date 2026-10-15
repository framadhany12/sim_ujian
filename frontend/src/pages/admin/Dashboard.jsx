import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarClock, Activity, CheckCircle2, Download, FileText, KeyRound, PenLine, WifiOff, FileQuestion, ChevronRight, CalendarDays } from 'lucide-react'
import { api } from '../../api.js'
import { Card, fmtDate } from '../../components/ui.jsx'

const EVENT_LABEL = {
  login: 'masuk ke aplikasi', mulai: 'memulai ujian', submit: 'mengirim jawaban', keluar_halaman: 'keluar dari halaman ujian',
  kembali_halaman: 'kembali ke halaman ujian', reconnect: 'tersambung kembali', ganti_password: 'mengganti password',
  tambah_peserta: 'menambah peserta', impor_peserta: 'impor peserta', reset_password: 'reset password', buat_ujian: 'membuat ujian',
  ubah_ujian: 'mengubah ujian', hapus_ujian: 'menghapus ujian', impor_soal: 'impor soal', nilai_esai: 'menilai esai',
  minta_reset: 'meminta reset password', ubah_peserta: 'mengubah peserta', hapus_peserta: 'menghapus peserta', atur_tampil_hasil: 'mengatur tampil hasil',
}

function Stat({ icon: Icon, label, value, hint, trend }) {
  return (
    <Card className="!p-4">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600"><Icon size={17} /></span>
      <p className="text-sm text-slate-500 mt-4">{label}</p>
      <p className="text-3xl font-extrabold text-blue-950 tracking-tight">{value}</p>
      {hint && <span className={`inline-block mt-2 text-xs font-semibold rounded-full px-2 py-0.5 ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{hint}</span>}
    </Card>
  )
}

function Segments({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-0.5">
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => <div key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-slate-600">
        {parts.map((p) => <span key={p.label} className="flex items-center gap-1.5"><i className={`w-2 h-2 rounded-full ${p.color}`} />{p.label} <b className="text-blue-950">{p.value}</b></span>)}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [d, setD] = useState(null)
  useEffect(() => {
    const load = () => api('/admin/dashboard').then(setD)
    load(); const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])
  if (!d) return <p className="text-slate-500">Memuat dashboard...</p>

  const maxBin = Math.max(1, ...d.distribusiSkor)
  const maxDay = Math.max(1, ...d.perHari.map((x) => x.jumlah))
  const attention = [
    { icon: KeyRound, label: 'Permintaan reset password', n: d.mintaReset, to: '/admin/peserta' },
    { icon: PenLine, label: 'Jawaban esai belum dinilai', n: d.esaiBelumDinilai, to: '/admin/nilai' },
    { icon: WifiOff, label: 'Peserta koneksi terputus', n: d.terputus, to: '/admin/monitor' },
    { icon: FileQuestion, label: 'Ujian belum punya soal', n: d.ujianTanpaSoal, to: '/admin/ujian' },
  ]

  return (
    <div className="space-y-5">
      <Card className="!p-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-medium border border-line rounded-xl px-3 py-2"><CalendarDays size={16} /> {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
        <span className="flex-1" />
        <Link to="/admin/nilai" className="text-sm font-medium px-3 py-2 hover:text-blue-700">Lihat laporan</Link>
        <Link to="/admin/nilai" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl px-4 py-2"><Download size={15} /> Ekspor</Link>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.6fr]">
        <Stat icon={Users} label="Peserta aktif" value={d.pesertaAktif} hint={`${d.pesertaTotal} terdaftar`} />
        <Stat icon={Activity} label="Sedang mengerjakan" value={d.sedangMengerjakan} hint="saat ini" trend={d.sedangMengerjakan ? 'up' : ''} />
        <Stat icon={CheckCircle2} label="Ujian selesai" value={d.selesai} hint={d.rataRata != null ? `rata-rata ${d.rataRata}` : 'belum ada nilai'} trend={d.selesai ? 'up' : ''} />
        <Card className="!p-4 md:col-span-2 xl:col-span-1">
          <div className="flex justify-between items-start">
            <div><p className="text-sm text-slate-500">Sebaran skor</p><p className="text-3xl font-extrabold text-blue-950">{d.rataRata ?? '–'}<span className="text-sm font-medium text-slate-400"> rata-rata</span></p></div>
            <span className="text-[11px] text-slate-400">{d.selesai} hasil</span>
          </div>
          <div className="flex items-end gap-3 h-24 mt-3">
            {d.distribusiSkor.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end h-16"><div className={`rounded-md ${i >= 3 ? 'bg-amber-400' : 'bg-blue-700'}`} style={{ height: `${Math.max(6, (n / maxBin) * 100)}%`, opacity: n ? 1 : 0.2 }} /></div>
                <span className="text-[10px] text-slate-400">{i * 20}–{i * 20 + 20}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="space-y-5">
            <div className="flex items-center justify-between"><h2 className="font-bold text-blue-950">Status ujian</h2><Link to="/admin/monitor" className="text-xs text-blue-700 font-semibold">Pantau langsung →</Link></div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Pengerjaan</p>
              <Segments parts={[
                { label: 'Sedang mengerjakan', value: d.sedangMengerjakan, color: 'bg-amber-400' },
                { label: 'Selesai', value: d.selesai, color: 'bg-blue-700' },
              ]} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Kelulusan</p>
              <Segments parts={[
                { label: 'Lulus', value: d.lulus, color: 'bg-emerald-500' },
                { label: 'Tidak lulus', value: d.tidakLulus, color: 'bg-red-500' },
                { label: 'Menunggu nilai esai', value: d.menungguNilai, color: 'bg-slate-300' },
              ]} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-xs text-slate-500 mb-2">Token aktif</p>
                {d.aktifSekarang.length === 0 && <p className="text-sm text-slate-400">Belum ada token aktif.</p>}
                {d.aktifSekarang.map((e) => (
                  <Link key={e.id} to={`/admin/monitor?exam=${e.id}`} className="flex items-center justify-between rounded-xl border border-line p-3 mb-2 hover:bg-slate-50 text-sm">
                    <span><b className="text-blue-950">{e.judul}</b><span className="block text-xs text-slate-500">token berlaku sampai {fmtDate(e.expiresAt)}</span></span><ChevronRight size={16} className="text-slate-400" />
                  </Link>
                ))}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">Belum dibuka</p>
                {d.tanpaToken.length === 0 && <p className="text-sm text-slate-400">Semua ujian aktif sedang dibuka.</p>}
                {d.tanpaToken.map((e) => (
                  <Link key={e.id} to={`/admin/token?exam=${e.id}`} className="flex items-center justify-between rounded-xl border border-line p-3 mb-2 text-sm hover:bg-slate-50"><span><b className="text-blue-950">{e.judul}</b><span className="block text-xs text-slate-500">{e.durasiMenit} menit · buat token</span></span><ChevronRight size={16} className="text-slate-400" /></Link>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-blue-950 mb-3">Aktivitas terbaru</h2>
            {d.aktivitas.length === 0 && <p className="text-sm text-slate-400">Belum ada aktivitas.</p>}
            <ul className="divide-y divide-line">
              {d.aktivitas.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-amber-100 text-blue-950 text-xs font-bold">{a.siapa[0]?.toUpperCase()}</span>
                  <span className="flex-1"><b className="text-blue-950">{a.siapa}</b> {EVENT_LABEL[a.event] ?? a.event}</span>
                  <span className="text-xs text-slate-400">{fmtDate(a.waktu)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-blue-950">Peserta mulai ujian</h2><span className="text-[11px] text-slate-400">14 hari</span></div>
            <div className="grid grid-cols-7 gap-1.5">
              {d.perHari.map((x) => (
                <div key={x.tanggal} title={`${new Date(x.tanggal).toLocaleDateString('id-ID')}: ${x.jumlah}`} className="aspect-square rounded-lg bg-blue-700"
                  style={{ opacity: x.jumlah ? 0.25 + 0.75 * (x.jumlah / maxDay) : 0.08 }} />
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Makin pekat, makin banyak peserta yang mulai.</p>
          </Card>

          <Card>
            <h2 className="font-bold text-blue-950 mb-3">Perlu perhatian</h2>
            <ul className="divide-y divide-line">
              {attention.map(({ icon: Icon, label, n, to }) => (
                <li key={label}>
                  <Link to={to} className="flex items-center gap-3 py-3 text-sm hover:text-blue-700">
                    <span className={`grid place-items-center w-8 h-8 rounded-lg ${n ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}><Icon size={16} /></span>
                    <span className="flex-1">{label}</span><b className="text-blue-950">{n}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="!bg-blue-950 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-400/90" />
            <FileText className="text-amber-300" size={20} />
            <p className="font-bold mt-2 relative">Bank soal: {d.soal} soal</p>
            <p className="text-blue-200 text-xs mt-1 mb-3 max-w-[11rem]">{d.ujian} ujian tersedia.</p>
            <Link to="/admin/soal" className="inline-block text-xs font-bold bg-white text-blue-950 rounded-lg px-3 py-1.5">Kelola soal</Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
