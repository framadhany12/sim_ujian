import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Upload, Download, Eye, FileSpreadsheet, Search, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, BookOpen, AlertTriangle, ListChecks, ToggleLeft, PenLine } from 'lucide-react'
import { api, download } from '../../api.js'
import { Button, Input, Textarea, Select, Card, Modal, ErrorText } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const TIPE = { pilihan_ganda: 'Pilihan ganda', esai: 'Esai', benar_salah: 'Benar/Salah' }
const TIPE_STYLE = { pilihan_ganda: 'bg-blue-100 text-blue-800', benar_salah: 'bg-sky-100 text-sky-800', esai: 'bg-amber-100 text-amber-800' }
const PER_PAGE = 10
const LETTERS = ['A', 'B', 'C', 'D', 'E']
const blankQ = () => ({ tipe: 'pilihan_ganda', kategori: '', teksSoal: '', bobot: 10, kunciJawaban: 'A', acakOpsi: false, pembahasan: '', options: LETTERS.map((label) => ({ label, teksOpsi: '' })) })

export function TipeBadge({ tipe }) {
  return <span className={`inline-block text-[11px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${TIPE_STYLE[tipe]}`}>{TIPE[tipe]}</span>
}

// Tampilan soal seperti yang dilihat peserta
export function QuestionPreview({ q }) {
  const opts = q.tipe === 'pilihan_ganda' ? q.options.filter((o) => o.teksOpsi?.trim()) : []
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-blue-950">{q.teksSoal || <span className="text-slate-400">Teks soal akan tampil di sini…</span>}</p>
      {opts.map((o, i) => (
        <div key={o.label} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 text-sm ${q.kunciJawaban === o.label ? 'border-emerald-400 bg-emerald-50' : 'border-line'}`}>
          <span className="grid place-items-center w-6 h-6 rounded-md text-xs font-bold bg-slate-100 text-slate-500">{LETTERS[i]}</span>{o.teksOpsi}
          {q.kunciJawaban === o.label && <span className="ml-auto text-[11px] font-semibold text-emerald-700">kunci</span>}
        </div>
      ))}
      {q.tipe === 'benar_salah' && ['benar', 'salah'].map((t) => (
        <div key={t} className={`border rounded-xl px-3 py-2.5 text-sm capitalize ${q.kunciJawaban === t ? 'border-emerald-400 bg-emerald-50' : 'border-line'}`}>{t}{q.kunciJawaban === t && <span className="float-right text-[11px] font-semibold text-emerald-700">kunci</span>}</div>
      ))}
      {q.tipe === 'esai' && <div className="border border-line rounded-xl p-3 h-24 text-sm text-slate-400">Area jawaban esai…</div>}
      {q.pembahasan && <p className="text-xs bg-amber-50 border border-amber-100 rounded-xl p-3 text-slate-700"><b>Pembahasan:</b> {q.pembahasan}</p>}
    </div>
  )
}

export default function Soal() {
  const [data, setData] = useState({ items: [], kategori: [] })
  const [q, setQ] = useState('')
  const [tipe, setTipe] = useState('')
  const [kategori, setKategori] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [imp, setImp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()

  const load = () => api('/admin/questions').then(setData)
  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [q, tipe, kategori])

  const counts = useMemo(() => ({
    semua: data.items.length,
    pilihan_ganda: data.items.filter((x) => x.tipe === 'pilihan_ganda').length,
    benar_salah: data.items.filter((x) => x.tipe === 'benar_salah').length,
    esai: data.items.filter((x) => x.tipe === 'esai').length,
  }), [data])

  const shown = useMemo(() => data.items.filter((x) =>
    (!tipe || x.tipe === tipe) && (!kategori || x.kategori === kategori) && (!q || x.teksSoal.toLowerCase().includes(q.toLowerCase()))), [data, q, tipe, kategori])
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const rows = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const edit = (x) => {
    setError('')
    const options = LETTERS.map((label) => ({ label, teksOpsi: x.options.find((o) => o.label === label)?.teksOpsi ?? '' }))
    setForm({ ...x, options: x.tipe === 'pilihan_ganda' ? options : blankQ().options, pembahasan: x.pembahasan ?? '', kunciJawaban: x.kunciJawaban ?? '' })
  }
  const save = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      await api(form.id ? `/admin/questions/${form.id}` : '/admin/questions', { method: form.id ? 'PUT' : 'POST', body: form })
      setForm(null); load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const duplicate = async (x) => { await api(`/admin/questions/${x.id}/duplicate`, { method: 'POST' }); load() }
  const remove = async (x) => {
    const warn = x.jumlahUjian ? ` Soal ini dipakai di ${x.jumlahUjian} ujian dan akan dilepas dari ujian tersebut.` : ''
    if (!(await confirmDialog({ title: 'Hapus soal?', message: `Soal ini akan dihapus dari bank soal.${warn}`, confirmText: 'Ya, hapus' }))) return
    try { await api(`/admin/questions/${x.id}`, { method: 'DELETE' }); load() } catch (err) { alert(err.message) }
  }

  const onFile = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try { setImp({ ...(await api('/admin/questions/import/preview', { method: 'POST', form: fd })), fileName: file.name }) }
    catch (err) { alert(err.message) }
    e.target.value = ''
  }
  const saveImport = async () => {
    setBusy(true)
    try {
      const d = await api('/admin/questions/import/save', { method: 'POST', body: { questions: imp.valid } })
      if (d.failed?.length) alert(`${d.saved} soal tersimpan, ${d.failed.length} gagal.`)
      setImp(null); load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  const setOpt = (i, v) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, teksOpsi: v } : o)) })

  const chips = [['', 'Semua', BookOpen], ['pilihan_ganda', 'Pilihan ganda', ListChecks], ['benar_salah', 'Benar/Salah', ToggleLeft], ['esai', 'Esai', PenLine]]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-extrabold text-blue-950">Bank Soal</h2><p className="text-sm text-slate-500">Kumpulan soal umum. Soal dipilih untuk tiap ujian di menu <b>Ujian Tersedia → Atur soal</b>.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => download('/admin/questions/template?format=xlsx', 'template-soal.xlsx')}><FileSpreadsheet size={16} /> Template</Button>
          <Button variant="ghost" disabled={!data.items.length} onClick={() => download('/admin/questions/export?format=xlsx', 'bank-soal.xlsx')}><Download size={16} /> Ekspor</Button>
          <Button variant="ghost" onClick={() => fileRef.current.click()}><Upload size={16} /> Impor</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
          <Button onClick={() => { setError(''); setForm(blankQ()) }}><Plus size={16} /> Tambah Soal</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {chips.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTipe(k)} className={`text-left bg-white border rounded-2xl p-4 transition ${tipe === k ? 'border-blue-700 ring-2 ring-blue-100' : 'border-line hover:border-slate-300'}`}>
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400"><Icon size={14} /> {l}</span>
            <span className="text-2xl font-extrabold text-blue-950">{k ? counts[k] : counts.semua}</span>
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line">
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari teks soal…" className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Semua kategori</option>{data.kategori.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-xs text-slate-400">{shown.length} soal</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-page/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3 w-12">No</th><th className="px-4 py-3">Soal</th><th className="px-4 py-3">Tipe</th><th className="px-4 py-3">Kunci</th><th className="px-4 py-3 text-center">Bobot</th><th className="px-4 py-3 text-center">Dipakai</th><th className="px-5 py-3 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((x, i) => (
                <tr key={x.id} className="hover:bg-blue-50/40 transition align-top">
                  <td className="px-5 py-3 text-slate-400">{(page - 1) * PER_PAGE + i + 1}</td>
                  <td className="px-4 py-3 max-w-lg">
                    <p className="text-blue-950 line-clamp-2">{x.teksSoal}</p>
                    {x.kategori && <span className="inline-block mt-1 text-[11px] font-medium rounded-md px-2 py-0.5 bg-page text-slate-600">{x.kategori}</span>}
                  </td>
                  <td className="px-4 py-3"><TipeBadge tipe={x.tipe} /></td>
                  <td className="px-4 py-3">{x.tipe === 'esai' ? <span className="text-xs text-slate-400">dinilai manual</span> : <span className="inline-grid place-items-center min-w-7 h-7 px-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold uppercase">{x.kunciJawaban}</span>}</td>
                  <td className="px-4 py-3 text-center"><span className="inline-block min-w-9 rounded-full bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1">{x.bobot}</span></td>
                  <td className="px-4 py-3 text-center">{x.jumlahUjian ? <span className="text-xs font-semibold text-blue-700">{x.jumlahUjian} ujian</span> : <span className="text-xs text-slate-300">—</span>}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn title="Pratinjau" onClick={() => setPreview(x)}><Eye size={15} /></IconBtn>
                      <IconBtn title="Ubah" onClick={() => edit(x)} tone="blue"><Pencil size={15} /></IconBtn>
                      <IconBtn title="Duplikat" onClick={() => duplicate(x)}><Copy size={15} /></IconBtn>
                      <IconBtn title="Hapus" onClick={() => remove(x)} tone="red"><Trash2 size={15} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-500"><BookOpen className="mx-auto mb-2 text-slate-300" size={32} />{data.items.length ? 'Tidak ada soal yang cocok.' : 'Bank soal masih kosong. Tambah soal atau impor dari Excel.'}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-line text-sm text-slate-500">
          <span>Menampilkan {shown.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, shown.length)} dari {shown.length}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="grid place-items-center w-8 h-8 rounded-lg border border-line disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} /></button>
            <span>{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="grid place-items-center w-8 h-8 rounded-lg border border-line disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      </Card>

      {form && (
        <Modal title={form.id ? 'Ubah Soal' : 'Tambah Soal'} onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="grid lg:grid-cols-[1fr_300px] gap-5">
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Select label="Tipe soal" value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value, kunciJawaban: e.target.value === 'pilihan_ganda' ? 'A' : e.target.value === 'benar_salah' ? 'benar' : '' })}>
                  {Object.entries(TIPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <label className="block text-sm"><span className="block mb-1 text-slate-600">Kategori</span>
                  <input list="kategori-list" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} maxLength={80} placeholder="mis. Matematika" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <datalist id="kategori-list">{data.kategori.map((k) => <option key={k} value={k} />)}</datalist>
                </label>
                <Input label="Bobot bawaan" type="number" step="0.01" min="0.01" value={form.bobot} onChange={(e) => setForm({ ...form, bobot: e.target.value })} required />
              </div>
              <Textarea label="Teks soal *" rows={4} value={form.teksSoal} onChange={(e) => setForm({ ...form, teksSoal: e.target.value })} required />
              {form.tipe === 'pilihan_ganda' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Pilihan jawaban <span className="text-xs text-slate-400">(pilih tombol bulat sebagai kunci)</span></p>
                  {form.options.map((o, i) => (
                    <div key={o.label} className="flex items-center gap-2">
                      <input type="radio" name="kunci" disabled={!o.teksOpsi.trim()} checked={form.kunciJawaban === o.label} onChange={() => setForm({ ...form, kunciJawaban: o.label })} title="Kunci jawaban" className="accent-emerald-600" />
                      <span className="w-5 font-semibold text-slate-500">{o.label}</span>
                      <input className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={o.teksOpsi} onChange={(e) => setOpt(i, e.target.value)} placeholder={i < 2 ? 'Wajib diisi' : 'Opsional'} />
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-sm pt-1"><input type="checkbox" checked={form.acakOpsi} onChange={(e) => setForm({ ...form, acakOpsi: e.target.checked })} /> Acak urutan opsi per peserta</label>
                </div>
              )}
              {form.tipe === 'benar_salah' && (
                <Select label="Kunci jawaban" value={form.kunciJawaban} onChange={(e) => setForm({ ...form, kunciJawaban: e.target.value })}><option value="benar">Benar</option><option value="salah">Salah</option></Select>
              )}
              {form.tipe === 'esai' && <p className="text-sm text-slate-500 bg-page rounded-xl p-3">Soal esai dinilai manual oleh Admin di menu Nilai & Laporan.</p>}
              <Textarea label="Pembahasan (opsional)" rows={2} value={form.pembahasan} onChange={(e) => setForm({ ...form, pembahasan: e.target.value })} />
              {form.id && form.jumlahUjian > 0 && <p className="flex items-start gap-2 text-xs bg-amber-50 text-amber-900 rounded-xl p-3"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Soal ini dipakai di {form.jumlahUjian} ujian. Perubahan kunci/isi ikut berlaku di ujian tersebut.</p>}
              <ErrorText>{error}</ErrorText>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Batal</Button>
                <Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan soal'}</Button>
              </div>
            </div>
            <aside className="bg-page rounded-2xl p-4 h-fit">
              <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-3">Pratinjau tampilan peserta</p>
              <QuestionPreview q={form} />
            </aside>
          </form>
        </Modal>
      )}

      {preview && (
        <Modal title="Pratinjau Soal" onClose={() => setPreview(null)}>
          <div className="flex items-center gap-2 mb-3"><TipeBadge tipe={preview.tipe} />{preview.kategori && <span className="text-xs bg-page rounded-md px-2 py-1">{preview.kategori}</span>}<span className="ml-auto text-xs font-bold bg-amber-100 text-amber-900 rounded-full px-2.5 py-1">bobot {preview.bobot}</span></div>
          <QuestionPreview q={preview} />
        </Modal>
      )}

      {imp && (
        <Modal title="Pratinjau Impor Soal" onClose={() => setImp(null)} wide>
          <p className="text-xs text-slate-500 mb-3">Berkas: {imp.fileName}</p>
          <div className="grid grid-cols-2 gap-2 mb-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-extrabold text-emerald-700">{imp.valid.length}</p><p className="text-xs text-slate-500">soal valid</p></div>
            <div className="rounded-xl bg-red-50 p-3"><p className="text-2xl font-extrabold text-red-600">{imp.invalid.length}</p><p className="text-xs text-slate-500">baris bermasalah</p></div>
          </div>
          {imp.invalid.length > 0 && (
            <ul className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mb-3 list-disc pl-6 max-h-36 overflow-y-auto">
              {imp.invalid.map((r) => <li key={r.baris}>Baris {r.baris}{r.teks ? ` (${r.teks.slice(0, 40)})` : ''}: {r.alasan}</li>)}
            </ul>
          )}
          <div className="max-h-64 overflow-y-auto border border-line rounded-xl divide-y divide-line text-sm mb-4">
            {imp.valid.map((x) => <div key={x.baris} className="p-2.5 flex items-center gap-2"><TipeBadge tipe={x.tipe} /><span className="flex-1 truncate">{x.teksSoal}</span><span className="text-xs text-slate-500">kunci {x.kunciJawaban || '—'} · bobot {x.bobot}</span></div>)}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImp(null)}>Batal</Button>
            <Button variant="success" disabled={!imp.valid.length || busy} onClick={saveImport}>{busy ? 'Menyimpan…' : `Simpan ${imp.valid.length} soal ke bank`}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function IconBtn({ children, tone = 'slate', ...p }) {
  const t = { slate: 'text-slate-500 hover:bg-slate-100', blue: 'text-blue-700 hover:bg-blue-50', red: 'text-red-500 hover:bg-red-50' }[tone]
  return <button {...p} className={`grid place-items-center w-8 h-8 rounded-lg border border-line ${t}`}>{children}</button>
}
