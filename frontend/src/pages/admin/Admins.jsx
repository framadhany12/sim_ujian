import { useEffect, useState } from 'react'
import { Plus, KeyRound, Pencil, ShieldCheck, Download, Dices } from 'lucide-react'
import { api } from '../../api.js'
import { Button, Input, Card, Modal, ErrorText, downloadCsv } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const genPassword = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => c[b % c.length]).join('')
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function Admins() {
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null)
  const [edit, setEdit] = useState(null)
  const [cred, setCred] = useState(null)
  const [error, setError] = useState('')
  const load = () => api('/admin/admins').then(setList)
  useEffect(() => { load() }, [])

  const run = async (fn) => { setError(''); try { await fn() } catch (err) { setError(err.message) } }
  const create = (e) => { e.preventDefault(); run(async () => { const c = await api('/admin/admins', { method: 'POST', body: form }); setForm(null); setCred({ ...c, title: 'Akun admin dibuat' }); load() }) }
  const saveEdit = (e) => {
    e.preventDefault()
    run(async () => {
      await api(`/admin/admins/${edit.id}`, { method: 'PUT', body: { nama: edit.nama } })
      if (edit.newPassword) {
        const c = await api(`/admin/admins/${edit.id}/reset-password`, { method: 'POST', body: { password: edit.newPassword } })
        setCred({ ...c, nama: edit.nama, title: 'Password admin diperbarui' })
      }
      setEdit(null); load()
    })
  }
  const toggle = async (a) => {
    const off = a.status === 'aktif'
    if (off && !(await confirmDialog({ title: 'Nonaktifkan admin?', message: `${a.nama || a.username} tidak dapat login sampai diaktifkan lagi. Ujian, soal, dan grup miliknya tetap tersimpan.`, confirmText: 'Ya, nonaktifkan' }))) return
    try { await api(`/admin/admins/${a.id}`, { method: 'PUT', body: { status: off ? 'nonaktif' : 'aktif' } }); load() } catch (err) { setError(err.message) }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-950">Kelola Admin</h2>
          <p className="text-sm text-slate-500">Akun dosen/admin. Tiap admin hanya melihat ujian, bank soal, dan grup buatannya sendiri. Super Admin melihat semuanya.</p>
        </div>
        <Button onClick={() => { setForm({ nama: '', username: '', password: '' }); setError('') }}><Plus size={16} /> Tambah Admin</Button>
      </div>
      {!form && !edit && <ErrorText>{error}</ErrorText>}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-page/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3 font-semibold">Admin</th><th className="px-4 py-3 font-semibold">Username</th><th className="px-4 py-3 font-semibold text-center">Ujian</th><th className="px-4 py-3 font-semibold text-center">Soal</th><th className="px-4 py-3 font-semibold text-center">Grup</th><th className="px-4 py-3 font-semibold">Akun</th><th className="px-5 py-3 font-semibold text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!list && <tr><td colSpan={7} className="px-5 py-8 text-slate-500">Memuat…</td></tr>}
              {list?.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-blue-950">{a.nama || <i className="text-slate-400">tanpa nama</i>}{a.diriSendiri && <span className="text-xs text-slate-400 font-normal"> (Anda)</span>}</p>
                    {a.superAdmin && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 mt-0.5"><ShieldCheck size={12} /> Super Admin</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">{a.username}</td>
                  <td className="px-4 py-3 text-center">{a.jumlahUjian}</td>
                  <td className="px-4 py-3 text-center">{a.jumlahSoal}</td>
                  <td className="px-4 py-3 text-center">{a.jumlahGrup}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Switch checked={a.status === 'aktif'} onChange={() => toggle(a)} disabled={a.diriSendiri} label={`Akun ${a.username}`} />
                      <span className={`text-xs font-medium ${a.status === 'aktif' ? 'text-emerald-700' : 'text-slate-400'}`}>{a.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button title="Ubah & password" onClick={() => { setEdit({ ...a, newPassword: '' }); setError('') }} className="inline-grid place-items-center w-8 h-8 rounded-lg border border-line text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {form && (
        <Modal title="Tambah Admin" onClose={() => setForm(null)}>
          <form onSubmit={create} className="space-y-3">
            <Input label="Nama (mis. nama dosen) *" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required autoFocus maxLength={100} />
            <Input label="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="huruf, angka, titik, strip" />
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Input label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="kosong = dibuat acak" /></div>
              <Button type="button" variant="ghost" onClick={() => setForm({ ...form, password: genPassword() })}><Dices size={16} /> Acak</Button>
            </div>
            <p className="text-xs text-slate-500">Admin baru wajib mengganti password saat login pertama.</p>
            <ErrorText>{error}</ErrorText>
            <Button className="w-full">Simpan admin</Button>
          </form>
        </Modal>
      )}

      {edit && (
        <Modal title="Ubah Admin" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="bg-page rounded-xl p-3"><p className="font-semibold text-blue-950 font-mono">{edit.username}</p><p className="text-xs text-slate-500">Username tidak dapat diubah</p></div>
            <Input label="Nama" value={edit.nama} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} required maxLength={100} />
            <fieldset className="border border-line rounded-xl p-4 space-y-3">
              <legend className="px-2 text-sm font-semibold text-blue-950 flex items-center gap-1.5"><KeyRound size={14} /> Password</legend>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Input label="Atur password baru (opsional)" value={edit.newPassword} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} placeholder="min. 8 karakter" /></div>
                <Button type="button" variant="ghost" onClick={() => setEdit({ ...edit, newPassword: genPassword() })}><Dices size={16} /> Acak</Button>
              </div>
              <p className="text-xs text-slate-500">Diisi = password diganti dan admin wajib menggantinya lagi saat login. Kosong = tidak berubah.</p>
            </fieldset>
            <ErrorText>{error}</ErrorText>
            <Button className="w-full">Simpan perubahan</Button>
          </form>
        </Modal>
      )}

      {cred && (
        <Modal title={cred.title} onClose={() => setCred(null)}>
          <p className="text-sm bg-amber-100 text-amber-900 rounded-xl px-3 py-2 mb-3">Password hanya ditampilkan sekarang. Salin lalu berikan ke admin yang bersangkutan.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm mb-4">
            <dt className="text-slate-500">Nama</dt><dd>{cred.nama}</dd>
            <dt className="text-slate-500">Username</dt><dd className="font-mono">{cred.username}</dd>
            <dt className="text-slate-500">Password</dt><dd className="font-mono">{cred.password}</dd>
          </dl>
          <Button onClick={() => downloadCsv([{ nama: cred.nama, username: cred.username, password: cred.password }], `admin-${cred.username}.csv`)}><Download size={16} /> Unduh CSV</Button>
        </Modal>
      )}
    </div>
  )
}
