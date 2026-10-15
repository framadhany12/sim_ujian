import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, getToken, setToken } from './api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { username, password } })
    setToken(d.token); setUser(d.user)
    return d.user
  }
  const logout = () => { setToken(null); setUser(null) }

  return <Ctx.Provider value={{ user, setUser, login, logout, loading }}>{children}</Ctx.Provider>
}

export const homeFor = (u) => (u.mustChangePassword ? '/ganti-password' : u.role === 'admin' ? '/admin' : '/jadwal')

export function Protected({ role, children, allowMustChange = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-slate-500">Memuat...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && !allowMustChange) return <Navigate to="/ganti-password" replace />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return children
}
