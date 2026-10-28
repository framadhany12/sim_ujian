import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown, Search, Save, Wand2, AlertTriangle, CheckCircle2, ListPlus, Tags } from 'lucide-react'
import { api } from '../../api.js'
import { Button, Card, ErrorText } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'
import { TipeBadge } from './Soal.jsx'

const r2 = (n) => Math.round(n * 100) / 100
const snapshot = (list) => JSON.stringify(list.map((s) => [s.id, Number(s.bobot)]))

export default function SusunSoal() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [bank, setBank] = useState({ items: [], kategori: [] })
  const [sel, setSel] = useState([])
  const [orig, setOrig] = useState('[]')
  const [q, setQ] = useState('')
  const [tipe, setTipe] = useState('')
  const [kategori, setKategori] = useState('')
  const [samaBobot, setSamaBobot] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [exams, b, cur] = await Promise.all([api('/admin/exams'), api('/admin/questions'), api(`/admin/exams/${id}/questions`)])
    setExam(exams.find((e) => e.id === +id) ?? false)
    setBank(b)
    const list = cur.items.map((x) => ({ id: x.questionId, tipe: x.tipe, teksSoal: x.teksSoal, kategori: x.kategori, bobot: x.bobot, bobotBawaan: x.bobotBawaan }))
    setSel(list); setOrig(snapshot(list))
  }
  useEffect(() => { load() }, [id])

  const dirty = snapshot(sel) !== orig
  useEffect(() => {
    if (!dirty) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const chosen = useMemo(() => new Set(sel.map((s) => s.id)), [sel])
  const available = useMemo(() => bank.items.filter((x) =>
    !chosen.has(x.id) && (!tipe || x.tipe === tipe) && (!kategori || x.kategori === kategori) && (!q || x.teksSoal.toLowerCase().includes(q.toLowerCase()))), [bank, chosen, q, tipe, kategori])
  // Soal yang benar-benar dikerjakan tiap peserta (bila ada batas jumlah soal acak)
  const n = sel.length && exam?.jumlahSoalTampil && exam.jumlahSoalTampil < sel.length ? exam.jumlahSoalTampil : sel.length
  const katInfo = useMemo(() => bank.kategori.map((nama) => ({
    nama,
    total: bank.items.filter((x) => x.kategori === nama).length,
    sisa: bank.items.filter((x) => x.kategori === nama && !chosen.has(x.id)),
  })), [bank, chosen])
  const sumAll = r2(sel.reduce((s, x) => s + (Number(x.bobot) || 0), 0))
  const total = sel.length ? r2((sumAll / sel.length) * n) : 0
  const acak = n < sel.length

  const toItem = (x) => ({ id: x.id, tipe: x.tipe, teksSoal: x.teksSoal, kategori: x.kategori, bobot: x.bobot, bobotBawaan: x.bobot })
  const add = (x) => { setSel([...sel, toItem(x)]); setSaved(false) }
  const addAll = () => { setSel([...sel, ...available.map(toItem)]); setSaved(false) }
  const addKategori = (k) => { setSel([...sel, ...k.sisa.map(toItem)]); setSaved(false) }
  const remove = (sid) => { setSel(sel.filter((s) => s.id !== sid)); setSaved(false) }
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= sel.length) return
    const n = [...sel];[n[i], n[j]] = [n[j], n[i]]; setSel(n); setSaved(false)
  }
  const setBobot = (sid, v) => { setSel(sel.map((s) => (s.id === sid ? { ...s, bobot: v } : s))); setSaved(false) }
  const normalize100 = () => {
    if (!sel.length) return
    const each = Math.floor(10000 / n) / 100
    setSel(sel.map((s, i) => ({ ...s, bobot: !acak && i === sel.length - 1 ? r2(100 - each * (sel.length - 1)) : each }))); setSaved(false)
  }
  const applyAll = () => { if (Number(samaBobot) > 0) { setSel(sel.map((s) => ({ ...s, bobot: Number(samaBobot) }))); setSaved(false) } }
  const resetBawaan = () => { setSel(sel.map((s) => ({ ...s, bobot: s.bobotBawaan }))); setSaved(false) }

  const save = async () => {
    setError('')
    if (sel.some((s) => !(Number(s.bobot) > 0))) return setError('Setiap soal harus punya bobot lebih dari 0.')
    if (exam.jumlahPeserta > 0 && !(await confirmDialog({ title: 'Tetap simpan perubahan?', message: `Ujian ini sudah dikerjakan ${exam.jumlahPeserta} peserta. Mengubah soal atau bobot memengaruhi penilaian.`, confirmText: 'Ya, simpan' }))) return
    setBusy(true)
    try {
      await api(`/admin/exams/${id}/questions`, { method: 'PUT', body: { items: sel.map((s) => ({ questionId: s.id, bobot: Number(s.bobot) })) } })
      await load(); setSaved(true)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (exam === null) return <p className="text-slate-500">Memuat...</p>
  if (exam === false) return <Card>Ujian tidak ditemukan. <Link className="text-blue-700 underline" to="/admin/ujian">Kembali</Link></Card>

  return (
    <div className="space-y-4">
      <Link to="/admin/ujian" className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-semibold"><ArrowLeft size={15} /> Ujian Tersedia</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Atur soal ujian</p>
          <h2 className="text-2xl font-extrabold text-blue-950">{exam.judul}</h2>
          <p className="text-sm text-slate-500">Pilih soal dari bank soal, atur urutan, dan sesuaikan bobot untuk ujian ini. Durasi {exam.durasiMenit} menit.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={16} /> Tersimpan</span>}
          {dirty && <span className="text-sm text-amber-700">Ada perubahan belum disimpan</span>}
          <Button variant="success" disabled={!dirty || busy} onClick={save}><Save size={16} /> {busy ? 'Menyimpan…' : 'Simpan susunan soal'}</Button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className={`grid ${acak ? 'grid-cols-4' : 'grid-cols-3'} gap-3 max-w-2xl`}>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">Jumlah soal</p><p className="text-2xl font-extrabold text-blue-950">{sel.length}</p></Card>
        {acak && <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">Dikerjakan/peserta</p><p className="text-2xl font-extrabold text-blue-950">{n}</p></Card>}
        <Card className={`!p-4 ${Math.abs(total - 100) < 0.5 ? '!border-emerald-300' : ''}`}><p className="text-[11px] uppercase tracking-wider text-slate-400">{acak ? 'Total bobot/peserta' : 'Total bobot'}</p><p className={`text-2xl font-extrabold ${Math.abs(total - 100) < 0.5 ? 'text-emerald-600' : 'text-blue-950'}`}>{total}</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">Rata-rata</p><p className="text-2xl font-extrabold text-blue-950">{sel.length ? r2(total / sel.length) : 0}</p></Card>
      </div>
      {Math.abs(total - 100) >= 0.5 && sel.length > 0 && <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 max-w-xl"><AlertTriangle size={15} /> Total bobot {acak ? `tiap peserta (rata-rata ${n} soal)` : ''} {total}. Nilai akhir tetap dihitung sebagai persen dari bobot soal yang dikerjakan peserta, tetapi total 100 lebih mudah dibaca.</p>}

      <p className="text-sm rounded-xl px-3 py-2 max-w-3xl bg-blue-50 text-blue-900">
        {exam.jumlahSoalTampil
          ? <>Setiap peserta mendapat <b>{Math.min(exam.jumlahSoalTampil, sel.length || exam.jumlahSoalTampil)} soal acak</b> dari {sel.length} soal di bawah ini{sel.length && exam.jumlahSoalTampil > sel.length ? ' (semua soal, karena jumlahnya kurang dari batas)' : ''}. Ubah batasnya di <Link to="/admin/ujian" className="underline font-semibold">Ujian Tersedia → Ubah</Link>.</>
          : <>Semua peserta mendapat seluruh soal di bawah ini. Untuk membagikan soal acak dari kumpulan ini, isi <b>Jumlah soal per peserta</b> di <Link to="/admin/ujian" className="underline font-semibold">Ujian Tersedia → Ubah</Link>.</>}
      </p>

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        {/* Bank soal */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b border-line space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-bold text-blue-950">Bank soal <span className="text-slate-400 font-normal">({available.length} tersedia)</span></h3>
              <Button variant="ghost" className="!py-1.5" disabled={!available.length} onClick={addAll}><ListPlus size={15} /> {kategori || tipe || q ? `Tambah ${available.length} hasil filter` : 'Tambah semua'}</Button></div>
            {katInfo.length > 0 && (
              <div className="rounded-xl bg-page p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2"><Tags size={13} /> Ambil satu kategori sekaligus</p>
                <div className="flex flex-wrap gap-2">
                  {katInfo.map((k) => (
                    <button key={k.nama} disabled={!k.sisa.length} onClick={() => addKategori(k)}
                      title={k.sisa.length ? `Tambahkan ${k.sisa.length} soal kategori ${k.nama}` : 'Semua soal kategori ini sudah dipilih'}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-blue-950 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-white">
                      <Plus size={12} /> {k.nama} <span className="text-slate-400">{k.sisa.length}/{k.total}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-40"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari soal…" className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <select value={tipe} onChange={(e) => setTipe(e.target.value)} className="border border-slate-300 rounded-xl px-2 py-2 text-sm bg-white"><option value="">Semua tipe</option><option value="pilihan_ganda">Pilihan ganda</option><option value="benar_salah">Benar/Salah</option><option value="esai">Esai</option></select>
              <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="border border-slate-300 rounded-xl px-2 py-2 text-sm bg-white"><option value="">Semua kategori</option>{bank.kategori.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </div>
          </div>
          <ul className="divide-y divide-line max-h-[32rem] overflow-y-auto">
            {available.map((x) => (
              <li key={x.id} className="flex items-start gap-3 p-3 hover:bg-blue-50/40">
                <div className="flex-1 min-w-0"><p className="text-sm text-blue-950 line-clamp-2">{x.teksSoal}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5"><TipeBadge tipe={x.tipe} />{x.kategori && <span className="text-[11px] bg-page text-slate-600 rounded-md px-2 py-0.5">{x.kategori}</span>}<span className="text-[11px] font-bold bg-amber-100 text-amber-900 rounded-full px-2 py-0.5">bobot {x.bobot}</span></div></div>
                <button onClick={() => add(x)} title="Tambahkan ke ujian" className="grid place-items-center w-9 h-9 rounded-xl bg-blue-700 text-white hover:bg-blue-800 shrink-0"><Plus size={17} /></button>
              </li>
            ))}
            {available.length === 0 && <li className="p-10 text-center text-sm text-slate-500">{bank.items.length === 0 ? <>Bank soal kosong. <Link to="/admin/soal" className="text-blue-700 underline">Tambah soal</Link> terlebih dahulu.</> : 'Tidak ada soal tersisa yang cocok dengan filter.'}</li>}
          </ul>
        </Card>

        {/* Soal ujian */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b border-line space-y-3">
            <h3 className="font-bold text-blue-950">Soal pada ujian ini <span className="text-slate-400 font-normal">({sel.length})</span></h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button variant="ghost" className="!py-1.5" disabled={!sel.length} onClick={normalize100}><Wand2 size={14} /> Total jadi 100</Button>
              <div className="flex items-center gap-1.5"><input type="number" min="0" step="0.01" value={samaBobot} onChange={(e) => setSamaBobot(e.target.value)} placeholder="bobot" className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                <Button variant="ghost" className="!py-1.5" disabled={!sel.length || !(Number(samaBobot) > 0)} onClick={applyAll}>Samakan semua</Button></div>
              <button disabled={!sel.length} onClick={resetBawaan} className="text-blue-700 hover:underline disabled:opacity-40">Kembalikan bobot bawaan</button>
            </div>
          </div>
          <ol className="divide-y divide-line max-h-[32rem] overflow-y-auto">
            {sel.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3 p-3">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-950 text-white text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm text-blue-950 line-clamp-2">{s.teksSoal}</p>
                  <div className="flex items-center gap-1.5 mt-1.5"><TipeBadge tipe={s.tipe} />{s.kategori && <span className="text-[11px] bg-page text-slate-600 rounded-md px-2 py-0.5">{s.kategori}</span>}</div></div>
                <div className="flex flex-col items-center shrink-0">
                  <input type="number" min="0.01" step="0.01" value={s.bobot} onChange={(e) => setBobot(s.id, e.target.value)} aria-label={`Bobot soal ${i + 1}`}
                    className={`w-20 text-center font-bold border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${Number(s.bobot) !== Number(s.bobotBawaan) ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`} />
                  <span className="text-[10px] text-slate-400 mt-0.5">bawaan {s.bobotBawaan}</span>
                </div>
                <div className="flex flex-col shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naikkan" className="p-1 rounded text-slate-400 hover:text-blue-700 disabled:opacity-25"><ChevronUp size={16} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === sel.length - 1} aria-label="Turunkan" className="p-1 rounded text-slate-400 hover:text-blue-700 disabled:opacity-25"><ChevronDown size={16} /></button>
                </div>
                <button onClick={() => remove(s.id)} title="Lepas dari ujian" className="grid place-items-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 shrink-0"><X size={16} /></button>
              </li>
            ))}
            {sel.length === 0 && <li className="p-10 text-center text-sm text-slate-500">Belum ada soal. Klik <b>+</b> pada soal di bank untuk menambahkannya.</li>}
          </ol>
        </Card>
      </div>
    </div>
  )
}
