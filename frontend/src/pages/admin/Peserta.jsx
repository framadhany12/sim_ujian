import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Upload, Download, KeyRound, Search, Pencil, Trash2, Copy, Check, Dices, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight, Users, UserPlus, UserMinus } from 'lucide-react'
import { api, download } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Button, Input, Card, Modal, ErrorText, downloadCsv } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const empty = { nama_lengkap: '', email: '', groupIds: [], username: '', password: '' }
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

// Pilih banyak grup milik admin (checkbox berbentuk chip)
function GroupPicker({ groups, value, onChange }) {
  if (!groups.length) return <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">Anda belum punya grup. Buat dulu di menu <b>Kelola Grup</b>.</p>
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const on = value.includes(g.id)
        return <button type="button" key={g.id} onClick={() => toggle(g.id)} className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>{on ? '✓ ' : ''}{g.nama}</button>
      })}
    </div>
  )
}

const groupNames = (ids, groups) => groups.filter((g) => ids.includes(g.id)).map((g) => g.nama).join('; ')

export default function Peserta() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [list, setList] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState(null)
  const [edit, setEdit] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creds, setCreds] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [imp, setImp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filterGroup, setFilterGroup] = useState(params.get('grup') ?? (user?.superAdmin ? 'all' : 'mine'))
  const [bulkGroup, setBulkGroup] = useState('')
  const [tab, setTab] = useState('semua')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const fileRef = useRef()

  const load = () => { api('/admin/peserta').then(setList); api('/admin/groups').then(setGroups); setSelected(new Set()) }
  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [q, filterGroup, tab])

  const myGroups = useMemo(() => groups.filter((g) => g.bisaUbah), [groups])
  const otherGroups = useMemo(() => groups.filter((g) => !g.bisaUbah), [groups])
  // Daftar sesuai filter grup dulu; tab status dihitung dari hasil itu
  const inScope = useMemo(() => list.filter((u) =>
    filterGroup === 'all' ? true
    : filterGroup === 'mine' ? u.diGrupSaya
    : filterGroup === 'none' ? u.groups.length === 0
    : u.groups.some((g) => String(g.id) === filterGroup)), [list, filterGroup])

  const counts = useMemo(() => ({
    semua: inScope.length, aktif: inScope.filter((u) => u.status === 'aktif').length,
    nonaktif: inScope.filter((u) => u.status !== 'aktif').length, reset: inScope.filter((u) => u.mintaReset).length,
  }), [inScope])

  const shown = useMemo(() => inScope.filter((u) =>
    (tab === 'semua' || (tab === 'reset' ? u.mintaReset : tab === 'aktif' ? u.status === 'aktif' : u.status !== 'aktif')) &&
    (!q || `${u.namaLengkap} ${u.username} ${u.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [inScope, q, tab])
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const rows = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const pageAllSelected = rows.length > 0 && rows.every((u) => selected.has(u.id))
  const allShownSelected = shown.length > 0 && shown.every((u) => selected.has(u.id))
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const togglePage = () => setSelected((s) => { const n = new Set(s); rows.forEach((u) => (pageAllSelected ? n.delete(u.id) : n.add(u.id))); return n })

  const create = async (e) => {
    e.preventDefault(); setError('')
    try {
      const c = await api('/admin/peserta', { method: 'POST', body: form })
      setForm(null); setCreds({ title: 'Kredensial peserta baru', rows: [{ ...c, grup: groupNames(form.groupIds, groups) }] }); load()
    } catch (err) { setError(err.message) }
  }

  const openEdit = (u) => { setEdit({ ...u, groupIds: u.groups.filter((g) => g.bisaUbah).map((g) => g.id), newPassword: '' }); setError('') }
  const editGrup = () => edit.groups.map((g) => g.nama).join('; ')
  // Ubah data + (opsional) set password manual dalam satu simpan
  const saveEdit = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api(`/admin/peserta/${edit.id}`, { method: 'PUT', body: { namaLengkap: edit.namaLengkap, email: edit.email, groupIds: edit.groupIds } })
      if (edit.newPassword) {
        const c = await api(`/admin/peserta/${edit.id}/reset-password`, { method: 'POST', body: { password: edit.newPassword } })
        setCreds({ title: 'Password diperbarui', rows: [{ ...c, nama_lengkap: edit.namaLengkap, grup: editGrup() }] })
      }
      setEdit(null); load()
    } catch (err) { setError(err.message) }
  }
  const resetRandom = async () => {
    if (!(await confirmDialog({ title: 'Buat password baru?', message: `Password acak baru akan dibuat untuk ${edit.username}. Password lama tidak berlaku lagi.`, confirmText: 'Ya, buat baru', danger: false }))) return
    setError('')
    try {
      const c = await api(`/admin/peserta/${edit.id}/reset-password`, { method: 'POST' })
      setCreds({ title: 'Password baru (acak)', rows: [{ ...c, nama_lengkap: edit.namaLengkap, grup: editGrup() }] })
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
      if (d.created.length) setCreds({ title: `${d.created.length} peserta baru diimpor`, rows: d.created })
      load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  const toggle = async (u) => { await api(`/admin/peserta/${u.id}`, { method: 'PUT', body: { status: u.status === 'aktif' ? 'nonaktif' : 'aktif' } }); load() }
  const remove = async (u) => {
    if (!(await confirmDialog({ title: 'Hapus akun mahasiswa?', message: `Akun ${u.namaLengkap} akan dihapus beserta seluruh data pengerjaannya, termasuk di grup dan ujian dosen lain.`, confirmText: 'Ya, hapus' }))) return
    await api(`/admin/peserta/${u.id}`, { method: 'DELETE' }); load()
  }
  const removeSelected = async () => {
    const n = selected.size
    if (!(await confirmDialog({ title: `Hapus ${n} akun mahasiswa?`, message: `${n} akun terpilih akan dihapus beserta seluruh data pengerjaannya. Akun yang dibuat admin lain dilewati. Tindakan ini tidak bisa dibatalkan.`, confirmText: `Ya, hapus` }))) return
    setBusy(true); setNotice('')
    try {
      const d = await api('/admin/peserta/bulk-delete', { method: 'POST', body: { ids: [...selected] } })
      setNotice(`${d.deleted} akun dihapus${d.skipped ? `, ${d.skipped} dilewati karena dibuat admin lain` : ''}.`); load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  const bulkMember = async (action) => {
    const g = myGroups.find((x) => String(x.id) === bulkGroup); if (!g) return
    setBusy(true); setNotice('')
    try {
      const d = await api(`/admin/groups/${g.id}/members`, { method: 'POST', body: { ids: [...selected], action } })
      setNotice(action === 'remove' ? `${d.count} mahasiswa dikeluarkan dari ${g.nama}.` : `${d.count} mahasiswa dimasukkan ke ${g.nama}.`); load()
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }

  const tabs = [['semua', 'Semua'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['reset', 'Minta reset']]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-2xl font-extrabold text-blue-950">Manajemen Peserta</h2><p className="text-sm text-slate-500">{list.filter((u) => u.diGrupSaya).length} mahasiswa di grup Anda · {list.length} mahasiswa terdaftar · {myGroups.length} grup Anda</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => download('/admin/peserta/template?format=xlsx', 'template-peserta.xlsx')}><FileSpreadsheet size={16} /> Template</Button>
          <Button variant="ghost" onClick={() => download('/admin/peserta/export?format=xlsx', 'data-peserta.xlsx')}><Download size={16} /> Ekspor</Button>
          <Button variant="ghost" onClick={() => fileRef.current.click()}><Upload size={16} /> Impor</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={doImport} />
          <Button onClick={() => { setForm({ ...empty, groupIds: filterGroup !== 'all' && myGroups.some((g) => String(g.id) === filterGroup) ? [+filterGroup] : [] }); setError('') }}><Plus size={16} /> Tambah Peserta</Button>
        </div>
      </div>

      {notice && <p className="text-sm bg-emerald-50 text-emerald-800 rounded-xl px-4 py-2.5">{notice}</p>}
      {importResult?.joined?.length > 0 && (
        <Card className="!border-blue-200 !bg-blue-50 text-sm">
          <b>{importResult.joined.length} mahasiswa sudah terdaftar dan dimasukkan ke grup</b> (akun tidak dibuat ulang, password tidak berubah):
          <ul className="list-disc ml-5">{importResult.joined.map((j) => <li key={j.username}>{j.nama_lengkap} ({j.username}) → {j.grup}</li>)}</ul>
        </Card>
      )}
      {importResult?.failed.length > 0 && (
        <Card className="!border-red-200 !bg-red-50 text-sm">
          <b>{importResult.failed.length} baris gagal diimpor:</b>
          <ul className="list-disc ml-5">{importResult.failed.map((f) => <li key={f.baris}>Baris {f.baris}: {f.alasan}</li>)}</ul>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line">
          <div className="flex gap-1 bg-page rounded-full p-1 overflow-x-auto max-w-full">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 shrink-0 ${tab === k ? 'bg-blue-950 text-white' : 'text-slate-500 hover:text-blue-950'}`}>
                {l}<span className={`text-[11px] rounded-full px-1.5 ${tab === k ? 'bg-white/20' : k === 'reset' && counts.reset ? 'bg-amber-300 text-blue-950' : 'bg-white'}`}>{counts[k]}</span>
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} aria-label="Filter grup" className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white max-w-full">
            <option value="mine">Mahasiswa di grup saya</option>
            <option value="all">Semua mahasiswa terdaftar</option>
            <option value="none">Tanpa grup</option>
            {myGroups.length > 0 && <optgroup label="Grup saya">{myGroups.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}</optgroup>}
            {otherGroups.length > 0 && <optgroup label="Grup admin lain">{otherGroups.map((g) => <option key={g.id} value={g.id}>{g.nama} — {g.pemilik}</option>)}</optgroup>}
          </select>
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / username…" className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-blue-50 border-b border-line text-sm">
            <b className="text-blue-950">{selected.size} dipilih</b>
            {!allShownSelected && <button onClick={() => setSelected(new Set(shown.map((u) => u.id)))} className="text-blue-700 font-semibold hover:underline">Pilih semua {shown.length} hasil filter</button>}
            <button onClick={() => setSelected(new Set())} className="text-slate-600 hover:underline">Batal pilih</button>
            <span className="flex-1" />
            {myGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} aria-label="Grup tujuan" className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                  <option value="">Pilih grup saya…</option>{myGroups.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
                <Button variant="ghost" disabled={!bulkGroup || busy} onClick={() => bulkMember('add')}><UserPlus size={15} /> Masukkan</Button>
                <Button variant="ghost" disabled={!bulkGroup || busy} onClick={() => bulkMember('remove')}><UserMinus size={15} /> Keluarkan</Button>
              </div>
            )}
            <Button variant="danger" disabled={busy} onClick={removeSelected}><Trash2 size={15} /> Hapus akun</Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-page/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="pl-5 py-3 w-8"><input type="checkbox" aria-label="Pilih semua di halaman ini" checked={pageAllSelected} onChange={togglePage} className="w-4 h-4 accent-blue-700 align-middle" /></th><th className="px-4 py-3 font-semibold">Peserta</th><th className="px-4 py-3 font-semibold">Username</th><th className="px-4 py-3 font-semibold">Grup</th><th className="px-4 py-3 font-semibold">Akun</th><th className="px-5 py-3 font-semibold text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className={`transition ${selected.has(u.id) ? 'bg-blue-50/70' : 'hover:bg-blue-50/40'}`}>
                  <td className="pl-5 py-3"><input type="checkbox" aria-label={`Pilih ${u.namaLengkap}`} checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} className="w-4 h-4 accent-blue-700 align-middle" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`grid place-items-center w-10 h-10 rounded-full text-sm font-bold shrink-0 ${avatarClass(u.namaLengkap)}`}>{initials(u.namaLengkap)}</span>
                      <div className="min-w-0"><p className="font-semibold text-blue-950 truncate">{u.namaLengkap}</p><p className="text-xs text-slate-500 truncate">{u.email || '—'}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-mono text-[13px] bg-page rounded-lg px-2 py-1">{u.username}<CopyButton text={u.username} /></span></td>
                  <td className="px-4 py-3">
                    {u.groups.length
                      ? <div className="flex flex-wrap gap-1 max-w-72">{u.groups.map((g) => (
                          <span key={g.id} title={g.bisaUbah ? 'Grup Anda' : 'Grup admin lain'} className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${g.bisaUbah ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}><i className={`w-1.5 h-1.5 rounded-full ${g.bisaUbah ? 'bg-blue-600' : 'bg-slate-400'}`} />{g.nama}</span>
                        ))}</div>
                      : <span className="text-xs text-slate-400">— tanpa grup</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Switch checked={u.status === 'aktif'} onChange={() => toggle(u)} label={`Akun ${u.namaLengkap}`} />
                      <span className={`text-xs font-medium ${u.status === 'aktif' ? 'text-emerald-700' : 'text-slate-400'}`}>{u.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</span>
                      {u.mintaReset && <button onClick={() => openEdit(u)} className="text-[11px] font-semibold bg-amber-300 text-blue-950 rounded-full px-2 py-0.5">minta reset</button>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button title="Ubah, grup & password" onClick={() => openEdit(u)} className="grid place-items-center w-8 h-8 rounded-lg border border-line text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button>
                      {u.bisaHapus && <button title="Hapus akun" onClick={() => remove(u)} className="grid place-items-center w-8 h-8 rounded-lg border border-line text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-500"><Users className="mx-auto mb-2 text-slate-300" size={32} />
                  {filterGroup === 'mine' && !q ? <>Belum ada mahasiswa di grup Anda. Tambah peserta baru, impor, atau pilih <button onClick={() => setFilterGroup('all')} className="text-blue-700 font-semibold hover:underline">Semua mahasiswa terdaftar</button> untuk memasukkan mahasiswa yang sudah ada ke grup Anda.</> : 'Tidak ada peserta yang cocok.'}
                </td></tr>
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
            <p className="text-xs bg-blue-50 text-blue-900 rounded-lg px-3 py-2">Mahasiswa sudah punya akun dari dosen lain? Jangan buat baru — pilih filter <b>Semua mahasiswa terdaftar</b>, centang mahasiswanya, lalu <b>Masukkan</b> ke grup Anda.</p>
            <Input label="Nama lengkap *" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} required autoFocus />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div><p className="text-sm text-slate-600 mb-1.5">Grup (boleh lebih dari satu)</p><GroupPicker groups={myGroups} value={form.groupIds} onChange={(groupIds) => setForm({ ...form, groupIds })} /></div>
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
            <div>
              <p className="text-sm text-slate-600 mb-1.5">Grup saya</p>
              <GroupPicker groups={myGroups} value={edit.groupIds} onChange={(groupIds) => setEdit({ ...edit, groupIds })} />
              {edit.groups.some((g) => !g.bisaUbah) && <p className="text-xs text-slate-500 mt-2">Juga terdaftar di grup admin lain: {edit.groups.filter((g) => !g.bisaUbah).map((g) => g.nama).join(', ')}</p>}
            </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-extrabold text-emerald-700">{imp.valid.filter((r) => !r.sudahAda).length}</p><p className="text-xs text-slate-500">akun baru</p></div>
            <div className="rounded-xl bg-blue-50 p-3"><p className="text-2xl font-extrabold text-blue-700">{imp.valid.filter((r) => r.sudahAda).length}</p><p className="text-xs text-slate-500">sudah terdaftar → masuk grup</p></div>
            <div className="rounded-xl bg-red-50 p-3"><p className="text-2xl font-extrabold text-red-600">{imp.invalid.length}</p><p className="text-xs text-slate-500">baris bermasalah</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-extrabold text-amber-700">{imp.grupBaru.length}</p><p className="text-xs text-slate-500">grup baru</p></div>
          </div>
          {imp.grupBaru.length > 0 && <p className="text-sm bg-amber-50 text-amber-900 rounded-xl px-3 py-2 mb-3">Grup baru akan dibuat otomatis (milik Anda): <b>{imp.grupBaru.join(', ')}</b></p>}
          {imp.invalid.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 mb-3 text-sm text-red-700">
              <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={15} /> Baris ini tidak akan diimpor — perbaiki di berkas lalu unggah ulang, atau abaikan:</p>
              <ul className="list-disc pl-5 max-h-36 overflow-y-auto">{imp.invalid.map((r) => <li key={r.baris}>Baris {r.baris}{r.nama ? ` (${r.nama})` : ''}: {r.alasan}</li>)}</ul>
            </div>
          )}
          {imp.valid.length > 0 && (
            <div className="max-h-56 overflow-auto border border-line rounded-xl mb-4">
              <table className="w-full text-sm">
                <thead className="bg-page text-left text-[11px] uppercase text-slate-500 sticky top-0"><tr><th className="px-3 py-2">Baris</th><th>Nama</th><th>Grup</th><th>Username</th><th>Keterangan</th></tr></thead>
                <tbody className="divide-y divide-line">{imp.valid.map((r) => <tr key={r.baris}><td className="px-3 py-1.5 text-slate-400">{r.baris}</td><td>{r.nama_lengkap}</td><td>{r.grup}</td><td className="font-mono text-xs">{r.username || <i className="text-slate-400">otomatis</i>}</td><td className="text-xs">{r.sudahAda ? <span className="text-blue-700 font-semibold">sudah terdaftar → masuk grup</span> : 'akun baru'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImp(null)}>Batal</Button>
            <Button variant="success" disabled={!imp.valid.length || busy} onClick={saveImport}>{busy ? 'Menyimpan…' : `Simpan ${imp.valid.length} baris`}</Button>
          </div>
        </Modal>
      )}

      {creds && (
        <Modal title={creds.title} onClose={() => setCreds(null)} wide>
          <p className="text-sm bg-amber-100 text-amber-900 rounded-xl px-3 py-2 mb-3">Password hanya ditampilkan sekarang. Salin atau unduh, lalu bagikan ke peserta.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-4">
              <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th>Nama</th><th>Grup</th><th>Username</th><th>Password</th></tr></thead>
              <tbody>{creds.rows.map((c) => <tr key={c.username} className="border-t border-line"><td className="py-1.5">{c.nama_lengkap}</td><td>{c.grup}</td><td className="font-mono">{c.username}</td><td className="font-mono">{c.password}</td></tr>)}</tbody>
            </table>
          </div>
          <Button onClick={() => downloadCsv(creds.rows.map((c) => ({ nama: c.nama_lengkap, grup: c.grup ?? '', username: c.username, password: c.password })), 'kredensial-peserta.csv')}>
            <Download size={16} /> Unduh CSV kredensial
          </Button>
        </Modal>
      )}
    </div>
  )
}
