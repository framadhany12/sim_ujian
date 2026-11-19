import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { Select } from './ui.jsx'

// Memilih ujian aktif dan kelas (grup) pelaksananya; tersimpan di query string (?exam=ID&grup=ID).
// Mengganti ujian otomatis mereset kelas karena daftar kelasnya berbeda tiap ujian.
export function useExamPicker() {
  const [exams, setExams] = useState([])
  const [sp, setSp] = useSearchParams()
  useEffect(() => { api('/admin/exams').then(setExams) }, [])
  const examId = +sp.get('exam') || exams[0]?.id || null
  const exam = exams.find((e) => e.id === examId)
  const kelas = exam?.groups ?? []
  const wanted = +sp.get('grup') || null
  const grupId = kelas.some((g) => g.id === wanted) ? wanted : null
  const picker = (
    <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
      <Select label="Ujian" value={examId ?? ''} onChange={(e) => setSp({ exam: e.target.value })}>
        {exams.map((e) => <option key={e.id} value={e.id}>{e.judul}</option>)}
      </Select>
      <Select label="Kelas" value={grupId ?? ''} disabled={kelas.length === 0}
        onChange={(e) => setSp(e.target.value ? { exam: examId, grup: e.target.value } : { exam: examId })}>
        <option value="">{kelas.length ? 'Semua kelas' : 'Ujian belum punya kelas'}</option>
        {kelas.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
      </Select>
    </div>
  )
  return { exams, examId, exam, grupId, picker, loaded: exams.length > 0 }
}
