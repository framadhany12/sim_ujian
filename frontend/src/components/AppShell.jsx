import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, LogOut, KeyRound, Menu, X } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import Logo from './Logo.jsx'
import Footer from './Footer.jsx'

/**
 * Kerangka dashboard: sidebar bergrup + topbar.
 * groups: [{ label, items: [{ to, label, icon, end, badge, onClick }] }]
 */
export default function AppShell({ groups, subtitle, eyebrow, title, bell, helpCard, topExtra }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen lg:flex bg-page">
      {open && <div className="fixed inset-0 bg-blue-950/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-line flex flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5">
          <div className="leading-tight"><Logo height={30} /><p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{subtitle}</p></div>
          <button className="lg:hidden p-1" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={18} /></button>
        </div>

        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label} className="mb-3">
              <p className="px-3 pt-3 pb-1.5 text-[11px] uppercase tracking-widest text-slate-400">{g.label}</p>
              {g.items.map(({ to, label, icon: Icon, end, badge, disabled }) => (
                <NavLink key={label} to={to} end={end} onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${disabled ? 'opacity-40 pointer-events-none' : ''} ${isActive ? 'bg-amber-100 text-blue-950' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {({ isActive }) => (<>
                    <Icon size={18} className={isActive ? 'text-blue-700' : 'text-slate-400'} />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && <span className="text-[11px] font-bold bg-blue-700 text-white rounded-full px-2 py-0.5">{badge}</span>}
                  </>)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {helpCard && (
          <div className="m-3 relative overflow-hidden rounded-2xl bg-blue-950 text-white p-4 text-sm">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-amber-400/90" />
            <div className="absolute right-3 bottom-3 w-8 h-8 rounded-full border-4 border-blue-950/30" />
            <p className="font-bold relative">{helpCard.title}</p>
            <p className="text-blue-200 text-xs mt-1 mb-3 relative max-w-[10rem]">{helpCard.text}</p>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-line flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu size={20} /></button>
          <div className="leading-tight min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{eyebrow}</p>
            <h1 className="font-bold text-blue-950 truncate">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {topExtra}
            {bell && (
              <button onClick={() => nav(bell.to)} title={bell.title} className="relative grid place-items-center w-10 h-10 rounded-full border border-line hover:bg-slate-50">
                <Bell size={17} />
                {bell.count > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 grid place-items-center text-[10px] font-bold rounded-full bg-amber-400 text-blue-950 px-1">{bell.count}</span>}
              </button>
            )}
            <UserChip user={user} onPassword={() => nav('/ganti-password')} onLogout={() => { logout(); nav('/login') }} />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 w-full max-w-[1400px] mx-auto"><Outlet /></main>
        <Footer className="border-t border-line bg-white px-4 lg:px-8 py-4" />
      </div>
    </div>
  )
}

function UserChip({ user, onPassword, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-line hover:bg-slate-50">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-blue-700 text-white text-sm font-bold">{user.nama[0]?.toUpperCase()}</span>
        <span className="text-left leading-tight hidden sm:block">
          <span className="block text-sm font-semibold text-blue-950 max-w-36 truncate">{user.nama}</span>
          <span className="block text-[11px] text-slate-500">{user.role === 'admin' ? (user.superAdmin ? 'Super Admin' : 'Admin') : 'Calon Mahasiswa'}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-line rounded-xl shadow-lg z-20 p-1 text-sm">
            <button onClick={onPassword} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50"><KeyRound size={15} /> Ganti password</button>
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-red-600"><LogOut size={15} /> Keluar</button>
          </div>
        </>
      )}
    </div>
  )
}
