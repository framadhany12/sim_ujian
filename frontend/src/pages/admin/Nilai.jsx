import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api, download } from '../../api.js'
import { useExamPicker } from '../../components/ExamPicker.jsx'
import { Button, Card, Badge, fmtDate } from '../../components/ui.jsx'

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
// Rentang tanggal lokal browser → batas ISO; "sampai" ikut dihitung sampai akhir harinya
const rangeQuery = (dari, sampai) => {
  const p = new URLSearchParams()
  if (dari) p.set('from', new Date(`${dari}T00:00:00`).toISOString())
  if (sampai) { const e = new Date(`${sampai}T00:00:00`); e.setDate(e.getDate() + 1); p.set('to', e.toISOString()) }
  return p.toString()
}

const KL = { lulus: ['green', 'Lulus'], tidak_lulus: ['red', 'Tidak lulus'], belum: ['slate', 'Belum dinilai'] }

export default function Nilai() {
  const { examId, picker, loaded } = useExamPicker()
  const [rekap, setRekap] = useState(null)
  const [essays, setEssays] = useState([])
  const [draft, setDraft] = useState({})
  const [dari, setDari] = useState(today)
  const [sampai, setSampai] = useState(today)
  const [rekapError, setRekapError] = useState('')
  const qs = rangeQuery(dari, sampai)

  const load = useCallback(() => {
    if (!examId) return
    setRekap(null); setRekapError('')
    api(`/admin/exams/${examId}/rekap?${qs}`).then(setRekap).catch((e) => setRekapError(e.message))
    api(`/admin/exams/${examId}/essays`).then(setEssays)
  }, [examId, qs])
  useEffect(() => { load() }, [load])

  const grade = async (a) => {
    try {
      await api(`/admin/answers/${a.id}/nilai`, { method: 'PUT', body: { nilai: draft[a.id] } })
      setDraft((d) => { const n = { ...d }; delete n[a.id]; return n }); load()
    } catch (err) { alert(err.message) }
  }

  if (!loaded) return <Card className="text-slate-500">Belum ada ujian.</Card>
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-semibold">Penilaian & Rekap Nilai</h1>
        <Button variant="ghost" onClick={() => download(`/admin/exams/${examId}/report?format=xlsx&${qs}`, 'laporan-hasil-ujian.xlsx')}><Download size={16} /> Unduh Laporan</Button>
      </div>
      {picker}

      <section className="space-y-3">
        <h2 className="font-semibold">Penilaian Esai ({essays.filter((e) => e.nilai == null).length} belum dinilai)</h2>
        {essays.length === 0 && <Card className="text-sm text-slate-500">Tidak ada jawaban esai yang perlu dinilai.</Card>}
        {essays.map((a) => (
          <Card key={a.id} className="space-y-2">
            <div className="flex justify-between text-sm"><b>{a.peserta}</b>{a.nilai != null ? <Badge color="green">nilai {a.nilai}</Badge> : <Badge color="amber">belum dinilai</Badge>}</div>
            <p className="text-sm text-slate-500">Soal: {a.soal}</p>
            <p className="whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-sm">{a.jawaban || <i>(kosong)</i>}</p>
            <div className="flex items-center gap-2 text-sm">
              <input type="number" min="0" max={a.bobot} step="0.01" className="border rounded-lg px-2 py-1 w-24"
                value={draft[a.id] ?? a.nilai ?? ''} onChange={(e) => setDraft({ ...draft, [a.id]: e.target.value })} />
              <span className="text-slate-500">/ {a.bobot}</span>
              <Button disabled={draft[a.id] === undefined || draft[a.id] === ''} onClick={() => grade(a)}>Simpan nilai</Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="font-semibold mr-auto">Rekap Nilai</h2>
          <label className="text-sm text-slate-600">Dari tanggal
            <input type="date" value={dari} max={sampai || undefined} onChange={(e) => setDari(e.target.value)} className="block mt-1 border border-slate-300 rounded-xl px-3 py-2 bg-white" />
          </label>
          <label className="text-sm text-slate-600">Sampai tanggal
            <input type="date" value={sampai} min={dari || undefined} onChange={(e) => setSampai(e.target.value)} className="block mt-1 border border-slate-300 rounded-xl px-3 py-2 bg-white" />
          </label>
          <Button variant="ghost" onClick={() => { setDari(today()); setSampai(today()) }}>Hari ini</Button>
          <Button variant="ghost" onClick={() => { setDari(''); setSampai('') }}>Semua tanggal</Button>
        </div>
        <p className="text-xs text-slate-500">{dari || sampai ? 'Hanya peserta yang mulai mengerjakan pada rentang tanggal ini. Unduh Laporan memakai filter yang sama.' : 'Menampilkan semua tanggal.'}</p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>{['#', 'Nama', 'Grup', 'Status', 'Skor', 'Kelulusan', 'Selesai'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rekap?.rows.map((r, i) => (
                <tr key={r.username} className="border-t">
                  <td className="px-4 py-2">{i + 1}</td><td className="px-4 py-2">{r.nama}</td><td className="px-4 py-2">{r.grup}</td>
                  <td className="px-4 py-2">{r.status.replace('_', ' ')}</td><td className="px-4 py-2 font-semibold">{r.skor ?? '-'}</td>
                  <td className="px-4 py-2"><Badge color={KL[r.kelulusan][0]}>{KL[r.kelulusan][1]}</Badge></td>
                  <td className="px-4 py-2">{fmtDate(r.waktuSelesai)}</td>
                </tr>
              ))}
              {!rekap && !rekapError && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Memuat rekap…</td></tr>}
              {rekapError && <tr><td colSpan={7} className="px-4 py-6 text-center text-red-600">Gagal memuat rekap: {rekapError}</td></tr>}
              {rekap?.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">{dari || sampai ? 'Tidak ada peserta yang mengerjakan pada rentang tanggal ini. Pilih tanggal lain atau klik "Semua tanggal".' : 'Belum ada peserta yang mengerjakan.'}</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}
