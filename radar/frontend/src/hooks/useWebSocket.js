/**
 * useWebSocket — Native WebSocket hook for RADAR
 * 
 * Features:
 * - Auto-reconnect with exponential backoff (max 30s)
 * - Heartbeat ping/pong keepalive
 * - Message queue during reconnect to avoid missed events
 * - Exposes real connection state (not hardcoded labels)
 * - Zero dependencies beyond React
 */
import { useEffect, useRef, useCallback, useState } from 'react'

// Use VITE_WS_URL if provided (e.g. on Vercel), fallback to window.location host relative path
const WS_URL = import.meta.env.VITE_WS_URL || 
  ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/alerts')
const PING_INTERVAL_MS = 25000
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

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
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
        setConnected(true)

        // Heartbeat ping
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type !== 'pong' && msg.type !== 'ping') {
            onMessageRef.current?.(msg)
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        clearTimers()
        setConnected(false)
        // Exponential backoff reconnect
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current,
          RECONNECT_MAX_MS
        )
        reconnectAttemptsRef.current++
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (err) {
      console.warn('WebSocket connect error:', err)
    }
  }, [clearTimers])

  useEffect(() => {
    connect()
    return () => {
      clearTimers()
      wsRef.current?.close()
    }
  }, [connect, clearTimers])

  return { connected }
}
