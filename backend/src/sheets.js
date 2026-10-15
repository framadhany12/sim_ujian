import XLSX from 'xlsx'
import ExcelJS from 'exceljs'

export class SheetError extends Error {
  constructor(message) { super(message); this.status = 400 }
}

export const MAX_ROWS = 2000
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\*/g, '').trim().replace(/[\s.\-/]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
const cell = (v) => String(v ?? '').replace(/^﻿/, '').trim()

// CSV sederhana (RFC 4180): tanda kutip, pemisah koma / titik koma / tab
function parseCsv(text) {
  text = text.replace(/^﻿/, '')
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function readMatrix(buf, filename = '') {
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b
  const isOle = buf.length > 4 && buf[0] === 0xd0 && buf[1] === 0xcf
  if (isZip || isOle) {
    let wb
    try { wb = XLSX.read(buf, { type: 'buffer' }) } catch { throw new SheetError('Berkas Excel tidak dapat dibaca. Pastikan berkas tidak rusak atau terkunci password.') }
    const name = wb.SheetNames.find((n) => !/petunjuk|daftar|panduan|readme/i.test(n)) ?? wb.SheetNames[0]
    if (!name) throw new SheetError('Berkas Excel tidak memiliki lembar data.')
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: true })
  }
  if (/\.(xlsx|xls)$/i.test(filename)) throw new SheetError('Berkas Excel tidak valid atau rusak.')
  return parseCsv(buf.toString('utf8'))
}

/**
 * Baca tabel dari xlsx/xls/csv. Header dinormalisasi (huruf besar/kecil, spasi, tanda *, aksen)
 * dan boleh memakai alias. Mengembalikan baris dengan nomor baris aslinya.
 */
export function readTable(buf, filename, { required = [], aliases = {} } = {}) {
  const matrix = readMatrix(buf, filename)
  const headerIdx = matrix.findIndex((r) => r.some((c) => cell(c)))
  if (headerIdx < 0) throw new SheetError('Berkas kosong. Isi data sesuai template.')
  const keys = matrix[headerIdx].map((h) => { const n = norm(h); return aliases[n] ?? n })
  const missing = required.filter((k) => !keys.includes(k))
  if (missing.length) throw new SheetError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Unduh template terbaru dan jangan mengubah nama kolom.`)

  const rows = []
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const values = matrix[i]
    if (!values.some((c) => cell(c))) continue
    const obj = { _baris: i + 1 }
    keys.forEach((k, j) => { if (k && !(k in obj)) obj[k] = cell(values[j]) })
    rows.push(obj)
  }
  if (rows.length === 0) throw new SheetError('Tidak ada baris data. Isi data di bawah baris judul kolom.')
  if (rows.length > MAX_ROWS) throw new SheetError(`Terlalu banyak baris (${rows.length}). Maksimal ${MAX_ROWS} baris per berkas; bagi menjadi beberapa berkas.`)
  return rows
}

/* ───────────── Normalisasi nilai ───────────── */

export const parseBool = (v) => ['ya', 'y', 'yes', 'true', '1', 'benar'].includes(String(v ?? '').trim().toLowerCase())

export function parseNumber(v) {
  const s = String(v ?? '').trim().replace(',', '.')
  return s !== '' && /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

export function parseTipe(v) {
  const s = norm(v)
  if (['pilihan_ganda', 'pg', 'pilgan', 'multiple_choice', 'pilihan'].includes(s)) return 'pilihan_ganda'
  if (['esai', 'essay', 'uraian'].includes(s)) return 'esai'
  if (['benar_salah', 'bs', 'true_false', 'benarsalah'].includes(s)) return 'benar_salah'
  return null
}

export function parseBenarSalah(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (['benar', 'b', 'true', 'ya', '1'].includes(s)) return 'benar'
  if (['salah', 's', 'false', 'tidak', '0'].includes(s)) return 'salah'
  return null
}

/* ───────────── Pembuat berkas ───────────── */

const NAVY = 'FF0F2557', YELLOW = 'FFFCC419', LIGHT = 'FFEEF4FF'

/**
 * columns: [{ key, header, width, required, list?: string[]|'Daftar!A1:A50', note }]
 * rows: array objek. instructions: baris teks untuk lembar "Petunjuk".
 * lists: { namaKolom: [nilai...] } untuk dropdown dari lembar tersembunyi "Daftar".
 */
export async function buildWorkbook({ title, columns, rows, instructions = [], dropdowns = {}, validRows = 1000, extraDropdownRange = {} }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Ujian Online Politeknik TEDC'
  const ws = wb.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }))
  ws.getRow(1).height = 24
  columns.forEach((c, i) => {
    const h = ws.getRow(1).getCell(i + 1)
    h.font = { bold: true, color: { argb: c.required ? NAVY : 'FFFFFFFF' } }
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? YELLOW : NAVY } }
    h.alignment = { vertical: 'middle' }
    if (c.note) h.note = c.note
  })
  rows.forEach((r) => ws.addRow(r))
  ws.eachRow({ includeEmpty: false }, (row, n) => { if (n > 1) row.alignment = { vertical: 'top', wrapText: true } })

  // Lembar tersembunyi berisi daftar pilihan untuk dropdown
  const lists = ws.workbook.addWorksheet('Daftar', { state: 'hidden' })
  let col = 0
  const listRef = {}
  for (const [key, values] of Object.entries(dropdowns)) {
    col++
    const vals = values.length ? values : ['']
    vals.forEach((v, i) => { lists.getCell(i + 1, col).value = v })
    const letter = lists.getColumn(col).letter
    listRef[key] = `Daftar!$${letter}$1:$${letter}$${Math.max(vals.length, 1)}`
  }
  columns.forEach((c, i) => {
    if (!listRef[c.key]) return
    const strict = c.strictList !== false
    for (let r = 2; r <= validRows + 1; r++) {
      ws.getCell(r, i + 1).dataValidation = {
        type: 'list', allowBlank: true, formulae: [listRef[c.key]],
        showErrorMessage: strict, errorTitle: 'Nilai tidak valid', error: 'Pilih nilai dari daftar.',
      }
    }
  })
  columns.forEach((c, i) => {
    if (c.numeric) for (let r = 2; r <= validRows + 1; r++) {
      ws.getCell(r, i + 1).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: 'Angka tidak valid', error: 'Isi angka lebih dari 0.' }
    }
  })

  if (instructions.length) {
    const p = wb.addWorksheet('Petunjuk', { properties: { tabColor: { argb: YELLOW } } })
    p.getColumn(1).width = 110
    instructions.forEach((line, i) => {
      const c = p.getCell(i + 1, 1)
      c.value = line
      c.alignment = { wrapText: true, vertical: 'top' }
      if (i === 0) { c.font = { bold: true, size: 14, color: { argb: NAVY } }; p.getRow(1).height = 26 }
      else if (/^[A-Z ()/&-]{4,}$/.test(line) || line.endsWith(':')) c.font = { bold: true, color: { argb: NAVY } }
    })
    // Petunjuk setelah data agar lembar pertama = lembar data
    wb.worksheets.sort((a, b) => (a.name === 'Petunjuk') - (b.name === 'Petunjuk'))
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export function sendBuffer(res, buf, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
  res.send(buf)
}

export function sendCsv(res, columns, rows, filename) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [columns.map((c) => c.header).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
  res.send(csv)
}
