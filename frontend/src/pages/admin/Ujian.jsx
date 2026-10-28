import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Clock, FileQuestion, Users, KeyRound, Pencil, Trash2, Activity } from 'lucide-react'
import { api } from '../../api.js'
import { Button, Input, Textarea, Card, Badge, Modal, ErrorText } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const blank = () => ({ judul: '', petunjuk: '', durasiMenit: 60, tampilkanHasil: false, acakSoal: false, jumlahSoalTampil: '', nilaiKelulusan: 60, aktif: true, groupIds: [] })

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition shrink-0 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function Ujian() {
  const [list, setList] = useState(null)
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const load = () => api('/admin/exams').then(setList)
  useEffect(() => { load(); api('/admin/groups').then(setGroups) }, [])

  const edit = (e) => { setError(''); setForm({ ...e, petunjuk: e.petunjuk ?? '', groupIds: e.groups.map((g) => g.id) }) }
  const save = async (ev) => {
    ev.preventDefault(); setError('')
    try {
      await api(form.id ? `/admin/exams/${form.id}` : '/admin/exams', { method: form.id ? 'PUT' : 'POST', body: form })
      setForm(null); load()
    } catch (err) { setError(err.message) }
  }
  const toggleAktif = async (e) => { await api(`/admin/exams/${e.id}/aktif`, { method: 'PUT', body: { aktif: !e.aktif } }); load() }
  const remove = async (e) => {
    if (!(await confirmDialog({ title: 'Hapus ujian?', message: `Ujian "${e.judul}" akan dihapus beserta soal, token, dan jawaban peserta.`, confirmText: 'Ya, hapus' }))) return
    await api(`/admin/exams/${e.id}`, { method: 'DELETE' }); load()
  }
  const toggleGroup = (id) => setForm({ ...form, groupIds: form.groupIds.includes(id) ? form.groupIds.filter((x) => x !== id) : [...form.groupIds, id] })
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-950">Ujian Tersedia</h2>
          <p className="text-sm text-slate-500">Daftar ujian, grup pelaksana, dan status aktif. Token dibuat di menu <b>Token Ujian</b>.</p>
        </div>
        <Button onClick={() => { setError(''); setForm(blank()) }}><Plus size={16} /> Buat Ujian</Button>
      </div>

      {!list && <p className="text-slate-500">Memuat...</p>}
      {list?.length === 0 && <Card className="text-center text-slate-500 py-12">Belum ada ujian. Klik <b>Buat Ujian</b> untuk memulai.</Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        {list?.map((e) => (
          <Card key={e.id} className={`space-y-4 ${e.aktif ? '' : 'bg-slate-50 opacity-90'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-blue-950 leading-snug">{e.judul}</h3>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {e.tokenAktif ? <Badge color="green">token aktif</Badge> : <Badge>belum dibuka</Badge>}
                  {e.acakSoal && <Badge color="blue">soal diacak</Badge>}
                  {e.jumlahSoalTampil && <Badge color="blue">{e.jumlahSoalTampil} soal acak/peserta</Badge>}
                  {e.tampilkanHasil && <Badge color="amber">hasil tampil ke peserta</Badge>}
                </div>
              </div>
              <label className="flex flex-col items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <Switch checked={e.aktif} onChange={() => toggleAktif(e)} label={`Aktifkan ${e.judul}`} />
                {e.aktif ? 'Aktif' : 'Nonaktif'}
              </label>
            </div>

            <dl className="grid grid-cols-3 gap-2 text-sm border-y border-line py-3">
              <div><dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400"><Clock size={12} /> Durasi</dt><dd className="font-bold text-blue-950">{e.durasiMenit} menit</dd></div>
              <div><dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400"><FileQuestion size={12} /> Soal · bobot</dt><dd className="font-bold text-blue-950">{e.jumlahSoalTampil && e.jumlahSoalTampil < e.jumlahSoal ? `${e.jumlahSoalTampil} dari ${e.jumlahSoal} butir · ${Math.round((e.totalBobot / e.jumlahSoal) * e.jumlahSoalTampil * 100) / 100}` : `${e.jumlahSoal} butir · ${e.totalBobot}`}</dd></div>
              <div><dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400"><Users size={12} /> Mengerjakan</dt><dd className="font-bold text-blue-950">{e.jumlahPeserta}</dd></div>
            </dl>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Dilaksanakan di grup</p>
              {e.groups.length === 0
                ? <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Belum ada grup — ujian tidak tampil ke peserta. Klik Ubah untuk memilih grup.</p>
                : <div className="flex flex-wrap gap-1.5">{e.groups.map((g) => <span key={g.id} className="text-xs font-semibold rounded-full px-2.5 py-1 bg-blue-100 text-blue-800">{g.nama}</span>)}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to={`/admin/token?exam=${e.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 text-blue-950 font-bold hover:bg-amber-300"><KeyRound size={15} /> Buat token</Link>
              <Link to={`/admin/ujian/${e.id}/soal`} className="px-3 py-2 rounded-xl border border-slate-300 font-semibold hover:bg-slate-50">Atur soal</Link>
              <Link to={`/admin/monitor?exam=${e.id}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 font-semibold hover:bg-slate-50"><Activity size={14} /> Pantau</Link>
              <span className="flex-1" />
              <button onClick={() => edit(e)} title="Ubah" className="grid place-items-center w-9 h-9 rounded-lg border border-line text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button>
              <button onClick={() => remove(e)} title="Hapus" className="grid place-items-center w-9 h-9 rounded-lg border border-line text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
            </div>
          </Card>
        ))}
      </div>

      {form && (
        <Modal title={form.id ? 'Ubah Ujian' : 'Buat Ujian'} onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input label="Judul ujian *" value={form.judul} onChange={set('judul')} required autoFocus /></div>
            <div className="sm:col-span-2"><Textarea label="Petunjuk pengerjaan" rows={3} value={form.petunjuk} onChange={set('petunjuk')} /></div>
            <Input label="Durasi pengerjaan (menit)" type="number" min="1" value={form.durasiMenit} onChange={set('durasiMenit')} required />
            <Input label="Nilai kelulusan (0–100)" type="number" min="0" max="100" value={form.nilaiKelulusan} onChange={set('nilaiKelulusan')} required />
            <Input label="Jumlah soal per peserta (kosong = semua)" type="number" min="1" value={form.jumlahSoalTampil ?? ''} onChange={set('jumlahSoalTampil')} placeholder="mis. 50 dari bank 200 soal" />

            <div className="sm:col-span-2">
              <p className="text-sm text-slate-600 mb-1.5">Dilaksanakan di grup</p>
              {groups.length === 0
                ? <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">Belum ada grup. Buat grup dulu di menu <b>Kelola Grup</b>.</p>
                : <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const on = form.groupIds.includes(g.id)
                      return <button type="button" key={g.id} onClick={() => toggleGroup(g.id)} className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>{on ? '✓ ' : ''}{g.nama} <span className="opacity-60 text-xs">({g.jumlahPeserta})</span></button>
                    })}
                  </div>}
            </div>

            <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3 text-sm">
              <label className="flex items-center gap-3 border border-line rounded-xl p-3"><Switch checked={form.aktif} onChange={() => setForm({ ...form, aktif: !form.aktif })} label="Ujian aktif" /><span><b className="text-blue-950">Ujian aktif</b><span className="block text-xs text-slate-500">Hanya ujian aktif yang bisa dibuatkan token.</span></span></label>
              <label className="flex items-center gap-3 border border-line rounded-xl p-3"><Switch checked={form.acakSoal} onChange={() => setForm({ ...form, acakSoal: !form.acakSoal })} label="Acak soal" /><span><b className="text-blue-950">Acak soal</b><span className="block text-xs text-slate-500">Urutan berbeda tiap peserta.</span></span></label>
              <label className="flex items-center gap-3 border border-line rounded-xl p-3"><Switch checked={form.tampilkanHasil} onChange={() => setForm({ ...form, tampilkanHasil: !form.tampilkanHasil })} label="Tampilkan hasil" /><span><b className="text-blue-950">Tampilkan hasil</b><span className="block text-xs text-slate-500">Peserta boleh melihat skor.</span></span></label>
            </div>

            <div className="sm:col-span-2 space-y-2"><ErrorText>{error}</ErrorText><Button className="w-full">Simpan ujian</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
