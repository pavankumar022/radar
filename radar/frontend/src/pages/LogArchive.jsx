/**
 * Log Archive Page
 * Paginated, filterable table of 5,000+ events.
 * Uses virtualization for performance.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { SeverityChip, TechniqueBadge, Skeleton } from '../components/ui'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 50

function formatTs(ts) {
  try { return new Date(ts).toLocaleString('en-US', { hour12: false, month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return ts }
}

export default function LogArchive() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({
    severity: '',
    technique_id: '',
    playbook_generated: '',
    search: '',
  })

  const [uploadStatus, setUploadStatus] = useState(null)
  const fileRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (filters.severity) params.severity = filters.severity
      if (filters.technique_id) params.technique_id = filters.technique_id
      if (filters.playbook_generated !== '') params.playbook_generated = filters.playbook_generated === 'true'
      if (filters.search) params.search = filters.search

      const data = await api.logs.list(params)
      setEvents(data.events)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (e) {
      console.error('Log fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus({ state: 'uploading', message: `Uploading ${file.name}...` })
    try {
      const result = await api.logs.upload(file)
      setUploadStatus({ state: 'success', message: `${result.events_queued} events queued for ingestion` })
      setTimeout(() => { setUploadStatus(null); fetchLogs() }, 3000)
    } catch (err) {
      setUploadStatus({ state: 'error', message: err.message })
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all logged events? This will also stop replay and clear the incidents.")) return
    try {
      await api.logs.clear()
      setEvents([])
      setTotal(0)
      setTotalPages(1)
      setPage(1)
    } catch (e) {
      console.error('Failed to clear logs:', e)
    }
  }

  const pages = (() => {
    const p = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i)
    } else {
      p.push(1)
      if (page > 3) p.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) p.push(i)
      if (page < totalPages - 2) p.push('...')
      p.push(totalPages)
    }
    return p
  })()

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-headline-md text-on-surface font-semibold">Log Archive</h1>
          <p className="mono-data text-secondary text-sm">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block mr-1.5" />
            {total.toLocaleString()} events indexed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by IP, Hash, or ID..."
              value={filters.search}
              onChange={e => handleFilter('search', e.target.value)}
              className="bg-surface-low border border-outline/30 rounded px-3 py-1.5 text-sm text-on-surface placeholder-outline w-64 focus:outline-none focus:border-primary/50 mono-data"
              id="log-search"
            />
          </div>
          {/* Upload */}
          <input ref={fileRef} type="file" accept=".json,.ndjson,.jsonl" onChange={handleUpload} className="hidden" id="log-upload-input" />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-primary flex items-center gap-2 text-xs"
            id="log-upload-btn"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Logs
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 bg-critical/15 text-critical border border-critical/30 rounded hover:bg-critical/25 transition-all text-xs font-mono font-bold"
            id="log-clear-btn"
          >
            CLEAR LOGS
          </button>
        </div>
      </div>

      {/* Upload status */}
      {uploadStatus && (
        <div className={`px-4 py-2 rounded border text-sm fade-in ${
          uploadStatus.state === 'error' ? 'bg-critical/10 border-critical/30 text-critical' :
          uploadStatus.state === 'success' ? 'bg-secondary/10 border-secondary/30 text-secondary' :
          'bg-primary/10 border-primary/30 text-primary'
        }`}>
          {uploadStatus.message}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Severity filter */}
        {['', 'critical', 'warning', 'info'].map(sev => (
          <button
            key={sev || 'all'}
            onClick={() => handleFilter('severity', sev)}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
              filters.severity === sev
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'border-outline/20 text-on-surface-variant hover:border-outline/40'
            }`}
            id={`filter-${sev || 'all'}`}
          >
            {sev ? sev.charAt(0).toUpperCase() + sev.slice(1) : 'All'}
          </button>
        ))}

        <div className="w-px h-4 bg-outline/20" />

        <select
          value={filters.playbook_generated}
          onChange={e => handleFilter('playbook_generated', e.target.value)}
          className="bg-surface-low border border-outline/30 rounded px-3 py-1 text-xs text-on-surface-variant focus:outline-none focus:border-primary/50 cursor-pointer"
          id="filter-playbook"
        >
          <option value="">Playbook Status</option>
          <option value="true">With Playbook</option>
          <option value="false">Without Playbook</option>
        </select>

        {(filters.severity || filters.technique_id || filters.playbook_generated || filters.search) && (
          <button
            onClick={() => { setFilters({ severity: '', technique_id: '', playbook_generated: '', search: '' }); setPage(1) }}
            className="text-xs text-on-surface-variant hover:text-on-surface mono-label transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Scrollable table container */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[800px]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_1fr_1fr_100px_80px] gap-4 px-4 py-2 border-b border-primary/10 shrink-0">
              {['TIMESTAMP', 'SEVERITY', 'EVENT TYPE', 'SOURCE IP', 'TECHNIQUE ID', 'PLAYBOOK'].map(col => (
                <span key={col} className="mono-label text-outline">{col}</span>
              ))}
            </div>

            {/* Table body */}
            <div className="divide-y divide-surface-high">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr_1fr_100px_80px] gap-4 px-4 py-3">
                    {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-4" />)}
                  </div>
                ))
              ) : events.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-outline mono-label">NO EVENTS FOUND</div>
              ) : (
                events.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => ev.severity === 'critical' && navigate(`/incidents/${ev.id}`)}
                    className={`grid grid-cols-[1fr_100px_1fr_1fr_100px_80px] gap-4 px-4 py-3 transition-colors fade-in ${
                      ev.severity === 'critical'
                        ? 'border-l-2 border-l-critical cursor-pointer hover:bg-surface-high'
                        : 'hover:bg-surface-high/50'
                    }`}
                  >
                    <span className="mono-data text-xs text-on-surface-variant">{formatTs(ev.timestamp)}</span>
                    <span><SeverityChip severity={ev.severity} /></span>
                    <span className="mono-data text-xs text-on-surface truncate">{ev.event_type}</span>
                    <span className="mono-data text-xs text-primary">{ev.source_ip}</span>
                    <span><TechniqueBadge id={ev.technique_id} /></span>
                    <span className="flex items-center">
                      {ev.playbook_generated ? (
                        <span className="text-secondary">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                        </span>
                      ) : <span className="text-outline mono-data text-xs">—</span>}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-primary/10 flex items-center justify-between shrink-0">
          <span className="mono-data text-xs text-on-surface-variant">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2 py-1 rounded text-xs text-on-surface-variant hover:bg-surface-high disabled:opacity-30">
              ‹ Previous
            </button>
            {pages.map((p, i) =>
              p === '...' ? (
                <span key={i} className="px-2 mono-data text-outline">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-xs font-semibold transition-all ${
                    p === page ? 'bg-primary/20 text-primary border border-primary/30' : 'text-on-surface-variant hover:bg-surface-high'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2 py-1 rounded text-xs text-on-surface-variant hover:bg-surface-high disabled:opacity-30">
              Next ›
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mono-label text-outline text-center shrink-0">
        SECURE TRANSMISSION END // RADAR ALPHA-V-B9
      </p>
    </div>
  )
}
