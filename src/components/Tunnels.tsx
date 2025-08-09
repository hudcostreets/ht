import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Tooltip } from 'react-tooltip'
import useSessionStorageState from 'use-session-storage-state'
import { AnalogClock } from './AnalogClock'
import { Tunnel } from './Tunnel.tsx'
import { LAYOUT, COMPUTED_LAYOUT } from '../models/Constants'
import { HOLLAND_TUNNEL_CONFIG } from '../models/TunnelConfigs'
import { Tunnels as HT } from '../models/Tunnels'
import './Tunnels.scss'

// Create the tunnels instance
const tunnels = new HT(HOLLAND_TUNNEL_CONFIG)
const { eb, wb } = tunnels

// Generate timeline entries from config
function generateTimeline(tunnel: typeof eb | typeof wb) {
  const { offsetMin, penCloseMin, sweepStartMin, paceStartMin, period, officialResetMins } = tunnel.config
  const entries = []

  // Convert tunnel-relative time to absolute minute
  const toAbsolute = (relMin: number) => (relMin + offsetMin) % period

  // Build phases in chronological order (relative to tunnel's cycle)
  // Phase 1: Bikes enter tunnel (0 to penCloseMin)
  entries.push({
    start: toAbsolute(0),
    end: toAbsolute(penCloseMin),
    label: 'Bikes enter tunnel',
    relStart: 0
  })

  // Phase 2: Buffer (before Sweep) (penCloseMin to sweepStartMin)
  entries.push({
    start: toAbsolute(penCloseMin),
    end: toAbsolute(sweepStartMin),
    label: 'Buffer (before Sweep)',
    relStart: penCloseMin
  })

  // Phase 3: Sweep vehicle (sweepStartMin to paceStartMin)
  entries.push({
    start: toAbsolute(sweepStartMin),
    end: toAbsolute(paceStartMin),
    label: 'Sweep vehicle',
    relStart: sweepStartMin
  })

  // Phase 4: Pace car + cars resume (paceStartMin for officialResetMins)
  entries.push({
    start: toAbsolute(paceStartMin),
    end: toAbsolute(paceStartMin + officialResetMins),
    label: 'Pace car + cars resume',
    relStart: paceStartMin
  })

  // Phase 5: Normal traffic (from pace end to next cycle start)
  entries.push({
    start: toAbsolute(paceStartMin + officialResetMins),
    end: toAbsolute(period), // Will wrap to 0
    label: 'Normal traffic (cars)',
    relStart: paceStartMin + officialResetMins
  })

  return entries
}

