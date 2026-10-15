import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { User, Lock } from 'lucide-react'
import { useAuth, homeFor } from '../auth.jsx'
import { api } from '../api.js'
import AuthShell from '../components/AuthShell.jsx'
import { Button, ErrorText } from '../components/ui.jsx'

function Field({ icon: Icon, label, ...p }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1.5 font-medium text-slate-700">{label}</span>
      <span className="relative block">
        <Icon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input {...p} className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </span>
    </label>
  )
}

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true)
    try { nav(homeFor(await login(f.username, f.password)), { replace: true }) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  const forgot = async () => {
    if (!f.username) return setError('Isi username terlebih dahulu')
    setError('')
    const d = await api('/auth/forgot', { method: 'POST', body: { username: f.username } })
    setInfo(d.message)
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold text-blue-950">Selamat datang 👋</h2>
      <p className="text-slate-500 mt-1 mb-7">Masuk dengan username dan password dari Admin.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={User} label="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus required />
        <Field icon={Lock} label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <ErrorText>{error}</ErrorText>
        {info && <p className="text-sm text-emerald-700">{info}</p>}
        <Button variant="accent" className="w-full !py-3 text-base" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'}</Button>
      </form>
      <button onClick={forgot} className="mt-5 text-sm text-blue-700 hover:underline">Lupa password? Minta reset ke Admin</button>
    </AuthShell>
  )
}
