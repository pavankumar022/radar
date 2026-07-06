/**
 * useWebSocket — Native WebSocket hook for RADAR
 *
 * Features:
 * - Auto-reconnect with exponential backoff (max 15s)
 * - Dynamic URL resolution (localStorage / VITE_WS_URL / Vercel→Render auto fallback)
 * - Heartbeat ping/pong keepalive every 20s
 * - Render uptime is maintained externally by UptimeRobot (free), not in-app
 */
import { useEffect, useRef, useCallback, useState } from 'react'

export function getWsUrl() {
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('radar_api_url') : null
  if (custom && custom.trim()) {
    let clean = custom.trim().replace(/\/+$/, '')
    clean = clean.replace(/\/api$/, '')
    if (clean.startsWith('http://')) clean = clean.replace('http://', 'ws://')
    else if (clean.startsWith('https://')) clean = clean.replace('https://', 'wss://')
    return clean + '/ws/alerts'
  }
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  // Production: Vercel frontend → Render backend WebSocket
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'wss://radar-backend-lmzh.onrender.com/ws/alerts'
  }
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  return protocol + window.location.host + '/ws/alerts'
}

const PING_INTERVAL_MS = 20000   // WebSocket ping every 20s
const RECONNECT_BASE_MS = 1500
const RECONNECT_MAX_MS = 15000   // Max 15s between reconnect attempts

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const pingTimerRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const [connected, setConnected] = useState(false)

  const clearTimers = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current)
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const url = getWsUrl()
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
        setConnected(true)
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type !== 'pong' && msg.type !== 'ping') {
            onMessageRef.current?.(msg)
          }
        } catch {
          // ignore malformed frame
        }
      }

      ws.onerror = () => { ws.close() }

      ws.onclose = () => {
        setConnected(false)
        clearTimers()
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptsRef.current),
          RECONNECT_MAX_MS
        )
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    } catch {
      setConnected(false)
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_BASE_MS)
    }
  }, [clearTimers])

  useEffect(() => {
    connect()
    return () => {
      clearTimers()
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect, clearTimers])

  return { connected }
}
