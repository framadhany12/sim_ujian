import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { KeyRound, Copy, Check, Timer, Ban, Wand2, AlertCircle } from 'lucide-react'
import { api } from '../../api.js'
import { Button, Card, Badge, ErrorText, fmtDate } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const DURASI = [['30m', '30 menit'], ['1h', '1 jam'], ['4h', '4 jam'], ['12h', '12 jam'], ['1d', '1 hari']]

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}
function sisa(expiresAt, now) {
  const s = Math.max(0, Math.floor((new Date(expiresAt) - now) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')}`
}

function CopyToken({ token, big }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard?.writeText(token); setOk(true); setTimeout(() => setOk(false), 1200) }}
      className={`group inline-flex items-center gap-3 font-mono font-extrabold tracking-[0.3em] text-blue-950 bg-amber-100 hover:bg-amber-200 rounded-2xl ${big ? 'text-4xl px-6 py-4' : 'text-xl px-4 py-2'}`} title="Klik untuk menyalin">
      {token}{ok ? <Check size={big ? 22 : 16} className="text-emerald-600" /> : <Copy size={big ? 20 : 15} className="text-slate-400 group-hover:text-blue-700" />}
    </button>
  )
}

export default function Token() {
  const [sp] = useSearchParams()
  const now = useNow()
  const [exams, setExams] = useState([])
  const [tokens, setTokens] = useState([])
  const [examId, setExamId] = useState(+sp.get('exam') || '')
  const [durasi, setDurasi] = useState('1h')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState(null)

  const load = () => { api('/admin/exams').then(setExams); api('/admin/tokens').then(setTokens) }
  useEffect(() => { load() }, [])

  const available = exams.filter((e) => e.aktif)
  const picked = exams.find((e) => e.id === +examId)
  const problem = picked && (picked.jumlahSoal === 0 ? 'Ujian ini belum punya soal (pilih dari bank soal).' : picked.groups.length === 0 ? 'Ujian ini belum dipilihkan grup pelaksana.' : '')

  const generate = async () => {
    setError(''); setBusy(true)
    try { setFresh(await api('/admin/tokens', { method: 'POST', body: { examId: +examId, durasi } })); load() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const revoke = async (t) => {
    if (!(await confirmDialog({ title: 'Cabut token?', message: `Token ${t.token} akan dihapus. Peserta tidak bisa lagi memakainya untuk masuk (yang sudah mengerjakan tidak terganggu).`, confirmText: 'Ya, cabut' }))) return
    await api(`/admin/tokens/${t.id}`, { method: 'DELETE' }); if (fresh?.id === t.id) setFresh(null); load()
  }

  const active = tokens.filter((t) => t.status === 'aktif' && new Date(t.expiresAt) > now)

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-2xl font-extrabold text-blue-950">Token Ujian</h2>
        <p className="text-sm text-slate-500">Pilih ujian yang akan dilaksanakan dan masa berlaku token. Token dibuat otomatis dan dibagikan ke peserta saat ujian dimulai.</p>
      </div>

      <Card className="space-y-5">
        <div className="grid md:grid-cols-[1fr_auto] gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-blue-950 mb-1.5">1. Pilih ujian yang akan dilaksanakan</label>
              <select value={examId} onChange={(e) => { setExamId(e.target.value); setFresh(null); setError('') }} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Pilih ujian —</option>
                {available.map((e) => <option key={e.id} value={e.id}>{e.judul} · {e.durasiMenit} menit · {e.jumlahSoal} soal</option>)}
              </select>
              {available.length === 0 && <p className="text-xs text-amber-700 mt-1.5">Belum ada ujian aktif. Buat atau aktifkan ujian di menu <Link className="underline" to="/admin/ujian">Ujian Tersedia</Link>.</p>}
              {picked && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-slate-500">Grup pelaksana:
                  {picked.groups.length ? picked.groups.map((g) => <span key={g.id} className="font-semibold rounded-full px-2.5 py-1 bg-blue-100 text-blue-800">{g.nama}</span>) : <i>belum ada</i>}
                </div>
              )}
              {problem && <p className="flex items-center gap-1.5 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mt-2"><AlertCircle size={15} /> {problem} <Link className="underline" to={picked.jumlahSoal === 0 ? `/admin/ujian/${picked.id}/soal` : '/admin/ujian'}>Perbaiki</Link></p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-blue-950 mb-1.5">2. Token aktif selama</label>
              <div className="flex flex-wrap gap-2">
                {DURASI.map(([k, l]) => (
                  <button key={k} onClick={() => setDurasi(k)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${durasi === k ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                    <Timer size={13} className="inline -mt-0.5 mr-1.5" />{l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Token hanya dipakai untuk <b>masuk</b> ujian. Peserta yang sudah mulai tetap bisa menyelesaikan ujiannya sesuai durasi walau token berakhir.</p>
            </div>
          </div>

          <div className="flex md:flex-col justify-end">
            <Button variant="accent" className="!py-3 !px-6 w-full md:w-auto" disabled={!examId || !!problem || busy} onClick={generate}><Wand2 size={17} /> {busy ? 'Membuat…' : 'Generate token'}</Button>
          </div>
        </div>
        <ErrorText>{error}</ErrorText>

        {fresh && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 text-center space-y-3">
            <p className="text-sm text-slate-600">Token untuk <b className="text-blue-950">{fresh.judul}</b></p>
            <CopyToken token={fresh.token} big />
            <p className="text-sm text-slate-600">Berlaku sampai <b>{fmtDate(fresh.expiresAt)}</b> · sisa <b className="font-mono">{sisa(fresh.expiresAt, now)}</b></p>
            <p className="text-xs text-slate-500">Token lama untuk ujian ini otomatis dihapus. Klik token untuk menyalin.</p>
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <h3 className="font-bold text-blue-950">Token aktif ({active.length})</h3>
        {active.length === 0 && <Card className="text-sm text-slate-500 text-center py-8">Belum ada token aktif. Peserta belum dapat masuk ke ujian apa pun.</Card>}
        {active.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center gap-4">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700"><KeyRound size={18} /></span>
            <div className="flex-1 min-w-48"><p className="font-bold text-blue-950">{t.judul}</p><p className="text-xs text-slate-500">Dibuat {fmtDate(t.createdAt)} · sampai {fmtDate(t.expiresAt)}</p></div>
            <div className="text-center"><p className="text-[11px] uppercase tracking-wider text-slate-400">Sisa waktu</p><p className="font-mono font-bold text-blue-950">{sisa(t.expiresAt, now)}</p></div>
            <CopyToken token={t.token} />
            <button onClick={() => revoke(t)} className="inline-flex items-center gap-1.5 text-sm text-red-600 font-semibold px-3 py-2 rounded-xl border border-line hover:bg-red-50"><Ban size={14} /> Cabut</button>
          </Card>
        ))}
      </section>

    </div>
  )
}
