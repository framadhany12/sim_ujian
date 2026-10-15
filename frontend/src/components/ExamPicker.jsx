import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { Select } from './ui.jsx'

// Memilih ujian aktif; tersimpan di query string (?exam=ID)
export function useExamPicker() {
  const [exams, setExams] = useState([])
  const [sp, setSp] = useSearchParams()
  useEffect(() => { api('/admin/exams').then(setExams) }, [])
  const examId = +sp.get('exam') || exams[0]?.id || null
  const picker = (
    <div className="max-w-sm">
      <Select label="Ujian" value={examId ?? ''} onChange={(e) => setSp({ exam: e.target.value })}>
        {exams.map((e) => <option key={e.id} value={e.id}>{e.judul}</option>)}
      </Select>
    </div>
  )
  return { exams, examId, exam: exams.find((e) => e.id === examId), picker, loaded: exams.length > 0 }
}
