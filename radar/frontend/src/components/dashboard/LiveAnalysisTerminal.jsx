/**
 * Live Analysis Terminal Component
 * Real-time network packet capture & attack verification feed.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { useStore } from '../../lib/store'

export default function LiveAnalysisTerminal() {
  const { state } = useStore()
  const [isRunning, setIsRunning] = useState(false)
  const [pid, setPid] = useState(null)
  const [liveAlertCount, setLiveAlertCount] = useState(0)
  const [lastIp, setLastIp] = useState('—')
  const [logs, setLogs] = useState([
    { id: 1, text: '[SYSTEM] Live capture inactive. Press START LIVE to begin.', color: 'text-outline' }
  ])
  const [loading, setLoading] = useState(false)
  const feedRef = useRef(null)

  // Poll live status on mount and periodically when running
  const checkStatus = useCallback(async () => {
    try {
      const data = await api.live.status()
      setIsRunning(data.is_running)
      if (data.pid) setPid(data.pid)
      if (data.live_alerts !== undefined) setLiveAlertCount(data.live_alerts)
      if (data.last_alert?.source_ip) setLastIp(data.last_alert.source_ip)
    } catch (e) {
      // ignore offline errors
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const timer = setInterval(checkStatus, 3000)
    return () => clearInterval(timer)
  }, [checkStatus])

  // Listen to new alerts arriving in global store
  useEffect(() => {
    if (state.alerts.length > 0) {
      const latest = state.alerts[0]
      if (latest.source === 'live_capture' || latest.raw_payload?.sniffer) {
        setLiveAlertCount(prev => prev + 1)
        if (latest.source_ip) setLastIp(latest.source_ip)

        const time = new Date(latest.timestamp || Date.now()).toLocaleTimeString()
        const sev = (latest.severity || 'info').toUpperCase()
        const color =
          latest.severity === 'critical'
            ? 'text-critical font-bold'
            : latest.severity === 'warning'
            ? 'text-warning'
            : 'text-secondary'

        const logText = `[${time}] ${sev} — ${latest.event_type} — Src: ${latest.source_ip} — ${latest.description || 'Live network packet captured'}`

        setLogs(prev => [...prev.slice(-199), { id: Date.now() + Math.random(), text: logText, color }])
      }
    }
  }, [state.alerts])

  // Auto-scroll terminal
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [logs])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await api.live.start()
      if (res.status === 'started' || res.status === 'already_running') {
        setIsRunning(true)
        setPid(res.pid || null)
        const time = new Date().toLocaleTimeString()
        setLogs(prev => [
          ...prev,
          { id: Date.now(), text: `[${time}] [SYSTEM] Live capture started. PID: ${res.pid || 'Active'}`, color: 'text-secondary' },
          { id: Date.now() + 1, text: `[${time}] [SYSTEM] Monitoring ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3389 (RDP), 445 (SMB), 8080`, color: 'text-on-surface-variant' }
        ])
      } else if (res.status === 'error') {
        setLogs(prev => [...prev, { id: Date.now(), text: `[ERROR] ${res.message}`, color: 'text-critical' }])
      }
    } catch (e) {
      setLogs(prev => [...prev, { id: Date.now(), text: `[ERROR] Failed to start live capture: ${e.message}`, color: 'text-critical' }])
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await api.live.stop()
      setIsRunning(false)
      setPid(null)
      const time = new Date().toLocaleTimeString()
      setLogs(prev => [...prev, { id: Date.now(), text: `[${time}] [SYSTEM] Live network capture stopped.`, color: 'text-outline' }])
    } catch (e) {
      console.error('Stop failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 border border-primary/20 bg-surface-lowest space-y-4 fade-in" id="live-analysis-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              isRunning ? 'bg-secondary pulse-dot shadow-glow-sm' : 'bg-outline/40'
            }`}
            id="live-indicator"
          />
          <div>
            <h3 className="font-mono-label text-xs uppercase tracking-widest text-on-surface font-bold">
              LIVE NETWORK CAPTURE TERMINAL
            </h3>
            <p className="text-[11px] text-on-surface-variant">Real-time packet sniffer capturing live network attacks (Ports 22, 80, 443, 3389, 445, 8080)</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-4 py-2 rounded bg-secondary/20 text-secondary border border-secondary/40 hover:bg-secondary/30 transition-all mono-data text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              id="live-start-btn"
            >
              {loading ? 'STARTING...' : '⚡ START LIVE'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="px-4 py-2 rounded bg-critical/20 text-critical border border-critical/40 hover:bg-critical/30 transition-all mono-data text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              id="live-stop-btn"
            >
              {loading ? 'STOPPING...' : '■ STOP'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-low p-3 rounded border border-outline/10 text-center">
          <p className="mono-label text-[9px] text-on-surface-variant uppercase">Live Alerts</p>
          <p className="mono-data text-lg font-black text-secondary" id="live-alert-count">
            {liveAlertCount}
          </p>
        </div>
        <div className="bg-surface-low p-3 rounded border border-outline/10 text-center min-w-0">
          <p className="mono-label text-[9px] text-on-surface-variant uppercase">Last Attacker IP</p>
          <p className="mono-data text-xs text-primary truncate font-bold" id="live-last-ip">
            {lastIp}
          </p>
        </div>
        <div className="bg-surface-low p-3 rounded border border-outline/10 text-center">
          <p className="mono-label text-[9px] text-on-surface-variant uppercase">Status</p>
          <p
            className={`mono-data text-xs font-bold uppercase ${
              isRunning ? 'text-secondary' : 'text-outline'
            }`}
            id="live-status-text"
          >
            {isRunning ? `ACTIVE (PID ${pid || 'OK'})` : 'STANDBY'}
          </p>
        </div>
      </div>

      {/* Live alert feed */}
      <div
        ref={feedRef}
        id="live-feed"
        className="bg-surface-lowest border border-outline/20 p-4 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 rounded"
      >
        {logs.map(logItem => (
          <p key={logItem.id} className={logItem.color}>
            {logItem.text}
          </p>
        ))}
      </div>
    </div>
  )
}
