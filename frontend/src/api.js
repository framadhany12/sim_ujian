const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000')

export const getToken = () => localStorage.getItem('token')
export const setToken = (t) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'))

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + '/api' + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) {
    if (res.status === 401 && getToken()) { setToken(null); location.href = '/login' }
    throw Object.assign(new Error(data?.message || 'Terjadi kesalahan'), { status: res.status, data })
  }
  return data
}

// Unduh berkas (xlsx/csv) dengan header Authorization
export async function download(path, filename) {
  const res = await fetch(BASE + '/api' + path, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error('Gagal mengunduh')
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export const API_BASE = BASE
