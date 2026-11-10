import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { useAuth } from './app/AuthContext'
import { RequireAuth, RequireRole } from './app/guards'
import { AuthPage } from './features/auth/AuthPage'
import { ClinicPage } from './features/manager/ClinicPage'
import { ManagerHome } from './features/manager/ManagerHome'
import { ProfessionalsPage } from './features/manager/ProfessionalsPage'
import { AppointmentsPage } from './features/patient/AppointmentsPage'
import { PatientHome } from './features/patient/PatientHome'
import { SearchPage } from './features/patient/SearchPage'
import { AgendaPage } from './features/professional/AgendaPage'
import { ProfessionalHome } from './features/professional/ProfessionalHome'
import { ProfilePage } from './features/shared/ProfilePage'
import { RecordsPage } from './features/shared/RecordsPage'

function HomeByRole() {
  const { user } = useAuth()
  if (user?.role === 'professional') return <ProfessionalHome />
  if (user?.role === 'manager') return <ManagerHome />
  return <PatientHome />
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeByRole />} />
          <Route path="perfil" element={<ProfilePage />} />

          <Route
            path="buscar"
            element={
              <RequireRole role="patient">
                <SearchPage />
              </RequireRole>
            }
          />
          <Route
            path="consultas"
            element={
              <RequireRole role="patient">
                <AppointmentsPage />
              </RequireRole>
            }
          />
          <Route
            path="prontuario"
            element={
              <RequireRole role="patient">
                <RecordsPage />
              </RequireRole>
            }
          />

          <Route
            path="agenda"
            element={
              <RequireRole role="professional">
                <AgendaPage />
              </RequireRole>
            }
          />
          <Route
            path="prontuarios"
            element={
              <RequireRole role="professional">
                <RecordsPage />
              </RequireRole>
            }
          />

          <Route
            path="clinica"
            element={
              <RequireRole role="manager">
                <ClinicPage />
              </RequireRole>
            }
          />
          <Route
            path="profissionais"
            element={
              <RequireRole role="manager">
                <ProfessionalsPage />
              </RequireRole>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<AuthPage />} />
    </Routes>
  )
}
