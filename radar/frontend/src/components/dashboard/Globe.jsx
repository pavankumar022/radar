/**
 * 3D Threat Globe — Interactive Three.js Cyber SOC Visualization
 * Visualizes real-time cyber-threat intelligence arcs from exact IP geolocations.
 *
 * Features:
 * - 360° 3D sphere rotatable from every direction using OrbitControls.
 * - Exact IP geolocation placement (lat/lon) without fake data.
 * - Animated quadratic 3D bezier attack arcs with travelling neon energy pulses.
 * - Interactive Raycaster inspection tooltip on node hover.
 * - Glassmorphic Cyber-SOC HUD overlays & country threat leaderboard.
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useStore } from '../../lib/store'
import WORLD_OUTLINE from '../../lib/world_outline.json'

// Default Target Location (Protected SOC Node)
const DEFAULT_TARGET_LAT = 37.7749
const DEFAULT_TARGET_LON = -122.4194
const GLOBE_RADIUS = 1.0

// Neon threat palette
const SEVERITY_COLORS = {
  critical: 0xff2e55, // Electric Crimson
  warning: 0xffb000,  // Golden Amber
  info: 0x00f5a0,     // Cyber Emerald
  live: 0xffd700,     // Gold / Live Capture
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
  const sceneRef = useRef(null)
  const globeGroupRef = useRef(null)
  const { state } = useStore()
  const alertsRef = useRef([])

  const [hoveredNode, setHoveredNode] = useState(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [activeArcCount, setActiveArcCount] = useState(0)

  useEffect(() => {
    alertsRef.current = state.alerts
  }, [state.alerts])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth
    const H = el.clientHeight

    // ─── WebGL Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    el.appendChild(renderer.domElement)

    // ─── Scene & Camera ──────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000)
    camera.position.set(0, 0.8, 2.6)
    cameraRef.current = camera

    // ─── Orbit Controls ──────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.6
    controls.zoomSpeed = 0.8
    controls.minDistance = 1.2
    controls.maxDistance = 4.5
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.6
    controlsRef.current = controls

    const stopAutoRotateOnUserDrag = () => {
      controls.autoRotate = false
      setAutoRotate(false)
    }
    renderer.domElement.addEventListener('pointerdown', stopAutoRotateOnUserDrag)

    // ─── Main Globe Group ────────────────────────────────────────────────────
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)
    globeGroupRef.current = globeGroup

    // ─── Core Ocean Sphere ───────────────────────────────────────────────────
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64)
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x050c18,
      emissive: 0x02060d,
      specular: 0x112244,
      shininess: 25,
      transparent: true,
      opacity: 0.96,
    })
    const globeMesh = new THREE.Mesh(globeGeo, globeMat)
    globeGroup.add(globeMesh)

    // ─── Wireframe Graticule Grid ────────────────────────────────────────────
    const gridGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(GLOBE_RADIUS + 0.002, 24, 24))
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.08,
    })
    const gridMesh = new THREE.LineSegments(gridGeo, gridMat)
    globeGroup.add(gridMesh)

    // ─── Atmosphere Fresnel Soft Glow ────────────────────────────────────────
    const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.035, 64, 64)
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x00d2ff) } },
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0,0,1)), 3.0);
          gl_FragColor = vec4(glowColor, intensity * 0.45);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    })
    scene.add(new THREE.Mesh(glowGeo, glowMat))

    // ─── Landmass Density Dot Projection ─────────────────────────────────────
    const fillPositions = []
    const surfaceR = GLOBE_RADIUS + 0.006

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
        const sampleCount = Math.min(350, Math.max(4, Math.floor(area * 1.8)))
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

    const fillGeo = new THREE.BufferGeometry()
    fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fillPositions), 3))
    const fillMat = new THREE.PointsMaterial({
      color: 0x00f5a0,
      size: 0.012,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    })
    globeGroup.add(new THREE.Points(fillGeo, fillMat))

    // ─── Target SOC Node ─────────────────────────────────────────────────────
    const targetPos = latLonToXYZ(DEFAULT_TARGET_LAT, DEFAULT_TARGET_LON, GLOBE_RADIUS)

    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    )
    targetMarker.position.copy(targetPos)
    globeGroup.add(targetMarker)

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.036, 32),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    )
    targetRing.position.copy(targetPos)
    targetRing.lookAt(0, 0, 0)
    globeGroup.add(targetRing)

    // ─── Scene Lighting ──────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x112233, 1.4))
    const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.0)
    dirLight.position.set(5, 4, 5)
    scene.add(dirLight)

    // ─── Raycaster Inspection Setup ──────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const interactiveNodes = []

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(interactiveNodes, false)
      if (intersects.length > 0) {
        const nodeData = intersects[0].object.userData
        if (nodeData) setHoveredNode(nodeData)
      } else {
        setHoveredNode(null)
      }
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)

    // ─── Dynamic Threat Arcs Pipeline ────────────────────────────────────────
    const activeArcs = []

    function createThreatArc(eventData) {
      const startLat = Number(eventData.lat)
      const startLon = Number(eventData.lon)

      if (isNaN(startLat) || isNaN(startLon) || (startLat === 0 && startLon === 0)) return

      const isLive = eventData.source === 'live_capture'
      const colorHex = isLive
        ? SEVERITY_COLORS.live
        : SEVERITY_COLORS[eventData.severity] || SEVERITY_COLORS.info

      const start = latLonToXYZ(startLat, startLon, GLOBE_RADIUS)
      const end = targetPos.clone()
      const mid = start.clone().add(end).multiplyScalar(0.5)

      // Dynamic arc elevation above globe surface
      const distance = start.distanceTo(end)
      const altitude = distance * 0.45 + 0.2
      mid.normalize().multiplyScalar(GLOBE_RADIUS + altitude)

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const points = curve.getPoints(50)

      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      })
      const line = new THREE.Line(geo, mat)
      globeGroup.add(line)

      // Travelling pulse particle
      const pulseGeo = new THREE.SphereGeometry(0.012, 12, 12)
      const pulseMat = new THREE.MeshBasicMaterial({ color: colorHex })
      const pulse = new THREE.Mesh(pulseGeo, pulseMat)
      globeGroup.add(pulse)

      // Origin Marker Dot
      const originMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 12),
        new THREE.MeshBasicMaterial({ color: colorHex })
      )
      originMarker.position.copy(start)
      originMarker.userData = eventData
      globeGroup.add(originMarker)
      interactiveNodes.push(originMarker)

      activeArcs.push({
        line,
        curve,
        pulse,
        originMarker,
        t: 0,
        speed: 0.008 + Math.random() * 0.006,
      })
    }

    // ─── Animation & Render Loop ─────────────────────────────────────────────
    let lastEventTime = 0
    let eventIndex = 0
    let frameId

    function animate() {
      frameId = requestAnimationFrame(animate)

      // Advance pulses along active arcs
      for (let i = activeArcs.length - 1; i >= 0; i--) {
        const a = activeArcs[i]
        a.t += a.speed
        const pos = a.curve.getPoint(Math.min(a.t, 1))
        a.pulse.position.copy(pos)

        if (a.t >= 1) {
          // Pulse arrived — fade out line and cleanup
          a.line.material.opacity -= 0.02
          if (a.line.material.opacity <= 0) {
            globeGroup.remove(a.line)
            globeGroup.remove(a.pulse)
            globeGroup.remove(a.originMarker)

            // Remove from interactive nodes
            const idx = interactiveNodes.indexOf(a.originMarker)
            if (idx !== -1) interactiveNodes.splice(idx, 1)

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

      setActiveArcCount(activeArcs.length)

      // Spawn arcs from real WebSocket security alerts
      const now = Date.now()
      if (now - lastEventTime > 350 && alertsRef.current.length > 0) {
        lastEventTime = now
        const alerts = alertsRef.current
        const ev = alerts[eventIndex % Math.min(alerts.length, 50)]
        eventIndex++
        if (ev?.lat && ev?.lon) {
          createThreatArc(ev)
        }
      }

      // Target ring pulsing animation
      const ringScale = 1.0 + 0.18 * Math.sin(Date.now() * 0.004)
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', stopAutoRotateOnUserDrag)
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement)
      }
    }
  }, [])

  // ─── Control Actions ───────────────────────────────────────────────────────
  const zoomIn = () => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(0.82)
  }
  const zoomOut = () => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(1.18)
  }
  const resetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0.8, 2.6)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.autoRotate = true
      setAutoRotate(true)
    }
  }
  const toggleRotation = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !autoRotate
      setAutoRotate(!autoRotate)
    }
  }

  // ─── Top Origins Real Data ─────────────────────────────────────────────────
  const topOrigins = useMemo(() => {
    const counts = {}
    state.alerts.slice(0, 150).forEach(ev => {
      const c = ev.country || 'Unknown'
      if (c !== '??' && c !== 'US') {
        counts[c] = (counts[c] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [state.alerts])

  return (
    <div className="card flex flex-col h-full relative overflow-hidden bg-surface-lowest">
      {/* Header */}
      <div className="card-header shrink-0 z-10 bg-surface-lowest/80 backdrop-blur border-b border-outline/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary pulse-dot" />
          <h3 className="font-semibold text-sm text-on-surface">3D Threat Intelligence Globe</h3>
          <span className="mono-data text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-primary font-bold ml-2">
            {activeArcCount} ACTIVE ARCS
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-critical" />Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />Warning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00f5a0]" />Info</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ffd700]" />Live</span>
        </div>
      </div>

      {/* 3D Canvas container */}
      <div ref={mountRef} className="flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* Hover Inspection Tooltip */}
      {hoveredNode && (
        <div className="absolute top-16 left-4 bg-surface-lowest/95 border border-primary/40 p-3 rounded-lg shadow-2xl backdrop-blur max-w-xs z-20 fade-in pointer-events-none">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="mono-data text-xs text-primary font-bold">{hoveredNode.event_type}</span>
            <span className="mono-data text-[10px] px-1.5 py-0.5 bg-critical/20 text-critical border border-critical/30 rounded uppercase font-bold">
              {hoveredNode.severity}
            </span>
          </div>
          <p className="mono-data text-xs text-on-surface">Src: {hoveredNode.source_ip || 'Captured Node'}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Location: {hoveredNode.city || 'Geolocated'}, {hoveredNode.country || 'IP API'}
          </p>
          {hoveredNode.technique_id && (
            <p className="mono-data text-[10px] text-secondary mt-1">MITRE: {hoveredNode.technique_id}</p>
          )}
        </div>
      )}

      {/* Floating HUD Controls */}
      <div className="absolute top-16 right-4 flex flex-col gap-1.5 z-10">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-surface-low/90 border border-outline/30 rounded hover:bg-surface-bright text-primary font-bold text-base flex items-center justify-center transition-all shadow-glow-sm"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-surface-low/90 border border-outline/30 rounded hover:bg-surface-bright text-primary font-bold text-base flex items-center justify-center transition-all shadow-glow-sm"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-surface-low/90 border border-outline/30 rounded hover:bg-surface-bright text-primary font-bold text-xs flex items-center justify-center transition-all shadow-glow-sm"
          title="Reset View"
        >
          ⟲
        </button>
        <button
          onClick={toggleRotation}
          className={`w-8 h-8 border rounded font-bold text-xs flex items-center justify-center transition-all shadow-glow-sm ${
            autoRotate
              ? 'bg-secondary/20 text-secondary border-secondary/40'
              : 'bg-surface-low/90 text-outline border-outline/30'
          }`}
          title="Toggle Auto Rotate"
        >
          🔄
        </button>
      </div>

      {/* Top Threat Origin Leaderboard Overlay */}
      {topOrigins.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-surface-lowest/90 border border-primary/20 rounded-lg p-3 min-w-[160px] z-10 backdrop-blur pointer-events-none select-none">
          <p className="mono-label text-[10px] text-on-surface-variant uppercase tracking-wider mb-2">
            Top Threat Origins
          </p>
          {topOrigins.map(([country, count]) => (
            <div key={country} className="flex items-center justify-between py-0.5 gap-4">
              <span className="mono-data text-xs text-on-surface font-semibold">{country}</span>
              <span className="mono-data text-xs text-critical font-bold">{count} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
