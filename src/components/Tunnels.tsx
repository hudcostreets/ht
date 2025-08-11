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
import { getHollandTunnelConfig } from '../models/TunnelConfigs'
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
  // const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

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
    return new HT(getHollandTunnelConfig())
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

  // Ref for Ward Tour video
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasPlayedRef = useRef(false)

  // State for controls tooltip
  const [showControls, setShowControls] = useState(false)
  const [controlsSticky, setControlsSticky] = useState(false) // Track if clicked (sticky) vs hovered

  // Auto-play video when it comes into view
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPlayedRef.current) {
            video.play().catch(err => {
              // Auto-play might be blocked by browser
              console.log('Auto-play prevented:', err)
            })
            hasPlayedRef.current = true
          }
        })
      },
      { threshold: 0.5 } // Trigger when 50% of video is visible
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

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

  // Helper functions for controls
  const isPlaying = !isPaused
  const togglePlay = () => {
    setIsPaused(prev => !prev)
    setShowDecimal(false)
    // Update URL based on pause state
    if (!isPaused) {
      const url = new URL(window.location.href)
      url.searchParams.set('t', displayTime.toString())
      window.history.replaceState({}, '', url.toString())
    } else {
      // Clear URL param when playing
      const url = new URL(window.location.href)
      url.searchParams.delete('t')
      window.history.replaceState({}, '', url.toString())
    }
  }

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

      <div className="holland-tunnel-container">
        <h1 style={{
          margin: '0 0 5px 0',
          textAlign: 'left',
          color: '#000',      // $text-color from SCSS
          fontSize: '1.8rem'  // Original size from .header h1
        }}>The Holland Tunnel should have a bike lane</h1>
        <h2 style={{
          margin: '0',
          fontSize: '1.2rem',         // Original size from .header h2
          fontWeight: 'normal',       // Original weight from .header h2
          color: '#333',              // $text-secondary from SCSS
          textAlign: 'left',
          display: 'inline-block',    // Make width fit content
          position: 'relative',       // Create stacking context
          zIndex: 10,                 // Appear above SVG
          backgroundColor: '#f5f5f5', // Match page background to ensure readability
          paddingRight: '10px'        // Small padding for visual breathing room
        }}>(for 10mins per hour)</h2>
        <div className="tunnel-visualization-svg" style={{
          position: 'relative',  // Add relative positioning for absolute children
          marginTop: (() => {
            // Check if we should slide up
            const wbPenX = wb.config.pen.x + LAYOUT.QUEUE_AREA_WIDTH
            const headerEndX = 400 // Approximate x where header text ends
            const penOverlapsHeader = wbPenX < headerEndX

            if (!penOverlapsHeader && windowSize.width > 600) {
              // Calculate slide-up amount
              // Goal: align W/b pen top with h2 top
              // h1 is ~40px, h2 starts at y=40
              // W/b pen top is at y=35 (100 + (-65))
              // Since we removed 20px of header padding, reduce slide-up by that amount
              return '-30px'  // Was -50px, now -30px
            }
            return '0'
          })(),
          overflow: 'visible'
        }}>
          <div style={{
            position: 'relative',
            width: '100%'  // Full width of visualization container
          }}>
            {(() => {
              // Calculate SVG height based on actual content
              const wbTunnelTop = wb.config.y // W/b tunnel top
              const wbPenTop = wb.config.y + wb.config.pen.y // W/b pen top (tunnel y + pen y offset)
              // const ebTunnelBottom = eb.config.y + LAYOUT.LANE_HEIGHT * 2 // E/b tunnel bottom (2 lanes)

              // Calculate bottom elements
              const legendY = eb.config.y + eb.config.pen.y + 10
              const LEGEND_HEIGHT = 82 // Height to last legend item
              const TEXT_PADDING = 5 // Extra padding for text height
              const LABEL_HEIGHT = 15 // Height for pen label
              const legendBottom = legendY + LEGEND_HEIGHT + TEXT_PADDING
              const ebPenBottom = eb.config.y + eb.config.pen.y + eb.config.pen.h + LABEL_HEIGHT

              // Clock is now embedded and sized to align with legend/pen
              const clockBottom = Math.max(legendBottom, ebPenBottom)

              // Calculate viewBox parameters
              const TOP_PADDING = 10
              const BOTTOM_PADDING = 10

              // Find the actual top of all content
              // Always need to include the W/b pen in the viewBox
              const contentTop = Math.min(wbPenTop, wbTunnelTop)

              // Simple viewBox calculation - always include all content with padding
              const svgViewBoxY = contentTop - TOP_PADDING
              const svgViewBoxHeight = (clockBottom + BOTTOM_PADDING) - svgViewBoxY

              return (
                <svg
                  key={`svg-${windowSize.width}`} // Force re-render on viewport change
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

                  {/* NJ | NY label at tunnel midpoint - hide on narrow screens */}
                  {windowSize.width > 500 && (
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
                  )}

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
                          data-tooltip-id="vehicle-tooltip"
                          data-tooltip-content={type === 'sweep' ?
                            'Sweep van: Clears the lane for bikes at 12 mph' :
                            'Pace car: Leads cars back into the lane at 20 mph'}
                        >
                          {type === 'sweep' ? '🚐' : '🚓'}
                        </text>
                      )
                    })
                  }, [displayTime])}

                  {/* Legend positioned to the right of E/b bike pen */}
                  {(() => {
                    // Position legend to the right of the E/b bike pen
                    // On narrow screens, move it closer to save space
                    const legendSpacing = windowSize.width <= 500 ? 10 : 20
                    const legendX = LAYOUT.QUEUE_AREA_WIDTH + eb.config.pen.x + eb.config.pen.w + legendSpacing
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

                        {/* Settings gear icon */}
                        {(() => {
                          let gearX, gearCenterY, gearSize

                          if (windowSize.width <= 500) {
                            // On narrow screens, place gear inline with Legend title
                            gearX = legendX + 68  // More space from "Legend" text
                            gearCenterY = legendY - 6  // Move up more to align with text center
                            gearSize = 20  // Even bigger for better visibility
                          } else {
                            // On wider screens, position in the pocket above legend
                            const ebTunnelBottom = eb.config.y + LAYOUT.LANE_HEIGHT * 2
                            const sweepTextTop = legendY + 55  // Top of Sweep line

                            const GEAR_PADDING = 20
                            const gearTop = ebTunnelBottom + GEAR_PADDING
                            const gearBottom = sweepTextTop - GEAR_PADDING
                            gearSize = Math.max(10, gearBottom - gearTop)
                            gearCenterY = (gearTop + gearBottom) / 2
                            gearX = legendX + 140  // Closer to legend items
                          }

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
                    const CLOCK_TOP_OFFSET = windowSize.width <= 500 ? 70 : 65 // More offset on narrow screens
                    const clockTop = eb.config.y + CLOCK_TOP_OFFSET
                    let clockSize = targetBottom - clockTop // Make clock big enough to reach bottom
                    // Slightly smaller clock on narrow screens to leave room for gear
                    if (windowSize.width <= 500) {
                      clockSize = Math.min(clockSize, 70) // Max 70px on narrow screens
                    }
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

            {/* Controls popover - positioned outside SVG as tooltip below gear */}
            {showControls && (() => {
              // Calculate gear position in SVG coordinates - must match the SVG gear positioning exactly
              const legendSpacing = windowSize.width <= 500 ? 10 : 20
              const legendX = LAYOUT.QUEUE_AREA_WIDTH + eb.config.pen.x + eb.config.pen.w + legendSpacing
              const legendY = eb.config.y + eb.config.pen.y + 10

              let gearX, gearY, gearSize
              if (windowSize.width <= 500) {
                // On narrow screens, place gear inline with Legend title
                gearX = legendX + 68  // More space from "Legend" text
                gearY = legendY - 6  // Move up more to align with text center
                gearSize = 20  // Even bigger for better visibility
              } else {
                // On wider screens, position in the pocket above legend
                const ebTunnelBottom = eb.config.y + LAYOUT.LANE_HEIGHT * 2
                const sweepTextTop = legendY + 55  // Top of Sweep line
                const GEAR_PADDING = 20
                const gearTop = ebTunnelBottom + GEAR_PADDING
                const gearBottom = sweepTextTop - GEAR_PADDING
                gearSize = Math.max(10, gearBottom - gearTop)
                gearY = (gearTop + gearBottom) / 2
                gearX = legendX + 140  // Closer to legend items
              }

              // Calculate position for popover to appear below gear
              const popoverWidth = windowSize.width <= 500 ? 200 : 250
              const popoverLeft = gearX - popoverWidth / 2  // Center under gear
              // gearY is center, gearSize/2 is radius, plus circle stroke and gap
              // On desktop, gear can be larger so we need less additional gap
              const strokeWidth = windowSize.width <= 500 ? 2 : 2
              const gap = windowSize.width <= 500 ? 3 : -5  // Negative gap on desktop to compensate for larger gear
              const popoverTop = gearY + gearSize / 2 + strokeWidth + gap

              return (
                <div
                  className="controls-popover"
                  style={{
                    position: 'absolute',
                    left: `${popoverLeft}px`,
                    top: `${popoverTop}px`,
                    width: `${popoverWidth}px`,
                    background: 'white',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    fontSize: '14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>Playback Controls</h3>
                    <button
                      onClick={() => {
                        setShowControls(false)
                        setControlsSticky(false)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '0',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="button-group" style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setDisplayTime(Math.max(0, displayTime - 1))} disabled={displayTime === 0}>
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={togglePlay}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button onClick={() => setDisplayTime(Math.min(59, displayTime + 1))} disabled={displayTime === 59}>
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                      Speed: {speed}x
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                    </label>

                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
                      <div><strong>Keyboard shortcuts:</strong></div>
                      <div>Space: Play/Pause</div>
                      <div>←/→: Step ±1 minute</div>
                      <div>⌥←/→: Step ±0.1 minute</div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

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

          - It should be possible to walk or bike between Hudson County and NYC (it's not, today)
          - No one has a plan to make it possible within 10 years (not acceptable)
          - [Bikes can transport more people per lane-minute than cars][wt], deserve a little time to do so
          - This will help alleviate [PATH overcrowding], reduce (e)bikes on crowded PATH trains
          - [The Holland Tunnel is the worst-performing Hudson River crossing][hudson-transit]
          - [The Port Authority should start piloting this on weekends][AN]

          [wt]: #wt
          [hudson-transit]: https://github.com/hudcostreets/hudson-transit
          [PATH overcrowding]: https://photos.app.goo.gl/7cL6phf51MSDcBT59
          [AN]: https://hudcostreets.org/panynj
        `)}
          </div>
        </div>

        {/* Appendix: Ward Tour video */}
        <div id="wt" className="appendix-container first">
          <div className="appendix-section with-video">
            <div className="text-content">
              <h2>Appendix: more bikes than cars per lane-minute</h2>
              <p>
                <A href={"https://www.instagram.com/p/DKXr7giSaeK/"}>Here's</A> 2,000 cyclists using 1-2 car lanes in 5 minutes (during <A href={"https://www.bikejc.org/ward-tour"}>the Jersey City Ward Tour</A>).
              </p>
              <p>
                That's more throughput than cars achieve all year (including on highways like JFK and 139), on the one hour per year when bikes can use them safely.
              </p>
            </div>
            <div className="video-content">
              <video
                ref={videoRef}
                controls
                muted
                playsInline
                onEnded={() => {
                  // Add a visual cue that video can be replayed
                  if (videoRef.current) {
                    videoRef.current.style.opacity = '0.8'
                  }
                }}
                onClick={(e) => {
                  const video = e.currentTarget
                  // Only handle click if video has ended
                  // This avoids interfering with native controls
                  if (video.ended) {
                    video.currentTime = 0
                    video.style.opacity = '1'
                    video.play()
                  }
                }}
                style={{
                  maxWidth: '100%',
                  maxHeight: '500px',
                  width: 'auto',
                  height: 'auto',
                  borderRadius: '6px',
                  background: '#000',
                  cursor: 'pointer'
                }}
              >
                <source src="/wt.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>

        {/* Appendix: Space-Time Diagram */}
        <div id="spacetime" className="appendix-container last">
          <div className="appendix-section">
            <SpaceTimeRects currentMinute={displayTime} eb={eb} wb={wb} />
          </div>
        </div>
      </div> {/* End holland-tunnel-container */}

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
