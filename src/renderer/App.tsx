import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Profiles from './screens/Profiles'
import Verify from './screens/Verify'
import Settings from './screens/Settings'
import { useTheme } from './useTheme'
import { ThemeContext } from './ThemeContext'

function App() {
  const themeValue = useTheme()

  return (
    <ThemeContext.Provider value={themeValue}>
      <HashRouter>
        <div className="app-shell">
          {/* ── Top nav bar ── */}
          <nav className="nav-bar">
            <span className="nav-bar__logo">⬡ GIT SWITCHER</span>
            <NavLink
              to="/profiles"
              className={({ isActive }) =>
                `nav-bar__link${isActive ? ' nav-bar__link--active' : ''}`
              }
            >
              ♦ Profiles
            </NavLink>
            <NavLink
              to="/verify"
              className={({ isActive }) =>
                `nav-bar__link${isActive ? ' nav-bar__link--active' : ''}`
              }
            >
              ♦ Verify
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-bar__link${isActive ? ' nav-bar__link--active' : ''}`
              }
            >
              ♦ Settings
            </NavLink>
          </nav>

          {/* ── Page content ── */}
          <div className="main-content">
            <Routes>
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/profiles" replace />} />
            </Routes>
          </div>
        </div>
      </HashRouter>
    </ThemeContext.Provider>
  )
}

export default App
