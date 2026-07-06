/**
 * RADAR API Client
 * All REST API calls go through here — never scattered across components.
 * Base URL dynamically checks localStorage / VITE_API_URL / Vercel-Render production fallback.
 */

export function getApiBase() {
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('radar_api_url') : null
  if (custom && custom.trim()) {
    let clean = custom.trim().replace(/\/+$/, '')
    if (!clean.endsWith('/api')) clean += '/api'
    return clean
  }
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '')
    if (!clean.endsWith('/api')) clean += '/api'
    return clean
  }
  // Production automatic fallback connecting Vercel deployment to Render Python backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://radar-backend-lmzh.onrender.com/api'
  }
  return '/api'
}

async function request(path, options = {}) {
  const base = getApiBase()
  const targetUrl = `${base}${path.startsWith('/') ? path : '/' + path}`
  const res = await fetch(targetUrl, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Status ────────────────────────────────────────────────────────────────────
export const api = {
  status: () => request('/status'),

  // ─── Alerts ──────────────────────────────────────────────────────────────────
  alerts: {
    latest: (limit = 20) => request(`/alerts/latest?limit=${limit}`),
    stats: () => request('/alerts/stats'),
  },

  // ─── Logs ────────────────────────────────────────────────────────────────────
  logs: {
    list: (params = {}) => {
      const q = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v) })
      return request(`/logs?${q}`)
    },
    upload: async (file) => {
      const base = getApiBase()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${base}/logs/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        let detail = ''
        try {
          const body = await res.json()
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        } catch {
          try { detail = await res.text() } catch { /* ignore */ }
        }
        throw new Error(`Upload failed: ${res.status}${detail ? ': ' + detail : ''}`)
      }
      return res.json()
    },
    clear: () => request('/logs', { method: 'DELETE' }),
  },

  // ─── Playbooks ───────────────────────────────────────────────────────────────
  playbook: {
    generate: (alertId, provider) =>
      request('/playbook/generate', {
        method: 'POST',
        body: JSON.stringify({ alert_id: alertId, provider }),
      }),
    get: (alertId) => request(`/playbook/${alertId}`),
  },

  // ─── Settings ────────────────────────────────────────────────────────────────
  settings: {
    get: () => request('/settings'),
    update: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),
    shield: (active) =>
      request('/settings/shield', {
        method: 'POST',
        body: JSON.stringify({ monitoring_active: active }),
      }),
  },

  // ─── Replay ──────────────────────────────────────────────────────────────────
  replay: {
    start: (speed) =>
      request('/replay/start', {
        method: 'POST',
        body: JSON.stringify({ speed_multiplier: speed }),
      }),
    stop: () => request('/replay/stop', { method: 'POST', body: '{}' }),
    status: () => request('/replay/status'),
  },

  // ─── Live Capture ────────────────────────────────────────────────────────────
  live: {
    start: () => request('/live/start', { method: 'POST' }),
    stop: () => request('/live/stop', { method: 'POST' }),
    status: () => request('/live/status'),
  },

  // ─── MITRE ───────────────────────────────────────────────────────────────────
  mitre: () => request('/mitre'),
}
