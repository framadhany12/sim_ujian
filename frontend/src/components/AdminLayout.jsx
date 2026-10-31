import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarClock, BookOpen, Activity, ClipboardCheck, FolderKanban, KeyRound, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import AppShell from './AppShell.jsx'

const titles = {
  '/admin': 'Dashboard', '/admin/peserta': 'Manajemen Peserta', '/admin/ujian': 'Ujian Tersedia', '/admin/token': 'Token Ujian',
  '/admin/soal': 'Bank Soal', '/admin/grup': 'Grup Peserta', '/admin/monitor': 'Pantau Peserta Langsung', '/admin/nilai': 'Penilaian & Rekap Nilai',
  '/admin/admin': 'Kelola Admin',
}

export default function AdminLayout() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [stat, setStat] = useState({})
  useEffect(() => { api('/admin/dashboard').then(setStat).catch(() => {}) }, [pathname])

  const groups = [
    { label: 'Ringkasan', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    { label: 'Pelaksanaan Ujian', items: [
      { to: '/admin/ujian', label: 'Ujian Tersedia', icon: CalendarClock },
      { to: '/admin/token', label: 'Token Ujian', icon: KeyRound },
      { to: '/admin/monitor', label: 'Pantau Ujian', icon: Activity, badge: stat.sedangMengerjakan },
      { to: '/admin/soal', label: 'Bank Soal', icon: BookOpen },
      { to: '/admin/grup', label: 'Kelola Grup', icon: FolderKanban },
    ] },
    { label: 'Peserta & Hasil', items: [
      { to: '/admin/peserta', label: 'Peserta', icon: Users, badge: stat.mintaReset },
      { to: '/admin/nilai', label: 'Nilai & Laporan', icon: ClipboardCheck, badge: stat.esaiBelumDinilai },
    ] },
    ...(user?.superAdmin ? [{ label: 'Pengaturan', items: [{ to: '/admin/admin', label: 'Kelola Admin', icon: ShieldCheck }] }] : []),
  ]
  return (
    <AppShell
      groups={groups} subtitle="Panel Admin" eyebrow="Seleksi calon mahasiswa baru"
      title={titles[pathname] ?? (pathname.startsWith('/admin/ujian/') ? 'Atur Soal Ujian' : 'Admin')}
      bell={{ to: '/admin/peserta', count: stat.mintaReset, title: 'Permintaan reset password' }}
      helpCard={{ title: 'Perlu bantuan?', text: 'Impor peserta dan soal massal lewat template Excel/CSV.' }}
    />
  )
}
