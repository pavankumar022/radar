/**
 * Autonomous Loop Stage Indicator
 * Shows current stage of the Red/Blue agent loop: Scan→Attack→Detect→Remediate→Re-test
 * State driven from WebSocket loop_stage messages.
 */
import { useStore } from '../../lib/store'

const STAGES = ['SCAN', 'ATTACK', 'DETECT', 'REMEDIATE', 'RETEST']

const STAGE_ICONS = {
  SCAN: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
    </svg>
  ),
  ATTACK: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  DETECT: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  REMEDIATE: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  RETEST: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
}

export default function AutonomousLoopStatus() {
  const { state } = useStore()
  const { loopStage, loopDetail } = state

  // Map current stage to index (IDLE shows no active stage)
  const activeIdx = loopStage === 'IDLE' ? -1 : STAGES.indexOf(loopStage)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="mono-label">Autonomous Loop</p>
        <span className={`mono-label text-xs px-2 py-0.5 rounded-full ${
          loopStage === 'IDLE' ? 'bg-outline/10 text-outline' : 'bg-secondary/10 text-secondary'
        }`}>
          {loopStage === 'IDLE' ? 'STANDBY' : 'ACTIVE'}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {STAGES.map((stage, i) => {
          const isActive = i === activeIdx
          const isPast = i < activeIdx
          return (
            <div
              key={stage}
              className={`flex flex-col items-center gap-1 p-1.5 rounded transition-all duration-300 ${
                isActive
                  ? 'bg-primary/15 border border-primary/30 text-primary shadow-glow-sm'
                  : isPast
                  ? 'text-secondary/60'
                  : 'text-on-surface-variant/40'
              }`}
            >
              <div className={isActive ? 'animate-pulse' : ''}>
                {STAGE_ICONS[stage]}
              </div>
              <span className="mono-label text-[8px] tracking-tighter text-center block w-full truncate">{stage}</span>
            </div>
          )
        })}
      </div>

      {loopDetail && (
        <p className="mt-2 text-xs text-on-surface-variant truncate mono-data">{loopDetail}</p>
      )}
    </div>
  )
}
