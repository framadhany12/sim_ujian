import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, homeFor } from '../auth.jsx'
import { api } from '../api.js'
import AuthShell from '../components/AuthShell.jsx'
import { Button, Input, ErrorText } from '../components/ui.jsx'

export default function ChangePassword() {
  const { user, setUser } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (f.newPassword !== f.confirm) return setError('Konfirmasi password tidak cocok')
    try {
      const d = await api('/auth/change-password', { method: 'POST', body: f })
      setUser(d.user); nav(homeFor(d.user), { replace: true })
    } catch (err) { setError(err.message) }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold text-blue-950">Ganti Password</h2>
      {user.mustChangePassword
        ? <p className="text-sm bg-amber-100 text-amber-900 rounded-xl px-3 py-2 mt-3 mb-5">Demi keamanan, Anda wajib mengganti password awal sebelum melanjutkan.</p>
        : <div className="mb-5" />}
      <form onSubmit={submit} className="space-y-3">
        <Input label="Password saat ini" type="password" value={f.oldPassword} onChange={(e) => setF({ ...f, oldPassword: e.target.value })} required />
        <Input label="Password baru (min. 8 karakter)" type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required />
        <Input label="Ulangi password baru" type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        <ErrorText>{error}</ErrorText>
        <Button variant="accent" className="w-full !py-3">Simpan password</Button>
      </form>
      {!user.mustChangePassword && <button onClick={() => nav(-1)} className="mt-4 text-sm text-blue-700 hover:underline">← Kembali</button>}
    </AuthShell>
  )
}
