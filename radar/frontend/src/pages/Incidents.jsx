/**
 * Incidents / Playbooks Page
 * Shows incident list + AI playbook detail view.
 * Matches the provided design screenshot.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { SeverityChip, TechniqueBadge, Skeleton, EmptyState } from '../components/ui'

function formatTime(ts) {
  try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false }) } catch { return '??' }
}

// ─── Incident List (sidebar) ──────────────────────────────────────────────────
function IncidentList({ onSelect, selectedId, active, onClearAll }) {
  const { state } = useStore()
  const incidents = state.alerts.filter(a => a.severity === 'critical' || a.severity === 'warning')
  const displayedAlerts = incidents.length > 0 ? incidents.slice(0, 50) : state.alerts.slice(0, 50)

  return (
    <div className={`w-full md:w-72 shrink-0 flex flex-col h-full border-r border-primary/10 ${active ? 'hidden md:flex' : 'flex'}`}>
      <div className="card-header shrink-0 flex justify-between items-center w-full">
        <div>
          <h2 className="font-semibold text-sm text-on-surface">Incidents</h2>
          <span className="mono-label text-critical">{displayedAlerts.length} ACTIVE</span>
        </div>
        <button
          onClick={onClearAll}
          className="px-2 py-1 bg-critical/15 text-critical border border-critical/30 rounded hover:bg-critical/25 transition-all text-[10px] font-mono tracking-wider font-bold"
          id="clear-all-incidents-btn"
        >
          CLEAR ALL
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-surface-high">
        {displayedAlerts.length === 0 ? (
          <EmptyState icon="🔒" message="NO INCIDENTS" />
        ) : (
          displayedAlerts.map(ev => (
            <div
              key={ev.id}
              onClick={() => onSelect(ev)}
              className={`p-3 cursor-pointer transition-colors hover:bg-surface-high ${
                selectedId === ev.id ? 'bg-surface-high border-l-2 border-l-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <SeverityChip severity={ev.severity} />
                <span className="mono-data text-xs text-on-surface-variant">{formatTime(ev.timestamp)}</span>
              </div>
              <p className="font-mono text-xs font-bold text-on-surface">{ev.event_type}</p>
              <p className="mono-data text-xs text-primary truncate">Src: {ev.source_ip}</p>
              {ev.technique_id && <TechniqueBadge id={ev.technique_id} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Playbook Detail ──────────────────────────────────────────────────────────
function PlaybookDetail({ alert, playbook, loading, onGenerate, onBack, active }) {
  const [steps, setSteps] = useState([])

  useEffect(() => {
    if (playbook?.containment_steps) {
      setSteps(playbook.containment_steps.map((s, i) => ({ id: i, text: s, done: false })))
    }
  }, [playbook])

  if (!alert) {
    return (
      <div className={`flex-1 md:flex items-center justify-center ${active ? 'flex' : 'hidden'}`}>
        <EmptyState icon="👈" message="SELECT AN INCIDENT" />
      </div>
    )
  }

  return (
    <div className={`flex-1 flex flex-col h-full min-w-0 ${active ? 'flex' : 'hidden md:flex'}`}>
      {/* Mobile Back Button */}
      <div className="md:hidden px-4 py-2 border-b border-primary/10 bg-surface-lowest flex items-center shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-primary py-1 px-2.5 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20"
        >
          ← Back to Incidents
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Alert header */}
        <div className="card p-4 md:p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <SeverityChip severity={alert.severity} />
              <h2 className="text-base md:text-lg font-semibold text-on-surface truncate">
                {alert.event_type?.replace('_', ' ')} Detected
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <TechniqueBadge id={alert.technique_id} />
              <span className="mono-data text-on-surface-variant text-xs">{formatTime(alert.timestamp)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mono-label mb-1">SOURCE IP</p>
              <p className="mono-data text-primary text-xs md:text-sm">{alert.source_ip}</p>
            </div>
            <div>
              <p className="mono-label mb-1">INCIDENT ID</p>
              <p className="mono-data text-on-surface text-xs md:text-sm">RAD-{alert.id?.slice(0, 6).toUpperCase()}</p>
            </div>
          </div>

          {/* Generate / Generated indicator */}
          <div className="mt-4 flex justify-end">
            {playbook ? (
              <span className="chip-success">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Generated by {playbook.provider === 'gemini' ? 'Gemini 2.0 Flash' : playbook.provider}
              </span>
            ) : (
              <button
                onClick={onGenerate}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
                id="generate-playbook-btn"
              >
                {loading ? (
                  <><span className="animate-spin">⚡</span> Generating...</>
                ) : (
                  <><span>⚡</span> Generate AI Playbook</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Playbook content */}
        {playbook && (
          <div className="space-y-4">
            {/* 1. Situation Summary */}
            <div className="card p-4 md:p-5">
              <h3 className="mono-label text-primary mb-3">1. Situation Summary</h3>
              <p className="text-on-surface text-sm leading-relaxed">{playbook.situation_summary}</p>
            </div>

            {/* 2. Likely Technique */}
            <div className="card p-4 md:p-5">
              <h3 className="mono-label text-primary mb-3">2. Likely Technique</h3>
              <p className="font-semibold text-on-surface mb-1">{playbook.likely_technique}</p>
              <p className="text-sm text-on-surface-variant">{alert.description}</p>
            </div>

            {/* 3. Containment Steps */}
            {steps.length > 0 && (
              <div className="card p-4 md:p-5">
                <h3 className="mono-label text-primary mb-3">3. Immediate Containment Steps</h3>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={() => setSteps(s => s.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
                        className="mt-0.5 w-4 h-4 rounded border-outline/30 bg-surface-high accent-secondary cursor-pointer"
                        id={`step-${i}`}
                      />
                      <label htmlFor={`step-${i}`} className={`mono-data text-sm cursor-pointer flex-1 ${step.done ? 'line-through text-outline' : 'text-on-surface'}`}>
                        {step.text}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Remediation Commands */}
            {playbook.remediation_commands && (
              <div className="card p-4 md:p-5">
                <h3 className="mono-label text-primary mb-3">4. Recommended Remediation</h3>
                <div className="bg-surface-lowest rounded border border-outline/20 p-3 overflow-x-auto">
                  <pre className="mono-data text-xs text-secondary whitespace-pre-wrap">
                    {playbook.remediation_commands}
                  </pre>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button className="btn-danger text-xs md:text-sm">Escalate</button>
              <button className="btn-success flex items-center gap-2 text-xs md:text-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Mark as Resolved
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Incidents() {
  const { alertId } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()

  const [selectedAlert, setSelectedAlert] = useState(null)
  const [playbook, setPlaybook] = useState(null)
  const [loadingPlaybook, setLoadingPlaybook] = useState(false)

  // Ensure latest alerts are loaded if state.alerts is empty
  useEffect(() => {
    if (state.alerts.length === 0) {
      api.alerts.latest(50)
        .then(data => {
          if (data?.events && Array.isArray(data.events)) {
            [...data.events].reverse().forEach(ev => {
              dispatch({ type: 'NEW_ALERT', payload: { event: ev } })
            })
          }
        })
        .catch(() => {})
    }
  }, [state.alerts.length, dispatch])

  // If alertId in URL, auto-select that alert
  useEffect(() => {
    if (alertId) {
      const found = state.alerts.find(a => a.id === alertId)
      if (found) {
        setSelectedAlert(found)
        // Try to load existing playbook
        api.playbook.get(alertId).then(setPlaybook).catch(() => {})
      }
    }
  }, [alertId, state.alerts])

  const handleSelect = (ev) => {
    setSelectedAlert(ev)
    setPlaybook(null)
    navigate(`/incidents/${ev.id}`)
    api.playbook.get(ev.id).then(setPlaybook).catch(() => {})
  }

  const handleBack = () => {
    setSelectedAlert(null)
    setPlaybook(null)
    navigate('/incidents')
  }

  const handleGenerate = async () => {
    if (!selectedAlert) return
    setLoadingPlaybook(true)
    try {
      const pb = await api.playbook.generate(selectedAlert.id)
      setPlaybook(pb)
    } catch (e) {
      console.error('Playbook gen failed:', e)
    } finally {
      setLoadingPlaybook(false)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all incidents and alerts? This will also stop replay and clear the log archive.")) return
    try {
      await api.logs.clear()
      setSelectedAlert(null)
      setPlaybook(null)
      navigate('/incidents')
    } catch (e) {
      console.error('Failed to clear incidents:', e)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <IncidentList onSelect={handleSelect} selectedId={selectedAlert?.id} active={!!selectedAlert} onClearAll={handleClearAll} />
      <PlaybookDetail
        alert={selectedAlert}
        playbook={playbook}
        loading={loadingPlaybook}
        onGenerate={handleGenerate}
        onBack={handleBack}
        active={!!selectedAlert}
      />
    </div>
  )
}
