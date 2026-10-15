import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Upload, Download, KeyRound, Search, Pencil, Trash2, Copy, Check, Dices, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { api, download } from '../../api.js'
import { Button, Input, Select, Card, Modal, ErrorText, downloadCsv } from '../../components/ui.jsx'

const empty = { nama_lengkap: '', email: '', groupId: '', username: '', password: '' }
const PER_PAGE = 10
const AVATAR = ['bg-blue-100 text-blue-800', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-emerald-100 text-emerald-800', 'bg-indigo-100 text-indigo-800']
const avatarClass = (s) => AVATAR[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length]
const initials = (n) => String(n ?? '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const genPassword = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => c[b % c.length]).join('')
}

function CopyButton({ text }) {
  const [ok, setOk] = useState(false)
  return (
    <button title="Salin username" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200) }}
      className="text-slate-300 hover:text-blue-700">{ok ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}</button>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function Peserta() {
  const [list, setList] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState(null)
  const [edit, setEdit] = useState(null)
  const [error, setError] = useState('')
  const [creds, setCreds] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [imp, setImp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filterGroup, setFilterGroup] = useState('')
  const [tab, setTab] = useState('semua')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const fileRef = useRef()

  const load = () => { api('/admin/peserta').then(setList); api('/admin/groups').then(setGroups) }
  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [q, filterGroup, tab])

  const counts = useMemo(() => ({
    semua: list.length, aktif: list.filter((u) => u.status === 'aktif').length,
    nonaktif: list.filter((u) => u.status !== 'aktif').length, reset: list.filter((u) => u.mintaReset).length,
  }), [list])

  const shown = useMemo(() => list.filter((u) =>
    (tab === 'semua' || (tab === 'reset' ? u.mintaReset : tab === 'aktif' ? u.status === 'aktif' : u.status !== 'aktif')) &&
    (!filterGroup || (filterGroup === 'none' ? !u.groupId : String(u.groupId) === filterGroup)) &&
    (!q || `${u.namaLengkap} ${u.username} ${u.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [list, filterGroup, q, tab])
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const rows = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const create = async (e) => {
    e.preventDefault(); setError('')
    try {
      const c = await api('/admin/peserta', { method: 'POST', body: form })
      const g = groups.find((x) => String(x.id) === String(form.groupId))
      setForm(null); setCreds({ title: 'Kredensial peserta baru', rows: [{ ...c, grup: g?.nama ?? '' }] }); load()
    } catch (err) { setError(err.message) }
  }

  // Ubah data + (opsional) set password manual dalam satu simpan
  const saveEdit = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api(`/admin/peserta/${edit.id}`, { method: 'PUT', body: { namaLengkap: edit.namaLengkap, email: edit.email, groupId: edit.groupId || null } })
      const grup = groups.find((g) => String(g.id) === String(edit.groupId))?.nama ?? ''
      if (edit.newPassword) {
        const c = await api(`/admin/peserta/${edit.id}/reset-password`, { method: 'POST', body: { password: edit.newPassword } })
        setCreds({ title: 'Password diperbarui', rows: [{ ...c, nama_lengkap: edit.namaLengkap, grup }] })
      }
      setEdit(null); load()
    } catch (err) { setError(err.message) }
  }
  const resetRandom = async () => {
    if (!confirm(`Buat password acak baru untuk ${edit.username}? Password lama tidak berlaku lagi.`)) return
    setError('')
    try {
      const c = await api(`/admin/peserta/${edit.id}/reset-password`, { method: 'POST' })
      const grup = groups.find((g) => String(g.id) === String(edit.groupId))?.nama ?? ''
      setCreds({ title: 'Password baru (acak)', rows: [{ ...c, nama_lengkap: edit.namaLengkap, grup }] })
      setEdit(null); load()
    } catch (err) { setError(err.message) }
  }

  // Langkah 1: unggah berkas → pratinjau validasi (belum disimpan)
  const doImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    setImportResult(null)
    try { setImp({ ...(await api('/admin/peserta/import/preview', { method: 'POST', form: fd })), fileName: file.name }) }
    catch (err) { alert(err.message) }
    e.target.value = ''
  }
  // Langkah 2: simpan baris yang valid
  const saveImport = async () => {
    setBusy(true)
    try {
      const d = await api('/admin/peserta/import', { method: 'POST', body: { rows: imp.valid } })
      setImp(null); setImportResult(d)
      if (d.created.length) setCreds({ title: `${d.created.length} peserta diimpor`, rows: d.created })
      load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  const toggle = async (u) => { await api(`/admin/peserta/${u.id}`, { method: 'PUT', body: { status: u.status === 'aktif' ? 'nonaktif' : 'aktif' } }); load() }
  const remove = async (u) => {
    if (!confirm(`Hapus peserta ${u.namaLengkap}? Seluruh data pengerjaannya ikut terhapus.`)) return
    await api(`/admin/peserta/${u.id}`, { method: 'DELETE' }); load()
  }
  const GroupOptions = () => <>{groups.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}</>

  const tabs = [['semua', 'Semua'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['reset', 'Minta reset']]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-2xl font-extrabold text-blue-950">Manajemen Peserta</h2><p className="text-sm text-slate-500">{list.length} peserta · {groups.length} grup</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => download('/admin/peserta/template?format=xlsx', 'template-peserta.xlsx')}><FileSpreadsheet size={16} /> Template</Button>
          <Button variant="ghost" onClick={() => download('/admin/peserta/export?format=xlsx', 'data-peserta.xlsx')}><Download size={16} /> Ekspor</Button>
          <Button variant="ghost" onClick={() => fileRef.current.click()}><Upload size={16} /> Impor</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={doImport} />
          <Button onClick={() => { setForm(empty); setError('') }}><Plus size={16} /> Tambah Peserta</Button>
        </div>
      </div>

      {importResult?.failed.length > 0 && (
        <Card className="!border-red-200 !bg-red-50 text-sm">
          <b>{importResult.failed.length} baris gagal diimpor:</b>
          <ul className="list-disc ml-5">{importResult.failed.map((f) => <li key={f.baris}>Baris {f.baris}: {f.alasan}</li>)}</ul>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line">
          <div className="flex gap-1 bg-page rounded-full p-1">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${tab === k ? 'bg-blue-950 text-white' : 'text-slate-500 hover:text-blue-950'}`}>
                {l}<span className={`text-[11px] rounded-full px-1.5 ${tab === k ? 'bg-white/20' : k === 'reset' && counts.reset ? 'bg-amber-300 text-blue-950' : 'bg-white'}`}>{counts[k]}</span>
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Semua grup</option><option value="none">Tanpa grup</option><GroupOptions />
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari peserta…" className="w-56 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-page/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3 font-semibold">Peserta</th><th className="px-4 py-3 font-semibold">Username</th><th className="px-4 py-3 font-semibold">Grup</th><th className="px-4 py-3 font-semibold">Akun</th><th className="px-5 py-3 font-semibold text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-blue-50/40 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`grid place-items-center w-10 h-10 rounded-full text-sm font-bold shrink-0 ${avatarClass(u.namaLengkap)}`}>{initials(u.namaLengkap)}</span>
                      <div className="min-w-0"><p className="font-semibold text-blue-950 truncate">{u.namaLengkap}</p><p className="text-xs text-slate-500 truncate">{u.email || '—'}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-mono text-[13px] bg-page rounded-lg px-2 py-1">{u.username}<CopyButton text={u.username} /></span></td>
                  <td className="px-4 py-3">{u.grup
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 bg-blue-100 text-blue-800"><i className="w-1.5 h-1.5 rounded-full bg-blue-600" />{u.grup}</span>
                    : <span className="text-xs text-slate-400">— tanpa grup</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Switch checked={u.status === 'aktif'} onChange={() => toggle(u)} label={`Akun ${u.namaLengkap}`} />
                      <span className={`text-xs font-medium ${u.status === 'aktif' ? 'text-emerald-700' : 'text-slate-400'}`}>{u.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</span>
                      {u.mintaReset && <button onClick={() => setEdit({ ...u, groupId: u.groupId ?? '', newPassword: '' })} className="text-[11px] font-semibold bg-amber-300 text-blue-950 rounded-full px-2 py-0.5">minta reset</button>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button title="Ubah & password" onClick={() => { setEdit({ ...u, groupId: u.groupId ?? '', newPassword: '' }); setError('') }} className="grid place-items-center w-8 h-8 rounded-lg border border-line text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button>
                      <button title="Hapus" onClick={() => remove(u)} className="grid place-items-center w-8 h-8 rounded-lg border border-line text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-14 text-center text-slate-500"><Users className="mx-auto mb-2 text-slate-300" size={32} />Tidak ada peserta yang cocok.</td></tr>
              )}
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
        <Modal title="Tambah Peserta" onClose={() => setForm(null)}>
          <form onSubmit={create} className="space-y-3">
            <Input label="Nama lengkap *" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} required autoFocus />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Select label="Grup" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">— Tanpa grup —</option><GroupOptions />
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="otomatis dari nama" />
              <Input label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="otomatis acak" />
            </div>
            <p className="text-xs text-slate-500">Kosongkan username/password untuk dibuat otomatis. Peserta wajib mengganti password saat login pertama.</p>
            <ErrorText>{error}</ErrorText>
            <Button className="w-full">Simpan peserta</Button>
          </form>
        </Modal>
      )}

      {edit && (
        <Modal title="Ubah Peserta" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="flex items-center gap-3 bg-page rounded-xl p-3">
              <span className={`grid place-items-center w-11 h-11 rounded-full font-bold ${avatarClass(edit.namaLengkap)}`}>{initials(edit.namaLengkap)}</span>
              <div><p className="font-semibold text-blue-950">{edit.username}</p><p className="text-xs text-slate-500">Username tidak dapat diubah</p></div>
            </div>
            <Input label="Nama lengkap" value={edit.namaLengkap} onChange={(e) => setEdit({ ...edit, namaLengkap: e.target.value })} required />
            <Input label="Email" type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            <Select label="Grup" value={edit.groupId} onChange={(e) => setEdit({ ...edit, groupId: e.target.value })}>
              <option value="">— Tanpa grup —</option><GroupOptions />
            </Select>

            <fieldset className="border border-line rounded-xl p-4 space-y-3">
              <legend className="px-2 text-sm font-semibold text-blue-950 flex items-center gap-1.5"><KeyRound size={14} /> Password</legend>
              {edit.mintaReset && <p className="text-xs bg-amber-100 text-amber-900 rounded-lg px-3 py-2">Peserta ini meminta reset password.</p>}
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Input label="Atur password baru (opsional)" value={edit.newPassword} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} placeholder="min. 8 karakter" /></div>
                <Button type="button" variant="ghost" title="Isi dengan password acak" onClick={() => setEdit({ ...edit, newPassword: genPassword() })}><Dices size={16} /> Acak</Button>
              </div>
              <p className="text-xs text-slate-500">Diisi = password diganti saat disimpan, dan peserta wajib menggantinya lagi saat login. Kosong = password tidak berubah.</p>
              <button type="button" onClick={resetRandom} className="text-sm text-blue-700 font-semibold hover:underline">Reset ke password acak sekarang →</button>
            </fieldset>

            <ErrorText>{error}</ErrorText>
            <Button className="w-full">Simpan perubahan</Button>
          </form>
        </Modal>
      )}

      {imp && (
        <Modal title="Pratinjau Impor Peserta" onClose={() => setImp(null)} wide>
          <p className="text-xs text-slate-500 mb-3">Berkas: {imp.fileName}</p>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-extrabold text-emerald-700">{imp.valid.length}</p><p className="text-xs text-slate-500">baris valid</p></div>
            <div className="rounded-xl bg-red-50 p-3"><p className="text-2xl font-extrabold text-red-600">{imp.invalid.length}</p><p className="text-xs text-slate-500">baris bermasalah</p></div>
            <div className="rounded-xl bg-blue-50 p-3"><p className="text-2xl font-extrabold text-blue-700">{imp.grupBaru.length}</p><p className="text-xs text-slate-500">grup baru</p></div>
          </div>
          {imp.grupBaru.length > 0 && <p className="text-sm bg-blue-50 text-blue-900 rounded-xl px-3 py-2 mb-3">Grup baru akan dibuat otomatis: <b>{imp.grupBaru.join(', ')}</b></p>}
          {imp.invalid.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 mb-3 text-sm text-red-700">
              <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={15} /> Baris ini tidak akan diimpor — perbaiki di berkas lalu unggah ulang, atau abaikan:</p>
              <ul className="list-disc pl-5 max-h-36 overflow-y-auto">{imp.invalid.map((r) => <li key={r.baris}>Baris {r.baris}{r.nama ? ` (${r.nama})` : ''}: {r.alasan}</li>)}</ul>
            </div>
          )}
          {imp.valid.length > 0 && (
            <div className="max-h-56 overflow-y-auto border border-line rounded-xl mb-4">
              <table className="w-full text-sm">
                <thead className="bg-page text-left text-[11px] uppercase text-slate-500 sticky top-0"><tr><th className="px-3 py-2">Baris</th><th>Nama</th><th>Email</th><th>Grup</th><th>Username</th></tr></thead>
                <tbody className="divide-y divide-line">{imp.valid.map((r) => <tr key={r.baris}><td className="px-3 py-1.5 text-slate-400">{r.baris}</td><td>{r.nama_lengkap}</td><td className="text-slate-500">{r.email}</td><td>{r.grup}</td><td className="font-mono text-xs">{r.username || <i className="text-slate-400">otomatis</i>}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImp(null)}>Batal</Button>
            <Button variant="success" disabled={!imp.valid.length || busy} onClick={saveImport}>{busy ? 'Menyimpan…' : `Simpan ${imp.valid.length} peserta`}</Button>
          </div>
        </Modal>
      )}

      {creds && (
        <Modal title={creds.title} onClose={() => setCreds(null)} wide>
          <p className="text-sm bg-amber-100 text-amber-900 rounded-xl px-3 py-2 mb-3">Password hanya ditampilkan sekarang. Salin atau unduh, lalu bagikan ke peserta.</p>
          <table className="w-full text-sm mb-4">
            <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th>Nama</th><th>Grup</th><th>Username</th><th>Password</th></tr></thead>
            <tbody>{creds.rows.map((c) => <tr key={c.username} className="border-t border-line"><td className="py-1.5">{c.nama_lengkap}</td><td>{c.grup}</td><td className="font-mono">{c.username}</td><td className="font-mono">{c.password}</td></tr>)}</tbody>
          </table>
          <Button onClick={() => downloadCsv(creds.rows.map((c) => ({ nama: c.nama_lengkap, grup: c.grup ?? '', username: c.username, password: c.password })), 'kredensial-peserta.csv')}>
            <Download size={16} /> Unduh CSV kredensial
          </Button>
        </Modal>
      )}
    </div>
  )
}
