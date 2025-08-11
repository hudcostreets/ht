import { A } from "@rdub/base"
import { icons } from '@rdub/icons'
import { Play, Pause, ChevronLeft, ChevronRight, ArrowLeftRight, Settings } from 'lucide-react'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Tooltip } from 'react-tooltip'
import useSessionStorageState from 'use-session-storage-state'
import { AnalogClock } from './AnalogClock'
import { MD } from './MD'
import { SpaceTimeRects } from './SpaceTimeRects'
import { Tunnel } from './Tunnel.tsx'
import { LAYOUT, COMPUTED_LAYOUT } from '../models/Constants'
import { HOLLAND_TUNNEL_CONFIG } from '../models/TunnelConfigs'
import { Tunnels as HT } from '../models/Tunnels'
import './Tunnels.scss'

const Icons = icons({})
const { GitHub, HudCoStreets } = Icons

// Generate timeline entries from config
function generateTimeline(tunnel: any) {
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
    label: 'Pace car (cars resume)',
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
  // Track window size for responsive layout
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  // Detect if device is mobile (touch-capable only, not just narrow screens)
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }, 100) // Debounce for 100ms
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  // Recreate tunnels when window size changes
  const tunnels = useMemo(() => {
    return new HT(HOLLAND_TUNNEL_CONFIG)
  }, [windowSize.width]) // Only recreate when width changes

  const { eb, wb } = tunnels

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
    defaultValue: 2.5
  })

  // Animation for smooth transitions (in minutes)
  const [displayTime, setDisplayTime] = useState(initialMinute)
  const animationRef = useRef<number | undefined>(undefined)

  // State for arrow key transitions
  const [targetTime, setTargetTime] = useState(initialMinute)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showDecimal, setShowDecimal] = useState(false)

  // State for timeline direction toggle
  const [timelineDirection, setTimelineDirection] = useState<'east' | 'west'>('east')

  // State for controls tooltip
  const [showControls, setShowControls] = useState(false)
  const [controlsSticky, setControlsSticky] = useState(false) // Track if clicked (sticky) vs hovered

  // Handle clicks outside the controls to close sticky mode
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the gear and the controls popover
      const target = e.target as Element
      if (controlsSticky &&
          !target.closest('.controls-popover') &&
          !target.closest('.settings-gear')) {
        setShowControls(false)
        setControlsSticky(false)
      }
    }

    if (controlsSticky) {
      // Use capture phase and add a small delay to avoid conflicts with button clicks
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true)
      }, 100)
      return () => document.removeEventListener('click', handleClickOutside, true)
    }
  }, [controlsSticky])

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
        <div className="header-content" style={{
          display: 'inline-block',
          textAlign: 'left'
        }}>
          <h1>The Holland Tunnel should have a bike lane</h1>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2a2a2a' }}>(for 10mins per hour)</h2>
        </div>
      </div>

      <div className="tunnel-visualization-svg" style={{
        // Slide up when there's sufficient width (W/b pen fits next to left-aligned header)
        marginTop: (() => {
          // With left-aligned header, we have more room on the right for the W/b pen
          // Only need to check width now since the pen can fit next to the header text
          if (windowSize.width <= 600) return '0'

          // On wider screens, slide up to utilize header space
          // Reduced from -40px to -30px to leave more breathing room
          return '-30px'
        })(),
        overflow: 'visible'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: COMPUTED_LAYOUT.SVG_WIDTH,
          margin: '0 auto'
        }}>
          {(() => {
            // Calculate SVG height based on actual content
            const wbTunnelTop = wb.config.y // W/b tunnel top
            const wbPenTop = wb.config.y + wb.config.pen.y // W/b pen top (tunnel y + pen y offset)
            const ebTunnelBottom = eb.config.y + LAYOUT.LANE_HEIGHT * 2 // E/b tunnel bottom (2 lanes)

            // Calculate bottom elements
            const legendY = eb.config.y + eb.config.pen.y + 10
            const LEGEND_HEIGHT = 82 // Height to last legend item
            const TEXT_PADDING = 5 // Extra padding for text height
            const LABEL_HEIGHT = 15 // Height for pen label
            const legendBottom = legendY + LEGEND_HEIGHT + TEXT_PADDING
            const ebPenBottom = eb.config.y + eb.config.pen.y + eb.config.pen.h + LABEL_HEIGHT

            // Clock is now embedded and sized to align with legend/pen
            const clockBottom = Math.max(legendBottom, ebPenBottom)

            // Find the actual top of all content (W/b pen is typically highest)
            const contentTop = Math.min(wbPenTop, wbTunnelTop)

            // Set height with minimal padding
            const topPadding = 10 // Small padding above content
            const bottomPadding = 10 // Small padding below content
            const svgViewBoxY = contentTop - topPadding // Keep viewBox consistent
            const svgViewBoxHeight = (clockBottom + bottomPadding) - svgViewBoxY

            return (
              <svg
                width="100%"
                viewBox={`0 ${svgViewBoxY} ${COMPUTED_LAYOUT.SVG_WIDTH} ${svgViewBoxHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ height: 'auto', display: 'block' }}>
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
                  y={180}  // Midpoint: W/b bottom (160) + gap to E/b top (200) = 180
                  fontSize="18"  // Increased from 14
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"  // Vertically center the text
                  fill="#333"
                  opacity="0.6"
                  style={{ userSelect: 'none' }}
                >
                  NJ | NY
                </text>

                {/* Clock digital display in space between tunnels */}
                <text
                  x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH - 10}  // Right-aligned in tunnel area
                  y={180}  // Same vertical position as NJ | NY
                  fontSize="22"  // Increased from 18
                  fontWeight="bold"
                  textAnchor="end"
                  dominantBaseline="middle"  // Vertically center the text
                  fill="#333"
                  style={{ userSelect: 'none' }}
                >
                  :{showDecimal
                    ? displayTime.toFixed(1).padStart(4, '0')
                    : String(Math.floor(displayTime) % 60).padStart(2, '0')}
                </text>

                {/* Global vehicles (Sweep and Pace) */}
                {useMemo(() => {
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
                }, [displayTime])}

                {/* Legend positioned to the right of E/b bike pen */}
                {(() => {
                  // Position legend to the right of the E/b bike pen
                  const legendX = LAYOUT.QUEUE_AREA_WIDTH + eb.config.pen.x + eb.config.pen.w + 20
                  const legendY = eb.config.y + eb.config.pen.y + 10

                  return (
                    <>
                      <g transform={`translate(${legendX}, ${legendY})`}>
                        <text x="0" y="0" fontSize="14" fontWeight="bold" style={{ userSelect: 'none' }}>Legend</text>

                        {/* Green rect - bike space */}
                        <rect x="0" y="10" width="20" height="10" fill="#4caf50" opacity="0.3" />
                        <text x="25" y="19" fontSize="12" style={{ userSelect: 'none' }}>Bike space</text>

                        {/* Red rect - buffer */}
                        <rect x="0" y="25" width="20" height="10" fill="#f44336" opacity="0.3" />
                        <text x="25" y="34" fontSize="12" style={{ userSelect: 'none' }}>Buffer</text>

                        {/* Grey rect - car space */}
                        <rect x="0" y="40" width="20" height="10" fill="#666" />
                        <text x="25" y="49" fontSize="12" style={{ userSelect: 'none' }}>Car space</text>

                        {/* Sweep icon */}
                        <text x="10" y="65" fontSize="16" textAnchor="middle" style={{ userSelect: 'none' }}>🚐</text>
                        <text x="25" y="65" fontSize="12" style={{ userSelect: 'none' }}>"Sweep" clears stragglers</text>

                        {/* Pace icon */}
                        <text x="10" y="82" fontSize="16" textAnchor="middle" style={{ userSelect: 'none' }}>🚓</text>
                        <text x="25" y="82" fontSize="12" style={{ userSelect: 'none' }}>"Pace car" reopens 🚗 lane</text>
                      </g>

                      {/* Settings gear icon positioned in the pocket above legend */}
                      {(() => {
                        // Position gear between E/b tunnel bottom and Sweep legend entry
                        // E/b tunnel bottom is at eb.config.y + 60 (2 lanes)
                        // Sweep text baseline is at legendY + 65, but we need to stop above the text
                        const ebTunnelBottom = eb.config.y + LAYOUT.LANE_HEIGHT * 2
                        const sweepTextTop = legendY + 55  // Top of Sweep line (65 - ~10 for text height)

                        const GEAR_PADDING = 20 // Even more padding for smaller gear
                        const gearTop = ebTunnelBottom + GEAR_PADDING
                        const gearBottom = sweepTextTop - GEAR_PADDING
                        const gearSize = gearBottom - gearTop
                        const gearCenterY = (gearTop + gearBottom) / 2
                        const gearX = legendX + 140  // Closer to legend items

                        return (
                          <>
                            <g
                              className="settings-gear"
                              transform={`translate(${gearX}, ${gearCenterY})`}
                              onClick={(e) => {
                                e.stopPropagation()
                                // Toggle controls
                                setShowControls(!showControls)
                                setControlsSticky(!showControls)
                              }}
                              style={{ cursor: 'pointer' }}
                              data-gear-x={gearX}
                              data-gear-y={gearCenterY}
                            >
                              <circle
                                cx="0"
                                cy="0"
                                r={gearSize/2 + 2}
                                fill={showControls ? "#e3f2fd" : "#f5f5f5"}
                                stroke={showControls ? "#2196f3" : "#ddd"}
                                strokeWidth={showControls ? "2" : "1"}
                              />
                              <Settings
                                x={-gearSize/2}
                                y={-gearSize/2}
                                size={gearSize}
                                color={showControls ? "#1976d2" : "#666"}
                              />
                            </g>
                          </>
                        )
                      })()}
                    </>
                  )
                })()}

                {/* Embedded clock positioned right-aligned with tunnel exit */}
                {(() => {
                  // Calculate legend and bike pen bottom for alignment
                  const ebPenY = eb.config.y + eb.config.pen.y
                  const ebPenBottom = ebPenY + eb.config.pen.h
                  const legendY = ebPenY + 10
                  const LEGEND_HEIGHT = 82 // Height to last legend item
                  const TEXT_PADDING = 5 // Extra padding for text height
                  const legendBottom = legendY + LEGEND_HEIGHT + TEXT_PADDING
                  const targetBottom = Math.max(ebPenBottom, legendBottom)

                  // Position clock tightly below E/b tunnel, sized to reach the bottom alignment
                  const CLOCK_TOP_OFFSET = 65 // Distance below E/b tunnel bottom
                  const clockTop = eb.config.y + CLOCK_TOP_OFFSET
                  const clockSize = targetBottom - clockTop // Make clock big enough to reach bottom
                  const clockX = LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH - clockSize // Right edge aligns with tunnel
                  const clockY = clockTop

                  return (
                    <>
                      <AnalogClock
                        minute={displayTime}
                        size={clockSize}
                        x={clockX}
                        y={clockY}
                        embedded={true}
                      />
                    </>
                  )
                })()}
              </svg>
            )
          })()}

          {/* Clock positioned below E/b exit - REMOVED, now embedded in SVG above */}
        </div>
      </div>

      {/* Controls popover/tooltip */}
      {showControls && (() => {
        // Calculate gear position in viewport coordinates
        const gearElement = document.querySelector('.settings-gear')
        const svgElement = document.querySelector('.tunnel-visualization-svg svg')
        let popupStyle: React.CSSProperties = {
          position: 'fixed',
          background: 'white',
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          minWidth: '300px'
        }

        if (gearElement && svgElement) {
          const svgRect = svgElement.getBoundingClientRect()
          const gearTransform = gearElement.getAttribute('transform')
          const match = gearTransform?.match(/translate\(([^,]+),([^)]+)\)/)

          if (match) {
            const gearX = parseFloat(match[1])
            const gearY = parseFloat(match[2])

            // Convert SVG coordinates to viewport coordinates
            const svgViewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 400]
            const scaleX = svgRect.width / svgViewBox[2]
            const scaleY = svgRect.height / svgViewBox[3]

            const gearScreenX = svgRect.left + (gearX - svgViewBox[0]) * scaleX
            const gearScreenY = svgRect.top + (gearY - svgViewBox[1]) * scaleY

            // Always position below gear, centered horizontally
            popupStyle.left = `${gearScreenX}px`
            popupStyle.top = `${gearScreenY + 30}px`
            popupStyle.transform = 'translateX(-50%)'
          }
        }

        return (
          <div className="controls-popover"
            onClick={(e) => e.stopPropagation()}
            style={popupStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Playback Controls</h3>
            <button
              onClick={() => {
                setShowControls(false)
                setControlsSticky(false)
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0',
                color: '#666'
              }}
            >×</button>
          </div>
          <div className="button-group" style={{ marginBottom: '15px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
            }} style={{ padding: '8px 12px', fontSize: '16px', border: 'none', borderRadius: '6px', background: '#007bff', color: 'white', cursor: 'pointer' }}>
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
              title="Step backward 1 minute"
              style={{ padding: '8px 12px', fontSize: '16px', border: 'none', borderRadius: '6px', background: '#007bff', color: 'white', cursor: 'pointer', opacity: isPaused ? 1 : 0.5 }}>
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
              title="Step forward 1 minute"
              style={{ padding: '8px 12px', fontSize: '16px', border: 'none', borderRadius: '6px', background: '#007bff', color: 'white', cursor: 'pointer', opacity: isPaused ? 1 : 0.5 }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ fontSize: '14px' }}>Speed: {speed}x</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
          {!isMobile && (
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
              <div><strong>Keyboard shortcuts:</strong></div>
              <div>Space: Play/Pause</div>
              <div>←/→: Step ±1 minute</div>
              <div>⌥←/→: Step ±0.1 minute</div>
            </div>
          )}
        </div>
        )
      })()}

      <div className="timeline-and-how">
        <div className="timeline-section">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px'
          }}>
            <h2 style={{ margin: 0 }}>Timeline ({timelineDirection === 'east' ? 'Eastbound' : 'Westbound'})</h2>
            <button
              onClick={() => setTimelineDirection(prev => prev === 'east' ? 'west' : 'east')}
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '14px'
              }}
              title="Switch direction"
            >
              <ArrowLeftRight size={14} />
            </button>
          </div>
          <ul>
            {generateTimeline(timelineDirection === 'east' ? eb : wb).map((entry, i) => {
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

        <div className="how-section">
          <h2 style={{ margin: '0 0 10px 0' }}>How</h2>
          <ul>
            <li>Bikes get a 3-minute "pulse" each hour (like catching a train)</li>
            <li>Cars restricted from 1 lane for 10mins (<a href={`#spacetime`}>&lt;10% of total space/time</a>)</li>
            <li>Bikes get 12-15mins to cross</li>
            <li>2 official vehicles:
              <ul>
                <li>"Sweep" van (picks up stragglers)</li>
                <li>"Pace car" (reopens lane to cars)</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <div className="why-section-container">
        <div className="why-section">{MD(`
          ## Why

          - It should be possible to walk or bike between Hudson County and NYC
          - It's not possible today
          - No one has a plan to make it possible within 10 years
          - That's not acceptable
          - Bikes can transport more people per lane-minute than cars [^1]
          - We deserve a small fraction of the time, to do so
          - This will help alleviate PATH overcrowding
          - No one wants people taking (e)bikes on crowded PATH trains
          - The Holland Tunnel is the worst-performing Hudson River crossing [^2]
          - We should start piloting this on weekends

          [^1]: https://www.instagram.com/p/DKXr7giSaeK/
          [^2]: https://github.com/hudcostreets/hudson-transit
        `)}
        </div>
      </div>

      {/* SpaceTimeWheel visualization - larger and centered */}
      {/*<div style={{*/}
      {/*  display: 'flex',*/}
      {/*  justifyContent: 'center',*/}
      {/*  alignItems: 'center',*/}
      {/*  margin: '40px 0',*/}
      {/*  transform: 'scale(2.0)'*/}
      {/*}}>*/}
      {/*  <SpaceTimeWheel currentMinute={displayTime} tunnel={eb} />*/}
      {/*</div>*/}

      {/* SpaceTimeRects visualization - centered */}
      <div id={"spacetime"} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0'
      }}>
        <SpaceTimeRects currentMinute={displayTime} eb={eb} wb={wb} />
      </div>

      <footer className="footer">
        <div className="socials">
          <HudCoStreets className="icon" />
          <GitHub repo="hudcostreets/ht" className="icon" />
          <div className="footer-text">
            <a href="https://hudcostreets.org" target="_blank" rel="noopener noreferrer">Hudson County Complete Streets</a>
            <br />
            <a href="https://github.com/hudcostreets/ht" target="_blank" rel="noopener noreferrer">Code on GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
