import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { ConfirmHost } from './components/Confirm.jsx'
import { AuthProvider, Protected } from './auth.jsx'
import PesertaLayout from './components/PesertaLayout.jsx'
import TataTertib from './pages/TataTertib.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Jadwal from './pages/Jadwal.jsx'
import Hasil from './pages/Hasil.jsx'
import ExamPage from './pages/ExamPage.jsx'
import Peserta from './pages/admin/Peserta.jsx'
import Ujian from './pages/admin/Ujian.jsx'
import Soal from './pages/admin/Soal.jsx'
import Grup from './pages/admin/Grup.jsx'
import SusunSoal from './pages/admin/SusunSoal.jsx'
import Token from './pages/admin/Token.jsx'
import Monitor from './pages/admin/Monitor.jsx'
import Nilai from './pages/admin/Nilai.jsx'
import Admins from './pages/admin/Admins.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ganti-password" element={<Protected allowMustChange><ChangePassword /></Protected>} />

          <Route element={<Protected role="peserta"><PesertaLayout /></Protected>}>
            <Route path="/jadwal" element={<Jadwal />} />
            <Route path="/hasil" element={<Hasil />} />
            <Route path="/hasil/:examId" element={<Hasil />} />
            <Route path="/tata-tertib" element={<TataTertib />} />
          </Route>
          <Route path="/ujian/:attemptId" element={<Protected role="peserta"><ExamPage /></Protected>} />

          <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="peserta" element={<Peserta />} />
            <Route path="ujian" element={<Ujian />} />
            <Route path="ujian/:id/soal" element={<SusunSoal />} />
            <Route path="soal" element={<Soal />} />
            <Route path="grup" element={<Grup />} />
            <Route path="admin" element={<Admins />} />
            <Route path="token" element={<Token />} />
            <Route path="monitor" element={<Monitor />} />
            <Route path="nilai" element={<Nilai />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
      <ConfirmHost />
    </BrowserRouter>
  </StrictMode>,
)
