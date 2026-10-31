import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X, Users, CalendarClock, UserRound } from 'lucide-react'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Button, Card, ErrorText } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

export default function Grup() {
  const { user } = useAuth()
  const [groups, setGroups] = useState(null)
  const [nama, setNama] = useState('')
  const [editing, setEditing] = useState(null) // { id, nama }
  const [error, setError] = useState('')
  const [tab, setTab] = useState(user?.superAdmin ? 'semua' : 'saya')

  const load = () => api('/admin/groups').then(setGroups)
  useEffect(() => { load() }, [])

  const run = async (fn) => { setError(''); try { await fn(); load() } catch (err) { setError(err.message) } }
  const add = (e) => { e.preventDefault(); if (nama.trim()) run(async () => { await api('/admin/groups', { method: 'POST', body: { nama } }); setNama(''); setTab('saya') }) }
  const rename = () => run(async () => { await api(`/admin/groups/${editing.id}`, { method: 'PUT', body: { nama: editing.nama } }); setEditing(null) })
  const remove = async (g) => (await confirmDialog({ title: 'Hapus grup?', message: `Grup "${g.nama}" akan dihapus. Mahasiswa di dalamnya dikeluarkan dari grup ini (akunnya tetap ada) dan ujian tidak lagi tampil untuk grup ini.`, confirmText: 'Ya, hapus' })) && run(() => api(`/admin/groups/${g.id}`, { method: 'DELETE' }))

  const mine = groups?.filter((g) => g.milikSaya) ?? []
  const shown = tab === 'saya' ? mine : groups ?? []

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-2xl font-extrabold text-blue-950">Grup / Kelas</h2>
        <p className="text-sm text-slate-500">Buat grup per kelas atau mata kuliah (mis. <b>TI-2A</b>, <b>Basis Data 2026</b>). Satu mahasiswa boleh masuk banyak grup. Grup dosen lain dapat Anda lihat dan pakai untuk ujian, tetapi hanya pembuatnya yang dapat mengubah anggota.</p>
      </div>

      <Card className="!p-4">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama grup baru, mis. TI-2A" maxLength={60}
            className="flex-1 min-w-56 border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button variant="accent" disabled={!nama.trim()}><Plus size={16} /> Buat grup</Button>
        </form>
        <div className="mt-2"><ErrorText>{error}</ErrorText></div>
      </Card>

      <div className="flex gap-1 bg-white border border-line rounded-full p-1 w-fit">
        {[['saya', 'Grup saya', mine.length], ['semua', 'Semua grup', groups?.length ?? 0]].map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${tab === k ? 'bg-blue-950 text-white' : 'text-slate-500 hover:text-blue-950'}`}>
            {l}<span className={`text-[11px] rounded-full px-1.5 ${tab === k ? 'bg-white/20' : 'bg-page'}`}>{n}</span>
          </button>
        ))}
      </div>

      {!groups && <p className="text-slate-500">Memuat...</p>}
      {groups && shown.length === 0 && <Card className="text-center text-slate-500 py-10">{tab === 'saya' ? 'Anda belum membuat grup. Buat grup pertama di atas.' : 'Belum ada grup.'}</Card>}

      <div className="grid sm:grid-cols-2 gap-4">
        {shown.map((g) => (
          <Card key={g.id} className="space-y-3">
            {editing?.id === g.id ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={editing.nama} onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null) }}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={rename} className="text-emerald-600" aria-label="Simpan"><Check size={18} /></button>
                <button onClick={() => setEditing(null)} className="text-slate-400" aria-label="Batal"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-blue-950 break-all">{g.nama}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1"><UserRound size={12} /> {g.milikSaya ? 'Milik Anda' : g.pemilik}</p>
                </div>
                {g.bisaUbah && (
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => setEditing({ id: g.id, nama: g.nama })} className="text-blue-700" aria-label="Ubah nama"><Pencil size={16} /></button>
                    <button onClick={() => remove(g)} className="text-red-600" aria-label="Hapus grup"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to={`/admin/peserta?grup=${g.id}`} className="rounded-xl bg-page p-3 hover:bg-blue-50"><Users size={15} className="text-blue-700" /><p className="text-xl font-extrabold text-blue-950 mt-1">{g.jumlahPeserta}</p><p className="text-xs text-slate-500">mahasiswa · lihat</p></Link>
              <Link to="/admin/ujian" className="rounded-xl bg-page p-3 hover:bg-blue-50"><CalendarClock size={15} className="text-blue-700" /><p className="text-xl font-extrabold text-blue-950 mt-1">{g.jumlahUjian}</p><p className="text-xs text-slate-500">ujian</p></Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
