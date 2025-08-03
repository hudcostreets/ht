import { useState, useEffect, useCallback, useRef } from 'react'
import { Tooltip } from 'react-tooltip'
import useSessionStorageState from 'use-session-storage-state'
import { AnalogClock } from './AnalogClock'
import { Tunnel } from './Tunnel.tsx'
import { HOLLAND_TUNNEL_CONFIG } from '../models/TunnelConfigs'
import { Tunnels } from '../models/Tunnels'
import './HollandTunnel.css'

// Create the tunnels instance
const tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
const { eb, wb, sweep, pace } = tunnels

export function HollandTunnel() {
  // Check URL parameter for initial time
  const urlParams = new URLSearchParams(window.location.search)
  const urlMinute = urlParams.get('t')
  const initialMinute = urlMinute !== null ? parseInt(urlMinute, 10) % 60 : 0

  const [currentMinute, setCurrentMinute] = useSessionStorageState<number>('ht-current-minute', {
    defaultValue: initialMinute
  })
  const [isPaused, setIsPaused] = useSessionStorageState<boolean>('ht-is-paused', {
    defaultValue: urlMinute !== null // Pause if URL param is set
  })
  const [speed, setSpeed] = useSessionStorageState<number>('ht-speed', {
    defaultValue: 1
  })

  // Animation for smooth transitions (in minutes)
  const [displayTime, setDisplayTime] = useState(initialMinute)
  const animationRef = useRef<number | undefined>(undefined)

  // State for arrow key transitions
  const [targetTime, setTargetTime] = useState(initialMinute)
  const [isTransitioning, setIsTransitioning] = useState(false)

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
      } else if (e.code === 'ArrowRight' && isPaused) {
        e.preventDefault()
        const baseTime = isTransitioning ? targetTime : displayTime
        const currentMinute = Math.floor(baseTime) % 60
        const newMin = (currentMinute + 1) % 60
        setTargetTime(newMin)
        setIsTransitioning(true)

        // Update URL
        const url = new URL(window.location.href)
        url.searchParams.set('t', newMin.toString())
        window.history.replaceState({}, '', url.toString())
      } else if (e.code === 'ArrowLeft' && isPaused) {
        e.preventDefault()
        const baseTime = isTransitioning ? targetTime : displayTime
        const currentMinute = Math.floor(baseTime) % 60
        const newMin = (currentMinute - 1 + 60) % 60
        setTargetTime(newMin)
        setIsTransitioning(true)

        // Update URL
        const url = new URL(window.location.href)
        url.searchParams.set('t', newMin.toString())
        window.history.replaceState({}, '', url.toString())
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPaused, isTransitioning, targetTime, displayTime, setIsPaused])

  // Get current vehicles and phases
  const phases = tunnels.getPhases(displayTime)
  const colorRectangles = tunnels.getColorRectangles(displayTime)

  // Handle timeline click
  const handleTimelineClick = (minute: number) => {
    const newTime = minute
    // Jump directly to the new time (no transition)
    setDisplayTime(newTime)
    setTargetTime(newTime)
    setIsTransitioning(false)
    setIsPaused(true)

    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('t', minute.toString())
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div className="holland-tunnel">
      <Tooltip id="vehicle-tooltip" />

      <div className="header">
        <div className="header-content">
          <h1>Holland Tunnel Bike Lane Visualization</h1>
          <div className="controls">
            <button onClick={() => {
              setIsPaused(prev => !prev)
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
              {isPaused ? 'Play' : 'Pause'}
            </button>
            <label>
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
            <span className="hint">Space: play/pause | ←/→: step by 1 minute</span>
          </div>
        </div>
        <div className="clock-container-large">
          <AnalogClock minute={displayTime} />
          <div className="digital-time-large">
            0:{String(Math.floor(displayTime) % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="tunnel-visualization-svg">
        <svg width="1100" height="400" viewBox="0 0 1100 400">
          {/* Both tunnels */}
          <Tunnel
            dir="west"
            displayTime={displayTime}
            phase={phases.west}
            tunnel={wb}
            colorRectangles={colorRectangles}
          />

          <Tunnel
            dir="east"
            displayTime={displayTime}
            phase={phases.east}
            tunnel={eb}
            colorRectangles={colorRectangles}
          />
        </svg>
      </div>

      <div className="legend">
        <div className="timeline-section">
          <h3>Eastbound Timeline</h3>
          <ul>
            <li className={`timeline-item ${currentMinute < 45 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(0)}>:00-:44 - Normal traffic (cars)</li>
            <li className={`timeline-item ${currentMinute >= 45 && currentMinute < 48 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(45)}>:45-:47 - Bikes enter tunnel</li>
            <li className={`timeline-item ${currentMinute >= 48 && currentMinute < 50 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(48)}>:48-:49 - Clearing phase</li>
            <li className={`timeline-item ${currentMinute >= 50 && currentMinute < 55 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(50)}>:50-:54 - Sweep vehicle</li>
            <li className={`timeline-item ${currentMinute >= 55 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(55)}>:55-:59 - Pace car + cars resume</li>
          </ul>
        </div>
        <div className="timeline-section">
          <h3>Westbound Timeline</h3>
          <ul>
            <li className={`timeline-item ${(currentMinute >= 30 || currentMinute < 15) ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(30)}>:30-:14 - Normal traffic (cars)</li>
            <li className={`timeline-item ${currentMinute >= 15 && currentMinute < 18 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(15)}>:15-:17 - Bikes enter tunnel</li>
            <li className={`timeline-item ${currentMinute >= 18 && currentMinute < 20 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(18)}>:18-:19 - Clearing phase</li>
            <li className={`timeline-item ${currentMinute >= 20 && currentMinute < 25 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(20)}>:20-:24 - Sweep vehicle</li>
            <li className={`timeline-item ${currentMinute >= 25 && currentMinute < 30 ? 'current-phase' : ''}`} onClick={() => handleTimelineClick(25)}>:25-:29 - Pace car + cars resume</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>About</h3>
          <ul>
            <li>Two-directional cycling infrastructure</li>
            <li>30-minute offset between directions</li>
            <li>Protected bike time with clearing phases</li>
            <li>15 bikes per hour (0.25/min)</li>
            <li>60 cars per hour per lane (1/min)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
