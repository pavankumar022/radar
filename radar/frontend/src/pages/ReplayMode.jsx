/**
 * Replay Mode Page
 * Controls the replay engine — play/pause/seek, speed selector, incident feed.
 * Matches the provided design screenshot.
 */
import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import { SeverityChip } from '../components/ui'

const SPEED_OPTIONS = [0.5, 1.0, 64.0, 500]
const SPEED_LABELS = ['0.5X', '1.0X', '64.0X', 'MAX']

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ReplayMode() {
  const { state } = useStore()
  const [replayStatus, setReplayStatus] = useState({ active: false, speed_multiplier: 1, current_index: 0, total_events: 0, elapsed_seconds: 0, buffer_percent: 0 })
  const [selectedSpeed, setSelectedSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  const pollStatus = async () => {
    try {
      const s = await api.replay.status()
      setReplayStatus(s)
    } catch {}
  }

  useEffect(() => {
    pollStatus()
    pollRef.current = setInterval(pollStatus, 2000)
    return () => clearInterval(pollRef.current)
  }, [])

  const handleStart = async () => {
    setLoading(true)
    try {
      const speed = selectedSpeed === 500 ? 500 : selectedSpeed
      await api.replay.start(speed)
      await pollStatus()
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await api.replay.stop()
      await pollStatus()
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all events? This will stop replay and clear the log archive.")) return
    try {
      await api.logs.clear()
      setReplayStatus({
        active: false,
        speed_multiplier: 1.0,
        current_index: 0,
        total_events: 0,
        elapsed_seconds: 0,
        buffer_percent: 0
      })
    } catch (e) {
      console.error('Failed to clear events:', e)
    }
  }

  const progressPct = replayStatus.total_events > 0
    ? (replayStatus.current_index / replayStatus.total_events) * 100
    : 0

  // Use live alerts as the replay incident feed
  const feedAlerts = state.alerts.slice(0, 15)

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto lg:overflow-hidden dot-grid">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`mono-label text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
            replayStatus.active ? 'bg-secondary/15 text-secondary' : 'bg-outline/10 text-outline'
          }`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            {replayStatus.active ? 'PLAYBACK MODE ACTIVE' : 'PLAYBACK MODE READY'}
          </span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold tracking-wider text-on-surface uppercase">System Incident Replay</h1>
        <p className="mono-data text-on-surface-variant text-xs md:text-sm mt-1">
          Visualizing threat propagation and response sequences.{' '}
          {replayStatus.active && (
            <span>Analyzing <span className="text-primary">{replayStatus.current_index.toLocaleString()}</span> events per second.</span>
          )}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Main replay viewport */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="card flex-1 flex flex-col p-3 md:p-4 gap-4 min-h-[350px] lg:min-h-0">
            {/* Top bar */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="mono-data text-xs bg-surface-high px-2 py-1 rounded border border-outline/20">
                  RECORDING: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </span>
                <span className={`mono-data text-xs px-2 py-1 rounded border ${replayStatus.active ? 'text-primary border-primary/30 bg-primary/10' : 'text-outline border-outline/20 bg-surface-high'}`}>
                  REPLAY SPEED: {replayStatus.speed_multiplier}X
                </span>
              </div>
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1 bg-critical/15 text-critical border border-critical/30 rounded hover:bg-critical/25 transition-all text-xs font-mono font-bold"
                id="clear-all-replay-btn"
              >
                CLEAR ALL EVENTS
              </button>
            </div>

            {/* Visualization area */}
            <div className="flex-1 bg-surface-lowest rounded border border-outline/10 relative overflow-hidden min-h-0">
              <div className="absolute inset-0 dot-grid" />
              <div className="absolute inset-0 flex items-end p-4">
                <div className="space-y-1">
                  <div>
                    <p className="mono-label text-xs text-outline">SOURCE IP</p>
                    <p className="mono-data text-primary">{feedAlerts[0]?.source_ip ?? '—'}</p>
                  </div>
                  <div>
                    <p className="mono-label text-xs text-outline">TARGET</p>
                    <p className="mono-data text-secondary">{feedAlerts[0]?.destination_ip ?? 'US-EAST-01.PROD'}</p>
                  </div>
                </div>
              </div>
              {!replayStatus.active && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="mono-label text-outline">PRESS PLAY TO START REPLAY</p>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="mono-label text-xs text-outline mb-0.5">REPLAY PROGRESS</p>
                  <p className="mono-data text-xl text-on-surface font-bold">
                    {formatTime(replayStatus.elapsed_seconds)} / {formatTime(replayStatus.total_events / 10)}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {}}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-high text-on-surface-variant"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={replayStatus.active ? handleStop : handleStart}
                    disabled={loading}
                    className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/50 text-primary flex items-center justify-center hover:bg-primary/30 transition-all disabled:opacity-50"
                    id="replay-play-pause"
                  >
                    {replayStatus.active ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => {}}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-high text-on-surface-variant"
                  >
                    ⏭
                  </button>
                </div>

                <div className="text-right">
                  <p className="mono-label text-xs text-outline mb-0.5">BUFFER STATUS</p>
                  <p className={`mono-data font-bold ${replayStatus.active ? 'text-secondary' : 'text-outline'}`}>
                    {replayStatus.active ? `READY — ${replayStatus.buffer_percent.toFixed(0)}%` : 'STANDBY'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-surface-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                {['INITIAL BREACH', 'LATERAL MOVEMENT', 'EXFILTRATION START', 'RECOVERY ACTION'].map(label => (
                  <span key={label} className="mono-label text-[9px] text-outline">{label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Speed selector */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            {SPEED_OPTIONS.map((speed, i) => (
              <button
                key={speed}
                onClick={() => setSelectedSpeed(speed)}
                disabled={replayStatus.active}
                className={`py-3 rounded border font-mono font-bold text-sm transition-all ${
                  selectedSpeed === speed
                    ? 'bg-primary/20 border-primary/50 text-primary shadow-glow-sm'
                    : 'bg-surface-base border-outline/20 text-on-surface-variant hover:border-outline/40'
                } disabled:opacity-50`}
                id={`speed-${SPEED_LABELS[i].toLowerCase()}`}
              >
                {SPEED_LABELS[i]}
              </button>
            ))}
          </div>
        </div>

        {/* Incident feed sidebar */}
        <div className="w-full lg:w-72 shrink-0 card flex flex-col h-[300px] lg:h-auto min-h-0 mb-4 lg:mb-0">
          <div className="card-header shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${replayStatus.active ? 'bg-secondary pulse-dot' : 'bg-outline'}`} />
              <h3 className="mono-label text-on-surface-variant">Incident Feed</h3>
            </div>
            <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>
              <line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>
            </svg>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-surface-high">
            {feedAlerts.map(ev => (
              <div key={ev.id} className={`px-3 py-2.5 border-l-2 ${
                ev.severity === 'critical' ? 'border-l-critical' :
                ev.severity === 'warning' ? 'border-l-warning' : 'border-l-primary'
              }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`mono-data text-xs font-bold ${
                    ev.severity === 'critical' ? 'text-critical' :
                    ev.severity === 'warning' ? 'text-warning' : 'text-primary'
                  }`}>{ev.event_type?.replace('_', ' ')}</span>
                  <span className="mono-data text-xs text-outline">
                    {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <p className="mono-data text-xs text-on-surface-variant truncate">{ev.description?.slice(0, 50)}</p>
              </div>
            ))}
          </div>

          {/* Threat probability */}
          <div className="p-3 border-t border-primary/10 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <p className="mono-label text-xs text-outline">Threat Probability</p>
              <span className="mono-data font-bold text-critical text-sm">
                {replayStatus.active ? '98.4%' : '—'}
              </span>
            </div>
            {replayStatus.active && (
              <div className="h-1 bg-surface-high rounded overflow-hidden">
                <div className="h-full bg-critical rounded w-[98.4%]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-6 py-2 border-t border-primary/10 shrink-0">
        <span className="flex items-center gap-1.5 mono-label text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          ANALYZER: CONNECTED
        </span>
        <span className="mono-label text-on-surface-variant">RENDER: 60 FPS</span>
        <span className="mono-label text-primary">CPU: 14%</span>
        <div className="flex-1" />
        <span className="mono-label text-outline">SEC-ZONE: BLACK-DELTA</span>
        <span className="mono-label text-outline">TS: {new Date().toISOString()}</span>
      </div>
    </div>
  )
}
