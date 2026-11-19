import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flag, ChevronLeft, ChevronRight, Send, X, CheckCircle2, Check, Camera, LayoutGrid } from 'lucide-react'
import ExamTimer from '../components/ExamTimer.jsx'
import Logo from '../components/Logo.jsx'
import { api } from '../api.js'
import useExamLock from '../components/useExamLock.js'
import Watermark from '../components/Watermark.jsx'
import useCamera from '../components/useCamera.js'
import { useAuth } from '../auth.jsx'

const LETTERS = 'ABCDE'
const TIPE = { pilihan_ganda: 'Pilihan ganda', benar_salah: 'Benar / Salah', esai: 'Esai' }

export default function ExamPage() {
  const { attemptId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  const timers = useRef({})

  useEffect(() => {
    api(`/me/attempts/${attemptId}`)
      .then((d) => {
        // Sesuaikan waktu berakhir dengan jam server agar timer akurat walau jam perangkat salah
        setData({ ...d, endsAt: d.endsAt - d.serverNow + Date.now() })
        setAnswers(d.answers)
      })
      .catch((e) => (e.status === 409 ? (setSubmitted(true)) : setError(e.message)))
  }, [attemptId])

  const post = useCallback((event) => api(`/me/attempts/${attemptId}/event`, { method: 'POST', body: { event } }).catch(() => {}), [attemptId])

  // Heartbeat koneksi; pelanggaran dipantau oleh useExamLock
  useEffect(() => {
    if (!data || submitted) return
    const hb = setInterval(() => post('heartbeat'), 20000)
    return () => clearInterval(hb)
  }, [data, submitted, post])

  const cam = useCamera(!!data && !submitted, attemptId, post)
  // Dialog izin kamera di HP bisa memicu blur; jangan dihitung sebagai pindah tab
  const lock = useExamLock(!!data && !submitted && cam.status !== 'meminta', post)

  const save = useCallback(async (qid, patch, delay = 0) => {
    clearTimeout(timers.current[qid])
    setSaved(false)
    const run = async () => {
      try { await api(`/me/attempts/${attemptId}/answers/${qid}`, { method: 'PUT', body: patch }); setSaveError(false); setSaved(true) }
      catch (e) { if (e.data?.expired) setSubmitted(true); else setSaveError(true) }
    }
    if (delay) timers.current[qid] = setTimeout(run, delay); else run()
  }, [attemptId])

  const submit = useCallback(async () => {
    Object.values(timers.current).forEach(clearTimeout)
    try { await api(`/me/attempts/${attemptId}/submit`, { method: 'POST' }) } catch { /* sudah selesai */ }
    setSubmitted(true)
  }, [attemptId])

  const questions = data?.questions ?? []
  const total = questions.length
  const q = questions[index]
  const answered = useMemo(() => questions.filter((x) => (answers[x.id]?.jawaban ?? '').trim() !== '').length, [answers, questions])
  const doubtCount = Object.values(answers).filter((a) => a.isRagu).length

  if (error) return <main className="min-h-dvh grid place-items-center p-4 text-red-600">{error}</main>
  if (submitted) {
    return (
      <main className="min-h-dvh grid place-items-center p-4 bg-page">
        <div role="status" className="bg-white border border-line rounded-3xl p-6 sm:p-10 max-w-md w-full text-center">
          <span className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={34} /></span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-blue-950 mb-2">Jawaban berhasil terkirim</h1>
          <p className="text-sm text-slate-500">Terima kasih sudah mengerjakan. Hasil akan ditampilkan jika diizinkan oleh Admin.</p>
          <button onClick={() => nav('/jadwal')} className="mt-6 w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl bg-amber-400 text-blue-950 font-bold hover:bg-amber-300">Kembali ke Ruang Ujian</button>
        </div>
      </main>
    )
  }
  if (!data) return <main className="min-h-dvh grid place-items-center text-slate-500 bg-page">Memuat soal...</main>

  const cur = answers[q.id] ?? { jawaban: '', isRagu: false }
  const setAnswer = (v, delay = 0) => { setAnswers((a) => ({ ...a, [q.id]: { ...cur, jawaban: v } })); save(q.id, { jawaban: v }, delay) }
  const toggleDoubt = () => { setAnswers((a) => ({ ...a, [q.id]: { ...cur, isRagu: !cur.isRagu } })); save(q.id, { isRagu: !cur.isRagu }) }
  const pct = total ? Math.round((answered / total) * 100) : 0
  const panel = { questions, answers, index, answered, total, pct, doubtCount, onPick: setIndex }

  return (
    <div className="exam-locked min-h-dvh bg-page">
      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo height={28} />
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-500 truncate">Sesi ujian</span>
        </div>
        <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-blue-700" />
      </header>

      <div className="max-w-6xl mx-auto p-4 pb-28 lg:pb-4 space-y-4">
        <div className="sticky top-0 z-20 -mx-4 -mt-4 px-4 py-2.5 bg-white border-b border-line flex items-center gap-2 sm:gap-4 lg:static lg:mx-0 lg:mt-0 lg:px-5 lg:py-4 lg:border lg:rounded-2xl">
          <div className="flex-1 min-w-0"><p className="hidden sm:block text-[11px] uppercase tracking-widest text-slate-400">Seleksi calon mahasiswa</p><h1 className="text-sm sm:text-lg font-extrabold text-blue-950 leading-snug line-clamp-2">{data.exam.judul}</h1></div>
          <ExamTimer endsAt={data.endsAt} onExpire={submit} paused={submitted} />
          <button onClick={() => setConfirming(true)} aria-label="Selesai dan kirim jawaban" className="flex items-center justify-center gap-2 min-w-11 min-h-11 sm:px-4 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 active:bg-blue-900"><Send size={16} /> <span className="hidden sm:inline">Selesai</span></button>
        </div>
        {saveError && <p className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2">Koneksi bermasalah — jawaban terakhir belum tersimpan. Waktu tetap berjalan di server.</p>}

        <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
          <section className="bg-white border border-line rounded-2xl p-4 sm:p-6 flex flex-col">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
              <span className="px-3 py-1 rounded-full bg-blue-950 text-white text-xs font-bold">Soal {index + 1} / {total}</span>
              <span className="text-[11px] uppercase tracking-widest text-slate-400">{TIPE[q.tipe]}</span>
              <button onClick={toggleDoubt}
                className={`ml-auto flex items-center gap-1.5 min-h-11 text-sm font-medium px-3 py-1.5 rounded-xl border ${cur.isRagu ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-line text-slate-600 hover:bg-slate-50'}`}>
                <Flag size={15} /> {cur.isRagu ? 'Ragu-ragu ✓' : <><span className="hidden sm:inline">Tandai </span>ragu-ragu</>}
              </button>
            </div>

            <p className="text-base sm:text-[1.08rem] leading-relaxed text-blue-950 mb-6 whitespace-pre-wrap break-words">{q.teks}</p>
            {q.tipe !== 'esai' && <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-2">Pilih satu jawaban</p>}

            <div className="space-y-2.5 flex-1">
              {q.tipe === 'pilihan_ganda' && q.options.map((o, i) => (
                <Choice key={o.label} checked={cur.jawaban === o.label} onClick={() => setAnswer(o.label)} prefix={LETTERS[i]} text={o.teks} />
              ))}
              {q.tipe === 'benar_salah' && ['benar', 'salah'].map((v) => (
                <Choice key={v} checked={cur.jawaban === v} onClick={() => setAnswer(v)} prefix={v === 'benar' ? 'B' : 'S'} text={v === 'benar' ? 'Benar' : 'Salah'} />
              ))}
              {q.tipe === 'esai' && (
                <textarea rows={7} value={cur.jawaban} onChange={(e) => setAnswer(e.target.value, 800)}
                  placeholder="Tulis jawaban Anda di sini..."
                  className="w-full text-base border border-line rounded-xl p-3 sm:p-4 sm:min-h-60 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-page/50" />
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 lg:mt-7 pt-4 border-t border-line">
              <span className={`flex items-center gap-1.5 text-xs ${saved ? 'text-emerald-600' : 'text-slate-400'}`}><Check size={14} /> {saved ? 'Jawaban tersimpan otomatis' : 'Menyimpan...'}</span>
              <span className="flex-1" />
              <div className="hidden lg:flex items-center gap-3">
                <PrevButton disabled={index === 0} onClick={() => setIndex(index - 1)} />
                <NextButton last={index >= total - 1} onNext={() => setIndex(index + 1)} onSend={() => setConfirming(true)} />
              </div>
            </div>
          </section>

          <aside className="hidden lg:block bg-white border border-line rounded-2xl p-5">
            <NavPanel cols="grid-cols-5" cell="h-10" {...panel} />
          </aside>
        </div>
      </div>

      <nav aria-label="Navigasi soal" className="fixed inset-x-0 bottom-0 z-20 lg:hidden h-16 pl-[4.5rem] pr-3 bg-white border-t border-line flex items-center gap-2">
        <PrevButton compact disabled={index === 0} onClick={() => setIndex(index - 1)} />
        <button onClick={() => setNavOpen(true)} aria-label="Buka daftar soal"
          className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-line text-sm font-semibold text-blue-950 active:bg-slate-100">
          <LayoutGrid size={16} /> {index + 1}/{total}
        </button>
        <NextButton last={index >= total - 1} onNext={() => setIndex(index + 1)} onSend={() => setConfirming(true)} className="flex-1" />
      </nav>

      {navOpen && (
        <div className="fixed inset-0 z-[35] lg:hidden">
          <button aria-label="Tutup daftar soal" onClick={() => setNavOpen(false)} className="absolute inset-0 bg-blue-950/50" />
          <div role="dialog" aria-label="Daftar soal" className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto bg-white rounded-t-2xl p-4 shadow-2xl">
            <button onClick={() => setNavOpen(false)} aria-label="Tutup" className="absolute top-2 right-2 grid place-items-center w-11 h-11"><X size={18} /></button>
            <NavPanel cols="grid-cols-6 sm:grid-cols-8" cell="h-11" {...panel} onPick={(i) => { setIndex(i); setNavOpen(false) }} />
          </div>
        </div>
      )}

      {user && <Watermark lines={[user.nama, user.username, new Date().toLocaleDateString('id-ID')]} />}
      <video ref={cam.videoRef} muted playsInline aria-label="Pratinjau kamera Anda"
        className={`fixed bottom-3.5 left-3 z-30 w-12 lg:bottom-3 lg:w-32 aspect-[4/3] object-cover rounded-lg lg:rounded-xl border-2 border-white shadow-lg bg-blue-950 -scale-x-100 ${cam.status === 'aktif' ? '' : 'invisible'}`} />
      {lock.hidden && <div className="fixed inset-0 z-40 bg-blue-950" />}
      {(!lock.fullscreen || lock.warning) && (
        <div role="alertdialog" className="fixed inset-0 z-50 bg-blue-950/95 grid place-items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center">
            <h2 className="font-extrabold text-xl text-blue-950 mb-2">{lock.warning ? 'Peringatan pelanggaran' : 'Mode layar penuh diperlukan'}</h2>
            <p className="text-sm text-slate-600">{lock.warning || 'Ujian wajib dikerjakan dalam layar penuh. Waktu tetap berjalan.'}</p>
            {lock.violations > 0 && <p className="text-xs text-red-600 mt-2">Total pelanggaran tercatat: {lock.violations}</p>}
            <button onClick={() => { lock.enterFullscreen(); lock.dismiss() }} className="mt-5 w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl bg-amber-400 text-blue-950 font-bold hover:bg-amber-300">
              {lock.fullscreen ? 'Saya mengerti, lanjutkan' : 'Masuk layar penuh'}
            </button>
          </div>
        </div>
      )}

      {cam.status !== 'aktif' && (
        <div role="alertdialog" aria-labelledby="cam-title" className="fixed inset-0 z-[60] bg-blue-950 grid place-items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center">
            <Camera className="mx-auto mb-3 text-blue-700" size={32} />
            <h2 id="cam-title" className="font-extrabold text-xl text-blue-950 mb-2">{cam.status === 'meminta' ? 'Mengaktifkan kamera…' : 'Kamera wajib aktif'}</h2>
            <p className="text-sm text-slate-600">{cam.status === 'meminta' ? 'Jika browser bertanya, pilih Izinkan agar kamera bisa dipakai selama ujian.' : cam.error}</p>
            <p className="text-xs text-slate-500 mt-2">Soal disembunyikan sampai kamera aktif. Waktu ujian tetap berjalan.</p>
            {cam.status !== 'meminta' && (
              <button onClick={cam.start} className="mt-5 w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl bg-amber-400 text-blue-950 font-bold hover:bg-amber-300">Aktifkan kamera</button>
            )}
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-blue-950/60 grid place-items-center p-4 z-[36] overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-extrabold text-xl text-blue-950">Kirim jawaban?</h2>
              <button onClick={() => setConfirming(false)} aria-label="Tutup" className="grid place-items-center w-11 h-11 -mt-2 -mr-2"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 my-4 text-center">
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xl font-extrabold text-blue-800">{answered}</p><p className="text-[11px] text-slate-500">Terjawab</p></div>
              <div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-extrabold text-slate-700">{total - answered}</p><p className="text-[11px] text-slate-500">Kosong</p></div>
              <div className="rounded-xl bg-amber-100 p-3"><p className="text-xl font-extrabold text-amber-800">{doubtCount}</p><p className="text-[11px] text-slate-500">Ragu-ragu</p></div>
            </div>
            <p className="text-sm text-slate-600">Setelah dikirim, jawaban tidak dapat diubah.</p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              <button onClick={() => setConfirming(false)} className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">Periksa lagi</button>
              <button onClick={submit} className="min-h-11 px-4 py-2.5 rounded-xl bg-amber-400 text-blue-950 text-sm font-bold hover:bg-amber-300">Ya, kirim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Choice({ checked, onClick, prefix, text }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-3 min-h-12 border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 transition ${checked ? 'border-blue-700 bg-blue-50' : 'border-line hover:bg-slate-50 active:bg-slate-100'}`}>
      <span className={`grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 ${checked ? 'border-blue-700' : 'border-slate-300'}`}>{checked && <span className="w-2.5 h-2.5 rounded-full bg-blue-700" />}</span>
      <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-md text-xs font-bold ${checked ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{prefix}</span>
      <span className="min-w-0 text-blue-950 break-words">{text}</span>
    </button>
  )
}

function Legend({ color, label }) {
  return <li className="flex items-center gap-2"><span className={`w-4 h-4 rounded-md border ${color}`} />{label}</li>
}

function PrevButton({ compact, ...p }) {
  return (
    <button {...p} aria-label="Soal sebelumnya"
      className="flex items-center justify-center gap-1 min-h-11 min-w-11 px-3 lg:px-4 lg:py-2.5 rounded-xl border border-line text-sm font-semibold disabled:opacity-40 hover:bg-slate-50 active:bg-slate-100">
      <ChevronLeft size={17} /> {!compact && 'Sebelumnya'}
    </button>
  )
}

function NextButton({ last, onNext, onSend, className = '' }) {
  return last ? (
    <button onClick={onSend} className={`flex items-center justify-center gap-1.5 min-h-11 px-4 lg:px-5 rounded-xl bg-amber-400 text-blue-950 text-sm font-bold hover:bg-amber-300 active:bg-amber-500 ${className}`}>
      <Send size={15} /> <span className="whitespace-nowrap">Kirim<span className="hidden lg:inline"> jawaban</span></span>
    </button>
  ) : (
    <button onClick={onNext} className={`flex items-center justify-center gap-1 min-h-11 px-4 lg:px-5 rounded-xl bg-blue-950 text-white text-sm font-bold hover:bg-blue-900 active:bg-blue-800 ${className}`}>
      Berikutnya <ChevronRight size={17} />
    </button>
  )
}

function NavPanel({ questions, answers, index, answered, total, pct, doubtCount, onPick, cols, cell }) {
  const statusClass = (x, i) => {
    const base = answers[x.id]?.isRagu ? 'bg-amber-100 text-amber-900 border-amber-200'
      : (answers[x.id]?.jawaban ?? '') !== '' ? 'bg-blue-50 text-blue-800 border-blue-100'
      : 'bg-white text-slate-500 border-line hover:border-slate-300'
    return i === index ? `${base} !border-blue-950 !border-2 font-bold` : base
  }
  return (
    <>
      <h2 className="font-bold text-blue-950">Navigasi soal</h2>
      <div className="flex justify-between text-xs text-slate-500 mt-2"><span>Terjawab {answered} / {total}</span><span>{pct}%</span></div>
      <div className="h-1.5 rounded-full bg-slate-100 mt-1 mb-4"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} /></div>
      <div className={`grid ${cols} gap-2`}>
        {questions.map((x, i) => (
          <button key={x.id} onClick={() => onPick(i)} aria-current={i === index ? 'true' : undefined} className={`${cell} rounded-xl border text-sm ${statusClass(x, i)}`}>{i + 1}</button>
        ))}
      </div>
      <ul className="mt-5 pt-4 border-t border-line text-xs text-slate-500 space-y-2">
        <Legend color="bg-blue-100 border-blue-200" label="Sudah dijawab" />
        <Legend color="bg-amber-100 border-amber-300" label={`Ragu-ragu (${doubtCount})`} />
        <Legend color="bg-white border-blue-950 border-2" label="Soal aktif" />
      </ul>
    </>
  )
}
