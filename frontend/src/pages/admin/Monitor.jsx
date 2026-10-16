import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getToken, API_BASE } from '../../api.js'
import { useExamPicker } from '../../components/ExamPicker.jsx'
import { Card, Badge, Button, fmtDate } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const ST = { belum_mulai: ['slate', 'Belum mulai'], sedang_mengerjakan: ['amber', 'Sedang mengerjakan'], selesai: ['green', 'Selesai'] }

export default function Monitor() {
  const { examId, picker, loaded } = useExamPicker()
  const [rows, setRows] = useState([])

  const load = useCallback(() => examId && api(`/admin/exams/${examId}/monitor`).then(setRows), [examId])
  useEffect(() => {
    load()
    const poll = setInterval(load, 10000) // cadangan bila WebSocket terputus
    const socket = io(API_BASE, { auth: { token: getToken() } })
    socket.on('monitor:update', (m) => { if (m.examId === examId) load() })
    return () => { clearInterval(poll); socket.disconnect() }
  }, [load, examId])

  const reset = async (r) => {
    if (!(await confirmDialog({ title: 'Reset ujian peserta?', message: `Ujian ${r.nama} akan dikembalikan ke "Belum mulai". Seluruh jawaban dan nilainya dihapus, lalu peserta bisa mengulang dari awal.`, confirmText: 'Ya, reset' }))) return
    try { await api(`/admin/exams/${examId}/monitor/${r.userId}/reset`, { method: 'POST' }); load() }
    catch (e) { alert(e.message || 'Gagal mereset') }
  }

  if (!loaded) return <Card className="text-slate-500">Belum ada ujian.</Card>
  const count = (s) => rows.filter((r) => r.status === s).length

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pantau Peserta Langsung</h1>
      {picker}
      <div className="grid grid-cols-3 gap-3 text-center">
        {Object.entries(ST).map(([k, [, label]]) => <Card key={k}><p className="text-2xl font-bold">{count(k)}</p><p className="text-sm text-slate-500">{label}</p></Card>)}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left"><tr>{['Peserta', 'Status', 'Mulai', 'Terakhir aktif', 'Peringatan'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t">
                <td className="px-4 py-2">{r.nama}<div className="text-xs text-slate-500 font-mono">{r.username}</div></td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge color={ST[r.status][0]}>{ST[r.status][1]}</Badge>
                    {r.status !== 'belum_mulai' && <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => reset(r)}>Reset</Button>}
                  </div>
                </td>
                <td className="px-4 py-2">{fmtDate(r.waktuMulai)}</td>
                <td className="px-4 py-2">{r.lastSeen ? new Date(r.lastSeen).toLocaleTimeString('id-ID') : '-'}</td>
                <td className="px-4 py-2 space-x-1">
                  {r.terputus && <Badge color="red">koneksi terputus</Badge>}
                  {r.keluarHalaman > 0 && <Badge color="amber">keluar halaman ×{r.keluarHalaman}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
