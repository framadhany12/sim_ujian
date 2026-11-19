import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { CameraOff } from 'lucide-react'
import { api, getToken, API_BASE, blobUrl } from '../../api.js'
import { useExamPicker } from '../../components/ExamPicker.jsx'
import { Card, Badge, Button, Modal, fmtDate } from '../../components/ui.jsx'
import { confirmDialog } from '../../components/Confirm.jsx'

const jam = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Foto kamera dimuat lewat fetch ber-Authorization, lalu ditampilkan sebagai object URL
function CamPhoto({ attemptId, ts, className }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let url, alive = true
    setFailed(false)
    blobUrl(`/admin/attempts/${attemptId}/camera/${ts}`).then((u) => { url = u; if (alive) setSrc(u); else URL.revokeObjectURL(u) }).catch(() => alive && setFailed(true))
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [attemptId, ts])
  if (failed) return <div className={`grid place-items-center bg-slate-100 text-[11px] text-slate-500 ${className}`}>gagal dimuat</div>
  return src ? <img src={src} alt={`Foto kamera pukul ${jam(ts)}`} className={`object-cover bg-slate-100 ${className}`} /> : <div className={`bg-slate-100 animate-pulse ${className}`} />
}

function CamGallery({ row, onClose }) {
  const [shots, setShots] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/admin/attempts/${row.attemptId}/camera`).then((d) => setShots(d.shots)).catch((e) => setError(e.message)) }, [row.attemptId])
  return (
    <Modal title={`Foto kamera: ${row.nama}`} onClose={onClose} wide>
      {error && <p className="text-sm text-red-600">Gagal memuat daftar foto: {error}</p>}
      {!shots && !error && <p className="text-sm text-slate-500">Memuat foto…</p>}
      {shots?.length === 0 && <p className="text-sm text-slate-500">Belum ada foto. Foto pertama diambil beberapa detik setelah peserta membuka soal, lalu setiap 60 detik.</p>}
      {shots?.length > 0 && (
        <>
          <p className="text-xs text-slate-500 mb-3">{shots.length} foto, terbaru dulu. Foto dihapus otomatis 7 hari setelah diambil.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
            {shots.map((ts) => (
              <figure key={ts}>
                <CamPhoto attemptId={row.attemptId} ts={ts} className="w-full aspect-[4/3] rounded-lg" />
                <figcaption className="text-xs text-slate-500 mt-1">{jam(ts)}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

const ST = { belum_mulai: ['slate', 'Belum mulai'], sedang_mengerjakan: ['amber', 'Sedang mengerjakan'], selesai: ['green', 'Selesai'] }

// Satu sumber untuk tabel (desktop) dan kartu (HP)
function CamCell({ r, onOpen }) {
  return r.kameraTerakhir
    ? <button onClick={() => onOpen(r)} title="Lihat semua foto kamera" className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <CamPhoto attemptId={r.attemptId} ts={r.kameraTerakhir} className="w-20 h-15 rounded-lg" />
        <span className="block text-[11px] text-slate-500 mt-0.5">{jam(r.kameraTerakhir)} · {r.jumlahFoto} foto</span>
      </button>
    : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><CameraOff size={14} /> belum ada foto</span>
}

function Warnings({ r }) {
  const fotoHilang = r.status === 'sedang_mengerjakan' && !r.terputus && r.waktuMulai && Date.now() - new Date(r.waktuMulai).getTime() > 150000 && (!r.kameraTerakhir || Date.now() - r.kameraTerakhir > 150000)
  if (!r.terputus && !(r.keluarHalaman > 0) && !(r.kameraMati > 0) && !fotoHilang) return null
  return (
    <div className="flex flex-wrap gap-1">
      {r.terputus && <Badge color="red">koneksi terputus</Badge>}
      {r.keluarHalaman > 0 && <Badge color="amber">keluar halaman ×{r.keluarHalaman}</Badge>}
      {r.kameraMati > 0 && <Badge color="red">kamera mati ×{r.kameraMati}</Badge>}
      {fotoHilang && <Badge color="red">foto kamera tidak masuk</Badge>}
    </div>
  )
}


export default function Monitor() {
  const { examId, grupId, picker, loaded } = useExamPicker()
  const [allRows, setRows] = useState([])
  const [gallery, setGallery] = useState(null)

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
  const rows = grupId ? allRows.filter((r) => r.grupIds.includes(grupId)) : allRows
  const count = (s) => rows.filter((r) => r.status === s).length

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pantau Peserta Langsung</h1>
      {picker}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        {Object.entries(ST).map(([k, [, label]]) => <Card key={k} className="!p-3 sm:!p-5"><p className="text-2xl font-bold">{count(k)}</p><p className="text-xs sm:text-sm text-slate-500">{label}</p></Card>)}
      </div>

      {rows.length === 0 && <Card className="text-center text-sm text-slate-500">{grupId ? 'Tidak ada peserta di kelas ini.' : 'Belum ada peserta.'}</Card>}

      <ul className="space-y-3 xl:hidden">
        {rows.map((r) => (
          <li key={r.userId} className="bg-white border border-line rounded-2xl p-3 flex gap-3">
            <div className="shrink-0"><CamCell r={r} onOpen={setGallery} /></div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium break-words">{r.nama}</p>
                <p className="text-xs text-slate-500 font-mono break-all">{r.username}</p>
                {r.grup && <p className="text-xs text-slate-500 mt-0.5">{r.grup}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={ST[r.status][0]}>{ST[r.status][1]}</Badge>
                {r.status !== 'belum_mulai' && <Button variant="ghost" className="min-h-11 text-xs" onClick={() => reset(r)}>Reset</Button>}
              </div>
              {r.waktuMulai && <p className="text-xs text-slate-500">Mulai {fmtDate(r.waktuMulai)}{r.lastSeen ? ` · aktif ${new Date(r.lastSeen).toLocaleTimeString('id-ID')}` : ''}</p>}
              <Warnings r={r} />
            </div>
          </li>
        ))}
      </ul>

      {rows.length > 0 && (
        <Card className="hidden xl:block overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>{['Kamera', 'Peserta', 'Kelas', 'Status', 'Mulai', 'Terakhir aktif', 'Peringatan'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap"><CamCell r={r} onOpen={setGallery} /></td>
                  <td className="px-4 py-2">{r.nama}<div className="text-xs text-slate-500 font-mono">{r.username}</div></td>
                  <td className="px-4 py-2">{r.grup ?? '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Badge color={ST[r.status][0]}>{ST[r.status][1]}</Badge>
                      {r.status !== 'belum_mulai' && <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => reset(r)}>Reset</Button>}
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.waktuMulai)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.lastSeen ? new Date(r.lastSeen).toLocaleTimeString('id-ID') : '-'}</td>
                  <td className="px-4 py-2"><Warnings r={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {gallery && <CamGallery row={gallery} onClose={() => setGallery(null)} />}
    </div>
  )
}
