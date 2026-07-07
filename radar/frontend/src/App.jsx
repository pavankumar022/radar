import { Routes, Route, Navigate } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Incidents from './pages/Incidents'
import LogArchive from './pages/LogArchive'
import ReplayMode from './pages/ReplayMode'
import Settings from './pages/Settings'

export default function App() {
  return (
    <StoreProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:alertId" element={<Incidents />} />
          <Route path="/logs" element={<LogArchive />} />
          <Route path="/replay" element={<ReplayMode />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </StoreProvider>
  )
}
