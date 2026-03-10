import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Integrations from './pages/Integrations'
import Chat from './pages/Chat'
import StravaCallback from './pages/StravaCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/integrations" replace />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/strava/callback" element={<StravaCallback />} />
      </Routes>
    </BrowserRouter>
  )
}
