import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { useState } from 'react'

const FEED_STATE_LABELS = {
  LOADING_SYNTHETIC: { label: 'LOADING SYNTHETIC', color: 'text-warning' },
  SYNTHETIC_FEED: { label: 'SYNTHETIC FEED', color: 'text-primary' },
  LIVE_FEED_ACTIVE: { label: 'LIVE FEED ACTIVE', color: 'text-secondary' },
  SYSTEM_STANDBY: { label: 'SYSTEM STANDBY', color: 'text-outline' },
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/incidents', label: 'Incidents' },
  { path: '/logs', label: 'Log Archive' },
  { path: '/replay', label: 'Replay' },
  { path: '/settings', label: 'Settings' },
]

export default function Topbar() {
  const { state, dispatch } = useStore()
  const [shieldLoading, setShieldLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const feedInfo = FEED_STATE_LABELS[state.feedState] ?? FEED_STATE_LABELS.LOADING_SYNTHETIC
  const isLive = state.feedState === 'LIVE_FEED_ACTIVE' || state.feedState === 'SYNTHETIC_FEED'

  const handleShieldToggle = async () => {
    setShieldLoading(true)
    try {
      const result = await api.settings.shield(!state.monitoringActive)
      dispatch({
        type: 'STATUS_UPDATE',
        payload: {
          monitoring_active: result.monitoring_active,
          feed_state: result.feed_state,
        },
      })
    } catch (e) {
      console.error('Shield toggle failed:', e)
    } finally {
      setShieldLoading(false)
    }
  }

  return (
    <header className="relative border-b border-primary/10 bg-surface-lowest shrink-0 z-50">
      <div className="flex items-center justify-between h-14 px-4 md:px-6">
        {/* Brand & Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-high rounded"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-on-surface font-bold text-xl tracking-wider hover:text-primary transition-colors"
          >
            RADAR
          </button>
        </div>

        {/* Feed status indicator (Desktop only) */}
        <div className="hidden sm:flex items-center gap-2">
          <span className={`pulse-dot ${isLive ? 'bg-secondary text-secondary' : 'bg-warning text-warning'}`} />
          <span className={`mono-label text-xs ${feedInfo.color}`}>{feedInfo.label}</span>
        </div>

        {/* Nav (Desktop only) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-primary bg-primary/10 border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* EPS indicator (Desktop only) */}
          <div className="hidden xs:flex items-center gap-1.5 text-xs">
            <span className="mono-label">EPS</span>
            <span className="mono-data text-primary font-bold">
              {state.stats.events_per_sec ?? 0}
            </span>
          </div>

          {/* WS connection badge */}
          <div className={`w-2 h-2 rounded-full ${state.wsConnected ? 'bg-secondary shadow-glow-success' : 'bg-critical animate-pulse'}`}
               title={state.wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'} />

          {/* Deploy Shield toggle */}
          <button
            onClick={handleShieldToggle}
            disabled={shieldLoading}
            className={`flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 rounded border text-xs md:text-sm font-semibold transition-all duration-200 ${
              state.monitoringActive
                ? 'bg-secondary/15 border-secondary/40 text-secondary hover:bg-secondary/25'
                : 'bg-critical/15 border-critical/40 text-critical hover:bg-critical/25'
            }`}
            id="deploy-shield-toggle"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            <span className="hidden sm:inline">{shieldLoading ? '...' : state.monitoringActive ? 'SHIELD ON' : 'SHIELD OFF'}</span>
            <span className="sm:hidden">{shieldLoading ? '...' : state.monitoringActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Settings icon */}
          <NavLink to="/settings" className="p-2 rounded hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </NavLink>
        </div>
      </div>

      {/* Mobile navigation menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-primary/10 bg-surface-lowest py-2 px-4 space-y-1 fade-in">
          {NAV_ITEMS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          {/* Feed status mobile indicator */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-primary/10 mt-1">
            <span className={`pulse-dot ${isLive ? 'bg-secondary text-secondary' : 'bg-warning text-warning'}`} />
            <span className={`mono-label text-xs ${feedInfo.color}`}>{feedInfo.label}</span>
          </div>
        </div>
      )}
    </header>
  )
}
