/**
 * MITRE ATT&CK Coverage Matrix
 * Live tile states derived from actual events in the DB — not hardcoded.
 * 5 tactics: Initial Access, Execution, Persistence, Discovery, Defense Evasion
 */
import { useStore } from '../../lib/store'

const DISPLAY_TACTICS = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Discovery',
  'Defense Evasion',
]

const TILE_STYLES = {
  exploited: 'bg-critical/20 border-critical/40 text-critical hover:bg-critical/30',
  mitigated: 'bg-secondary/15 border-secondary/30 text-secondary hover:bg-secondary/25',
  untested:  'bg-surface-high border-outline/20 text-on-surface-variant hover:bg-surface-highest',
}

const TILE_DOT = {
  exploited: 'bg-critical',
  mitigated: 'bg-secondary',
  untested:  'bg-outline',
}

function Tile({ technique }) {
  const style = TILE_STYLES[technique.state] ?? TILE_STYLES.untested
  const dot = TILE_DOT[technique.state] ?? TILE_DOT.untested
  return (
    <div
      className={`relative group px-2 py-1.5 rounded border text-xs font-mono cursor-default transition-all duration-200 ${style}`}
      title={`${technique.technique_id} — ${technique.state}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="truncate leading-tight">{technique.name}</span>
      </div>
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-surface-highest border border-outline/30 rounded text-xs text-on-surface whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
        {technique.technique_id} · {technique.state.toUpperCase()}
      </div>
    </div>
  )
}

export default function MitreMatrix() {
  const { state } = useStore()
  const { mitreTactics } = state

  const exploitedCount = Object.values(mitreTactics)
    .flat().filter(t => t.state === 'exploited').length
  const mitigatedCount = Object.values(mitreTactics)
    .flat().filter(t => t.state === 'mitigated').length

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-on-surface">MITRE ATT&amp;CK® Coverage</h3>
          <span className="mono-label text-outline">v13.1 Matrix</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-critical" />
            <span className="mono-label text-on-surface-variant">Exploited ({exploitedCount})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="mono-label text-on-surface-variant">Covered ({mitigatedCount})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-outline" />
            <span className="mono-label text-on-surface-variant">Unmapped</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-3">
        <div className="grid grid-cols-5 gap-3 min-w-[800px]">
          {DISPLAY_TACTICS.map(tactic => {
            const techniques = mitreTactics[tactic] ?? []
            return (
              <div key={tactic} className="flex flex-col gap-1.5">
                <p className="mono-label text-primary mb-1">{tactic}</p>
                {techniques.length === 0 ? (
                  <div className="px-2 py-1.5 rounded border border-outline/10 text-xs text-outline mono-data">
                    Loading...
                  </div>
                ) : (
                  techniques.map(t => <Tile key={t.technique_id} technique={t} />)
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