export function Tunnels() {
  // Force re-render on resize to update responsive layout
  const [, forceUpdate] = useState({})
  useEffect(() => {
    const handleResize = () => forceUpdate({})
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Check URL parameter for initial time
  const urlParams = new URLSearchParams(window.location.search)
  const urlMinute = urlParams.get('t')
  const initialMinute = urlMinute !== null ? parseFloat(urlMinute) % 60 : 0

  const [currentMinute, setCurrentMinute] = useSessionStorageState<number>('ht-current-minute', {
    defaultValue: initialMinute
  })
  const [isPaused, setIsPaused] = useSessionStorageState<boolean>('ht-is-paused', {
    defaultValue: urlMinute !== null // Pause if URL param is set
  })
  const [speed, setSpeed] = useSessionStorageState<number>('ht-speed', {
    defaultValue: 3
  })

  // Animation for smooth transitions (in minutes)
  const [displayTime, setDisplayTime] = useState(initialMinute)
  const animationRef = useRef<number | undefined>(undefined)

  // State for arrow key transitions
  const [targetTime, setTargetTime] = useState(initialMinute)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showDecimal, setShowDecimal] = useState(false)

  // Update current minute when display time changes
  useEffect(() => {
    // Ensure displayTime stays within bounds
    const boundedTime = displayTime % 60
    const newMinute = Math.floor(boundedTime) % 60
    if (newMinute !== currentMinute) {
      setCurrentMinute(newMinute)
    }
  }, [displayTime, currentMinute, setCurrentMinute])

  // Animation loop
  const animate = useCallback(() => {
    if (!isPaused && !isTransitioning) {
      setDisplayTime(prevTime => {
        // Speed is in minutes per frame (at 60fps, speed=1 means 60 minutes per second)
        const minutesPerFrame = speed / 60
        const newTime = prevTime + minutesPerFrame
        return newTime % 60
      })
    } else if (isTransitioning) {
      // Smooth transition for arrow key navigation
      setDisplayTime(prevTime => {
        let diff = targetTime - prevTime

        // Handle wraparound at hour boundaries
        if (diff > 30) { // More than 30 minutes backward, must be :59→:00
          diff = diff - 60 // Convert to small forward step
        } else if (diff < -30) { // More than 30 minutes forward, must be :00→:59
          diff = diff + 60 // Convert to small backward step
        }

        if (Math.abs(diff) < 0.01) {
          setIsTransitioning(false)
          return targetTime
        }

        // Linear transition: move at constant speed (8 minutes per second at 60fps)
        const step = 8 / 60
        if (diff > 0) {
          let newTime = prevTime + Math.min(step, diff) // Don't overshoot
          // Handle wraparound during animation
          if (newTime >= 60) newTime -= 60
          return newTime
        } else {
          let newTime = prevTime - Math.min(step, -diff) // Don't overshoot
          // Handle wraparound during animation
          if (newTime < 0) newTime += 60
          return newTime
        }
      })
    }
    animationRef.current = requestAnimationFrame(animate)
  }, [isPaused, isTransitioning, targetTime, speed])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsPaused(prev => !prev)
        setShowDecimal(false)
      } else if (e.code === 'ArrowRight' && isPaused) {
        e.preventDefault()
        const baseTime = isTransitioning ? targetTime : displayTime

        // Alt/Option key: move by 0.1 minute, otherwise by 1 minute
        const increment = e.altKey ? 0.1 : 1
        const newTime = (baseTime + increment) % 60

        setTargetTime(newTime)
        setIsTransitioning(true)
        setShowDecimal(e.altKey)

        // Update URL with precise time
        const url = new URL(window.location.href)
        url.searchParams.set('t', newTime.toFixed(1))
        window.history.replaceState({}, '', url.toString())
      } else if (e.code === 'ArrowLeft' && isPaused) {
        e.preventDefault()
        const baseTime = isTransitioning ? targetTime : displayTime

        // Alt/Option key: move by 0.1 minute, otherwise by 1 minute
        const decrement = e.altKey ? 0.1 : 1
        const newTime = (baseTime - decrement + 60) % 60

        setTargetTime(newTime)
        setIsTransitioning(true)
        setShowDecimal(e.altKey)

        // Update URL with precise time
        const url = new URL(window.location.href)
        url.searchParams.set('t', newTime.toFixed(1))
        window.history.replaceState({}, '', url.toString())
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPaused, isTransitioning, targetTime, displayTime, setIsPaused])

  // Get current vehicles and phases
  const phases = tunnels.getPhases(displayTime)

  // Handle timeline click
  const handleTimelineClick = (minute: number) => {
    const newTime = minute
    // Jump directly to the new time (no transition)
    setDisplayTime(newTime)
    setTargetTime(newTime)
    setIsTransitioning(false)
    setIsPaused(true)
    setShowDecimal(false)

    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('t', minute.toString())
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div className="holland-tunnel">
      <Tooltip id="vehicle-tooltip" style={{ zIndex: 9999 }} />
      <Tooltip id="speed-tooltip" style={{ zIndex: 9999 }} />

      <div className="header">
        <div className="header-content">
          <h1>The Holland Tunnel should have a bike lane</h1>
          <h2>(for 10mins per hour)</h2>
        </div>
      </div>

      <div className="tunnel-visualization-svg">
        <div style={{ position: 'relative', width: '100%', maxWidth: COMPUTED_LAYOUT.SVG_WIDTH, margin: '0 auto' }}>
          {(() => {
            // Calculate SVG height based on actual content
            const ebTunnelBottom = eb.config.y + 60 // Tunnel has 2 lanes of 30px each
            const legendY = eb.config.y + eb.config.pen.y + 10
            const legendBottom = legendY + 82 + 10 // Last item at y=82, plus some padding
            const svgHeight = Math.max(ebTunnelBottom + 100, legendBottom)

            return (
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${COMPUTED_LAYOUT.SVG_WIDTH} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
            {/* Both tunnels */}
            <Tunnel
              dir="west"
              displayTime={displayTime}
              phase={phases.west}
              tunnel={wb}
            />

            <Tunnel
              dir="east"
              displayTime={displayTime}
              phase={phases.east}
              tunnel={eb}
            />

            {/* NJ | NY label at tunnel midpoint */}
            <text
              x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH / 2}
              y={180}
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
              fill="#333"
              opacity="0.6"
            >
              NJ | NY
            </text>

            {/* Global vehicles (Sweep and Pace) */}
            {(() => {
              const allVehicles = tunnels.getAllVehicles(displayTime)
              const globalVehicles = allVehicles.filter(v => v.type === 'sweep' || v.type === 'pace')

              return globalVehicles.map(v => {
                const { id, dir, pos, type } = v
                const x = pos.x + LAYOUT.QUEUE_AREA_WIDTH
                const y = pos.y  // No yOffset needed - positions are absolute

                return (
                  <text
                    key={id}
                    x={x}
                    y={y}
                    fontSize="20"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity={pos.opacity}
                    style={{ userSelect: 'none', cursor: 'pointer' }}
                    transform={dir === 'east' ? `translate(${x * 2},0) scale(-1,1)` : undefined}
                  >
                    {type === 'sweep' ? '🚐' : '🚓'}
                  </text>
                )
              })
            })()}

            {/* Legend positioned to the right of E/b bike pen */}
            {(() => {
              // Position legend to the right of the E/b bike pen
              const legendX = LAYOUT.QUEUE_AREA_WIDTH + eb.config.pen.x + eb.config.pen.w + 20
              const legendY = eb.config.y + eb.config.pen.y + 10

              return (
                <g transform={`translate(${legendX}, ${legendY})`}>
                  <text x="0" y="0" fontSize="14" fontWeight="bold">Legend</text>

                  {/* Green rect - bike space */}
                  <rect x="0" y="10" width="20" height="10" fill="#4caf50" opacity="0.3" />
                  <text x="25" y="19" fontSize="12">Bike space</text>

                  {/* Red rect - clearing space */}
                  <rect x="0" y="25" width="20" height="10" fill="#f44336" opacity="0.3" />
                  <text x="25" y="34" fontSize="12">Clearing space</text>

                  {/* Grey rect - car space */}
                  <rect x="0" y="40" width="20" height="10" fill="#666" />
                  <text x="25" y="49" fontSize="12">Car space</text>

                  {/* Sweep icon */}
                  <text x="10" y="65" fontSize="16" textAnchor="middle">🚐</text>
                  <text x="25" y="65" fontSize="12">"Sweep" clears stragglers</text>

                  {/* Pace icon */}
                  <text x="10" y="82" fontSize="16" textAnchor="middle">🚓</text>
                  <text x="25" y="82" fontSize="12">"Pace car" reopens 🚗 lane</text>
                </g>
              )
            })()}
              </svg>
            )
          })()}

          {/* Clock positioned below E/b exit */}
          {(() => {
            // E/b tunnel: y=200, height=60, pen: y=70 (relative), height=70
            const ebTunnelBottom = 200 + 60 // 260
            const ebPenY = 200 + 70
            const ebPenBottom = ebPenY + COMPUTED_LAYOUT.BIKE_PEN_HEIGHT
            const bikePenLabelBottom = ebPenBottom + 15 // Bike pen label is 15px below pen

            // Legend bottom: starts at pen.y + 10, has 82px of content (last item at y=82)
            const legendY = ebPenY + 10
            const legendBottom = legendY + 82 // Last text baseline is at y=82 in the legend

            // Clock should align with the lowest element (max of bike pen label and legend)
            const clockLabelBottom = Math.max(bikePenLabelBottom, legendBottom)
            const clockTop = ebTunnelBottom + 15 // Start clock a bit below tunnel
            const clockHeight = clockLabelBottom - clockTop

            // E/b exit is at x = QUEUE_AREA_WIDTH + TUNNEL_WIDTH
            const exitX = LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH

            return (
              <div style={{
                position: 'absolute',
                right: `${COMPUTED_LAYOUT.SVG_WIDTH - exitX}px`, // Right-align with E/b exit
                top: `${clockTop}px`,
                height: `${clockHeight}px`,
                width: '100px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}>
                <div style={{ transform: 'scale(1.0)', flex: '1', display: 'flex', alignItems: 'center' }}>
                  <AnalogClock minute={displayTime} />
                </div>
                <div style={{ fontSize: '14px' }}>
                  _ : {showDecimal
                    ? displayTime.toFixed(1).padStart(4, '0')
                    : String(Math.floor(displayTime) % 60).padStart(2, '0')}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <div className="controls-bar">
        <div className="controls">
          <div className="button-group">
            <button onClick={() => {
              setIsPaused(prev => !prev)
              setShowDecimal(false)
              // Update URL based on pause state
              if (!isPaused) {
                const url = new URL(window.location.href)
                url.searchParams.set('t', currentMinute.toString())
                window.history.replaceState({}, '', url.toString())
              } else {
              // Clear URL param when playing
                const url = new URL(window.location.href)
                url.searchParams.delete('t')
                window.history.replaceState({}, '', url.toString())
              }
            }}>
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button
              onClick={() => {
                if (isPaused) {
                  const baseTime = isTransitioning ? targetTime : displayTime
                  const newTime = (baseTime - 1 + 60) % 60
                  setTargetTime(newTime)
                  setIsTransitioning(true)
                  setShowDecimal(false)

                  // Update URL
                  const url = new URL(window.location.href)
                  url.searchParams.set('t', newTime.toFixed(1))
                  window.history.replaceState({}, '', url.toString())
                }
              }}
              disabled={!isPaused}
              title="Step backward 1 minute">
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                if (isPaused) {
                  const baseTime = isTransitioning ? targetTime : displayTime
                  const newTime = (baseTime + 1) % 60
                  setTargetTime(newTime)
                  setIsTransitioning(true)
                  setShowDecimal(false)

                  // Update URL
                  const url = new URL(window.location.href)
                  url.searchParams.set('t', newTime.toFixed(1))
                  window.history.replaceState({}, '', url.toString())
                }
              }}
              disabled={!isPaused}
              title="Step forward 1 minute">
              <ChevronRight size={18} />
            </button>
          </div>
          <label
            data-tooltip-id="speed-tooltip"
            data-tooltip-content="Simulation speed: virtual minutes per real-world second">
            Speed: {speed}x
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            />
          </label>
          <span className="hint">Space: ▶/⏸ | ←/→: ±1 min | ⌥←/→: ±0.1 min</span>
        </div>
      </div>

      <div className="timelines">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: COMPUTED_LAYOUT.SVG_WIDTH,
          margin: '0 auto',
          gap: '20px'
        }}>
          <div className="timeline-section timeline-section-left" style={{
            marginLeft: `${LAYOUT.QUEUE_AREA_WIDTH}px`
          }}>
            <h3>Eastbound Timeline</h3>
            <ul>
              {generateTimeline(eb).map((entry, i) => {
                const isCurrentPhase = entry.end > entry.start
                  ? currentMinute >= entry.start && currentMinute < entry.end
                  : currentMinute >= entry.start || currentMinute < entry.end // Wraps around hour

                return (
                  <li
                    key={i}
                    className={`timeline-item ${isCurrentPhase ? 'current-phase' : ''}`}
                    onClick={() => handleTimelineClick(entry.start)}>
                    :{String(entry.start).padStart(2, '0')}-:{String(entry.end).padStart(2, '0')} - {entry.label}
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="timeline-section timeline-section-right" style={{
            marginRight: `${LAYOUT.FADE_DISTANCE_PX}px`
          }}>
            <h3>Westbound Timeline</h3>
            <ul>
              {generateTimeline(wb).map((entry, i) => {
                const isCurrentPhase = entry.end > entry.start
                  ? currentMinute >= entry.start && currentMinute < entry.end
                  : currentMinute >= entry.start || currentMinute < entry.end // Wraps around hour

                return (
                  <li
                    key={i}
                    className={`timeline-item ${isCurrentPhase ? 'current-phase' : ''}`}
                    onClick={() => handleTimelineClick(entry.start)}>
                    :{String(entry.start).padStart(2, '0')}-:{String(entry.end).padStart(2, '0')} - {entry.label}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="info-sections">
        <div className="info-section">
          <h2>Why?</h2>
          <ol>
            <li>There's no way to bike or walk between NYC and Hudson County (not OK!)</li>
            <li>No one has a plan to fix this in the next 10 years (not OK!)</li>
            <li>Bikes can fit more people (during a 10mins/hr window) than cars</li>
            <li>Alleviates weekend PATH over-crowding</li>
            <li>Holland Tunnel is worst-performing Hudson River crossing (bc 98% 1-person cars)</li>
          </ol>
        </div>

        <div className="info-section">
          <h2>How?</h2>
          <ul>
            <li>Bikes queue for most of each hour.</li>
            <li>Bikes allowed into tunnel for a 3-minute "pulse" each hour</li>
            <li>Cars restricted from 1 lane for 10mins</li>
            <li>Bikes have 12-15mins to cross</li>
            <li>Requires just 2 official vehicles:
              <ul>
                <li>"Sweep" van (picks up stragglers)</li>
                <li>"Pace car" (reopens lane to cars)</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <a href="https://github.com/hudcostreets/ht" target="_blank" rel="noopener noreferrer" className="github-link">
            <svg height="24" width="24" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span>View on GitHub</span>
          </a>
          <a href="https://hudcostreets.org" target="_blank" rel="noopener noreferrer" className="hccs-logo">
            Hudson County Complete Streets
          </a>
        </div>
      </footer>
    </div>
  )
}
