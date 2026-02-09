import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Profiles from './screens/Profiles'
import Verify from './screens/Verify'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/" element={<Navigate to="/profiles" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
