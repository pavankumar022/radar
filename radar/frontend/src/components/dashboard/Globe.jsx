/**
 * 3D Globe — Three.js
 * Visualizes live cyber-threat intelligence arcs from real geolocated alerts.
 * Features:
 * - Real continent landmass dot-shading projection (from WORLD_OUTLINE).
 * - Animated attack arcs and traveling pulses from origins to target.
 * - Soft outer fresnel glow shader.
 * - OrbitControls drag rotation & zoom.
 * - Sidebar overlay for top origins.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useStore } from '../../lib/store'
import WORLD_OUTLINE from '../../lib/world_outline.json'

// Protected target (San Francisco / US-West)
const TARGET_LAT = 37.7749
const TARGET_LON = -122.4194
const GLOBE_RADIUS = 1.0

// Color mapping
const SEVERITY_COLORS = {
  critical: 0xff796f, // Red
  warning: 0xffb300,  // Yellow/Orange
  info: 0x00e479,     // Green / Blocked
}

function latLonToXYZ(lat, lon, radius = GLOBE_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [loni, lati] = ring[i]
    const [lonj, latj] = ring[j]
    const intersect =
      lati > lat !== latj > lat &&
      lon < ((lonj - loni) * (lat - lati)) / (latj - lati) + loni
    if (intersect) inside = !inside
  }
  return inside
}

export default function Globe() {
  const mountRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const { state } = useStore()
  const alertsRef = useRef([])

  useEffect(() => {
    alertsRef.current = state.alerts
  }, [state.alerts])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth
    const H = el.clientHeight

    // ─── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)

    // ─── Scene & Camera ──────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000)
    camera.position.z = 2.5
    cameraRef.current = camera

    // ─── Controls ────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.6
    controls.minDistance = 1.3
    controls.maxDistance = 4.0
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controlsRef.current = controls

    // Pause auto-rotate when dragging starts
    const stopAutoRotate = () => { controls.autoRotate = false }
    renderer.domElement.addEventListener('pointerdown', stopAutoRotate)

    // ─── Globe Group ─────────────────────────────────────────────────────────
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)

    // ─── Globe Base Sphere ───────────────────────────────────────────────────
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64)
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x0a1628,
      emissive: 0x050d18,
      specular: 0x1a3a6e,
      shininess: 10,
      transparent: true,
      opacity: 0.95,
    })
    const globeBase = new THREE.Mesh(globeGeo, globeMat)
    globeGroup.add(globeBase)

    // ─── Outer Soft Glow (Fresnel Shader) ────────────────────────────────────
    const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.03, 64, 64)
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x93ccff) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1)), 3.0);
          gl_FragColor = vec4(glowColor, intensity * 0.4);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    scene.add(glowMesh) // Add to scene so it stays aligned relative to camera

    // ─── World Landmass Outline (Dense Points Shading) ───────────────────────
    const addWorldOutline = () => {
      const fillGeo = new THREE.BufferGeometry()
      const fillPositions = []
      const surfaceR = GLOBE_RADIUS + 0.005

      WORLD_OUTLINE.forEach((ring) => {
        ring.forEach(([lon, lat]) => {
          const p = latLonToXYZ(lat, lon, surfaceR)
          fillPositions.push(p.x, p.y, p.z)
        })

        if (ring.length > 3) {
          let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
          ring.forEach(([lon, lat]) => {
            minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
          })
          const area = (maxLon - minLon) * (maxLat - minLat)
          const sampleCount = Math.min(400, Math.max(4, Math.floor(area * 2)))
          for (let i = 0; i < sampleCount; i++) {
            const lon = minLon + Math.random() * (maxLon - minLon)
            const lat = minLat + Math.random() * (maxLat - minLat)
            if (pointInRing(lon, lat, ring)) {
              const p = latLonToXYZ(lat, lon, surfaceR)
              fillPositions.push(p.x, p.y, p.z)
            }
          }
        }
      })

      fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fillPositions), 3))
      const fillMat = new THREE.PointsMaterial({
        color: 0x4a5a52,
        size: 0.01,
        transparent: true,
        opacity: 0.85,
      })
      const worldPoints = new THREE.Points(fillGeo, fillMat)
      globeGroup.add(worldPoints)
    }

    addWorldOutline()

    // ─── Target (Protected Asset) Marker ─────────────────────────────────────
    const targetPos = latLonToXYZ(TARGET_LAT, TARGET_LON, GLOBE_RADIUS)

    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x93ccff })
    )
    targetMarker.position.copy(targetPos)
    globeGroup.add(targetMarker)

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.038, 32),
      new THREE.MeshBasicMaterial({ color: 0x93ccff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    )
    targetRing.position.copy(targetPos)
    targetRing.lookAt(0, 0, 0)
    globeGroup.add(targetRing)

    // ─── Lighting ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223355, 1.3))
    const dirLight = new THREE.DirectionalLight(0x93ccff, 0.8)
    dirLight.position.set(5, 3, 5)
    scene.add(dirLight)

    // ─── Threat Arcs Pipeline ────────────────────────────────────────────────
    const activeArcs = []

    function buildArc(startLat, startLon, severity) {
      const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info
      const start = latLonToXYZ(startLat, startLon, GLOBE_RADIUS)
      const end = targetPos.clone()
      const mid = start.clone().add(end).multiplyScalar(0.5)

      // Elevate arc mid point above surface
      const altitude = start.distanceTo(end) * 0.5 + 0.24
      mid.normalize().multiplyScalar(GLOBE_RADIUS + altitude)

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const points = curve.getPoints(60)

      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      })
      const line = new THREE.Line(geo, mat)
      globeGroup.add(line)

      // traveling pulse dot
      const pulseGeo = new THREE.SphereGeometry(0.01, 8, 8)
      const pulseMat = new THREE.MeshBasicMaterial({ color })
      const pulse = new THREE.Mesh(pulseGeo, pulseMat)
      globeGroup.add(pulse)

      // origin dot
      const originMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 12, 12),
        new THREE.MeshBasicMaterial({ color })
      )
      originMarker.position.copy(start)
      globeGroup.add(originMarker)

      activeArcs.push({
        line,
        curve,
        pulse,
        originMarker,
        t: 0,
        speed: 0.007 + Math.random() * 0.005,
      })
    }

    // ─── Animation Loop ──────────────────────────────────────────────────────
    let lastArcTime = 0
    let arcIndex = 0
    let frameId

    function animate() {
      frameId = requestAnimationFrame(animate)

      // Pulse traveling along active arcs
      for (let i = activeArcs.length - 1; i >= 0; i--) {
        const a = activeArcs[i]
        a.t += a.speed
        const pos = a.curve.getPoint(Math.min(a.t, 1))
        a.pulse.position.copy(pos)

        if (a.t >= 1) {
          // Pulse arrived — fade the arc line out
          a.line.material.opacity -= 0.015
          if (a.line.material.opacity <= 0) {
            globeGroup.remove(a.line)
            globeGroup.remove(a.pulse)
            globeGroup.remove(a.originMarker)
            a.line.geometry.dispose()
            a.line.material.dispose()
            a.pulse.geometry.dispose()
            a.pulse.material.dispose()
            a.originMarker.geometry.dispose()
            a.originMarker.material.dispose()
            activeArcs.splice(i, 1)
          }
        }
      }

      // Add arc from live WebSocket events
      const now = Date.now()
      if (now - lastArcTime > 400 && alertsRef.current.length > 0) {
        lastArcTime = now
        const alerts = alertsRef.current
        const ev = alerts[arcIndex % Math.min(alerts.length, 30)]
        arcIndex++
        if (ev?.lat && ev?.lon && Math.abs(ev.lat) > 0.1) {
          buildArc(ev.lat, ev.lon, ev.severity)
        }
      }

      // Pulsing target ring
      const ringScale = 1.0 + 0.15 * Math.sin(Date.now() * 0.003)
      targetRing.scale.set(ringScale, ringScale, ringScale)

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // ─── Resize Observer ─────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      renderer.dispose()
      renderer.domElement.removeEventListener('pointerdown', stopAutoRotate)
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement)
      }
    }
  }, [])

  // ─── Controls triggers ─────────────────────────────────────────────────────
  const zoomIn = () => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(0.85)
  }
  const zoomOut = () => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(1.15)
  }
  const resetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0, 2.5)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.autoRotate = true
    }
  }

  // ─── Top Origins ───────────────────────────────────────────────────────────
  const topOrigins = (() => {
    const counts = {}
    state.alerts.slice(0, 100).forEach(ev => {
      if (ev.country && ev.country !== '??' && ev.country !== 'US') {
        counts[ev.country] = (counts[ev.country] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  })()

  return (
    <div className="card flex flex-col h-full relative overflow-hidden">
      <div className="card-header shrink-0">
        <h3 className="font-semibold text-sm text-on-surface">Global Threat Map</h3>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-critical" />Exploit</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />Recon</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00e479]" />Blocked</span>
        </div>
      </div>

      {/* Canvas container */}
      <div ref={mountRef} className="flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* Floating HUD controls */}
      <div className="absolute top-14 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={zoomIn}
          className="w-7 h-7 bg-surface-low border border-outline/25 rounded hover:bg-surface-bright text-primary font-bold text-sm flex items-center justify-center transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-7 h-7 bg-surface-low border border-outline/25 rounded hover:bg-surface-bright text-primary font-bold text-sm flex items-center justify-center transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-7 h-7 bg-surface-low border border-outline/25 rounded hover:bg-surface-bright text-primary font-bold text-xs flex items-center justify-center transition-colors"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Top origins overlay */}
      {topOrigins.length > 0 && (
        <div className="absolute bottom-3 left-3 bg-surface-lowest/90 border border-primary/15 rounded p-2 min-w-[140px] z-10 pointer-events-none select-none">
          <p className="mono-label text-[10px] text-outline mb-1.5">Top Origins</p>
          {topOrigins.map(([country, count]) => (
            <div key={country} className="flex items-center justify-between py-0.5 gap-3">
              <span className="mono-data text-xs text-on-surface">{country}</span>
              <span className="mono-data text-xs text-critical font-bold">{count} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
