import { Link, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { ConfigMissingScreen, ForgotPasswordPage, LoginPage, RecoveryRedirect, ResetPasswordPage } from './pages/AuthPages'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { configMissing } from './lib/supabase'

function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md px-4 text-center">
      <h1 className="mb-2 text-xl font-bold">Página no encontrada</h1>
      <p className="mb-4 text-sm text-slate-500">La dirección no existe o fue movida.</p>
      <Link to="/" className="btn-primary">Ir al inicio</Link>
    </div>
  )
}

export default function App() {
  if (configMissing) return <ConfigMissingScreen />
  return (
    <>
      <RecoveryRedirect />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar" element={<ForgotPasswordPage />} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route element={<ProtectedRoute module="usuarios" />}>
              <Route path="usuarios" element={<UsersPage />} />
            </Route>
            <Route element={<ProtectedRoute module="configuracion" />}>
              <Route path="configuracion" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
