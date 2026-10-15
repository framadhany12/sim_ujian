import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LayoutGrid, PenLine, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import AppShell from './AppShell.jsx'

const titles = { '/jadwal': 'Ruang Ujian', '/hasil': 'Hasil Ujian', '/tata-tertib': 'Tata Tertib' }

export default function PesertaLayout() {
  const { pathname } = useLocation()
  const [exams, setExams] = useState([])
  useEffect(() => { api('/me/exams').then(setExams).catch(() => {}) }, [pathname])
  const running = exams.find((e) => e.status === 'sedang_mengerjakan')

  const groups = [
    { label: 'Ujian', items: [
      { to: '/jadwal', label: 'Ruang Ujian', icon: LayoutGrid },
      { to: running ? `/ujian/${running.attemptId}` : '/jadwal', label: 'Pengerjaan', icon: PenLine, badge: running ? 1 : 0, disabled: !running },
      { to: '/hasil', label: 'Hasil Ujian', icon: ClipboardCheck },
    ] },
    { label: 'Panduan', items: [{ to: '/tata-tertib', label: 'Tata Tertib', icon: ShieldCheck }] },
  ]
  return (
    <AppShell
      groups={groups} subtitle="Ujian Online" eyebrow="Seleksi calon mahasiswa baru"
      title={titles[pathname] ?? (pathname.startsWith('/hasil') ? 'Hasil Ujian' : 'Ujian Online')}
      helpCard={{ title: 'Butuh bantuan?', text: 'Hubungi pengawas bila ujian terkendala atau lupa password.' }}
    />
  )
}
