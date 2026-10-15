import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X, Users, CalendarClock } from 'lucide-react'
import { api } from '../../api.js'
import { Button, Card, ErrorText } from '../../components/ui.jsx'

export default function Grup() {
  const [groups, setGroups] = useState(null)
  const [nama, setNama] = useState('')
  const [editing, setEditing] = useState(null) // { id, nama }
  const [error, setError] = useState('')

  const load = () => api('/admin/groups').then(setGroups)
  useEffect(() => { load() }, [])

  const run = async (fn) => { setError(''); try { await fn(); load() } catch (err) { setError(err.message) } }
  const add = (e) => { e.preventDefault(); if (nama.trim()) run(async () => { await api('/admin/groups', { method: 'POST', body: { nama } }); setNama('') }) }
  const rename = () => run(async () => { await api(`/admin/groups/${editing.id}`, { method: 'PUT', body: { nama: editing.nama } }); setEditing(null) })
  const remove = (g) => confirm(`Hapus grup "${g.nama}"? Peserta di dalamnya menjadi tanpa grup dan ujian tidak lagi tampil untuk grup ini.`) && run(() => api(`/admin/groups/${g.id}`, { method: 'DELETE' }))

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-2xl font-extrabold text-blue-950">Grup Peserta</h2>
        <p className="text-sm text-slate-500">Kelompokkan peserta (mis. <b>kip2026</b>), lalu pilih grup mana yang dapat melihat tiap ujian di menu Jadwal & Token.</p>
      </div>

      <Card className="!p-4">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama grup baru, mis. kip2026" maxLength={60}
            className="flex-1 min-w-56 border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button variant="accent" disabled={!nama.trim()}><Plus size={16} /> Buat grup</Button>
        </form>
        <div className="mt-2"><ErrorText>{error}</ErrorText></div>
      </Card>

      {!groups && <p className="text-slate-500">Memuat...</p>}
      {groups?.length === 0 && <Card className="text-center text-slate-500 py-10">Belum ada grup. Buat grup pertama di atas.</Card>}

      <div className="grid sm:grid-cols-2 gap-4">
        {groups?.map((g) => (
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
                <h3 className="text-lg font-bold text-blue-950 break-all">{g.nama}</h3>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => setEditing({ id: g.id, nama: g.nama })} className="text-blue-700" aria-label="Ubah nama"><Pencil size={16} /></button>
                  <button onClick={() => remove(g)} className="text-red-600" aria-label="Hapus grup"><Trash2 size={16} /></button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/admin/peserta" className="rounded-xl bg-page p-3 hover:bg-blue-50"><Users size={15} className="text-blue-700" /><p className="text-xl font-extrabold text-blue-950 mt-1">{g.jumlahPeserta}</p><p className="text-xs text-slate-500">peserta</p></Link>
              <Link to="/admin/ujian" className="rounded-xl bg-page p-3 hover:bg-blue-50"><CalendarClock size={15} className="text-blue-700" /><p className="text-xl font-extrabold text-blue-950 mt-1">{g.jumlahUjian}</p><p className="text-xs text-slate-500">ujian</p></Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
