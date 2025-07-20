import { useState, useEffect, useCallback, useRef } from 'react'
import { Tooltip } from 'react-tooltip'
import useSessionStorageState from 'use-session-storage-state'
import { AnalogClock } from './AnalogClock'
import { Car } from '../models/EnhancedVehicle'
import { Bike, Vehicle as VehicleClass, LAYOUT, SPEEDS, getPhase, getLaneY } from '../models/Vehicle'
import type { CarData } from '../models/EnhancedVehicle'
import type { VehicleData, VehiclePosition } from '../models/Vehicle'
import './HollandTunnel.css'

// Special vehicle types that aren't in the models yet
interface SpecialVehicle extends VehicleData {
  instance?: VehicleClass;
}

// Precompute all vehicles
const createVehicles = (): SpecialVehicle[] => {
  const vehicles: SpecialVehicle[] = []
  
  // Cars for each lane
  for (let minute = 0; minute < 60; minute++) {
    // Lane 1 cars always spawn
    const eastCar1: CarData = { 
      id: `car-e1-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 1, 
      direction: 'east' as const 
    }
    const westCar1: CarData = { 
      id: `car-w1-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 2, 
      direction: 'west' as const 
    }
    
    vehicles.push(
      { ...eastCar1, instance: new Car(eastCar1) },
      { ...westCar1, instance: new Car(westCar1) }
    )
    
    // Lane 2 (R lane for eastbound, L lane for westbound) cars - need to handle queue positions
    const eastCar2: CarData = { 
      id: `car-e2-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 2, 
      direction: 'east' as const 
    }
    
    // Set queue position for eastbound cars that queue
    if (minute >= 45 && minute <= 57) {
      eastCar2.queuePosition = minute - 45
      eastCar2.paceCarStartMins = 55 // Pace car starts at :55
    }
    
    const westCar2: CarData = { 
      id: `car-w2-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 1, 
      direction: 'west' as const 
    }
    
    // Set queue position for westbound cars that queue
    if (minute >= 15 && minute <= 27) {
      westCar2.queuePosition = minute - 15
      westCar2.paceCarStartMins = 25 // Pace car starts at :25
    }
    
    vehicles.push(
      { ...eastCar2, instance: new Car(eastCar2) },
      { ...westCar2, instance: new Car(westCar2) }
    )
  }
  
  // Bikes for each direction - spawn every 4 minutes (15 total per hour)
  for (let i = 0; i < 15; i++) {
    const spawnMinute = i * 4  // 0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56
    const eastBike = { 
      id: `bike-e-${i}`, 
      type: 'bike' as const, 
      spawnMinute: spawnMinute, 
      lane: 2, 
      direction: 'east' as const 
    }
    const westBike = { 
      id: `bike-w-${i}`, 
      type: 'bike' as const, 
      spawnMinute: spawnMinute, 
      lane: 1, 
      direction: 'west' as const 
    }
    
    vehicles.push(
      { ...eastBike, instance: new Bike(eastBike) },
      { ...westBike, instance: new Bike(westBike) }
    )
  }
  
  
  // Sweep and pace vehicles (we'll handle these specially for now)
  vehicles.push(
    { id: 'sweep-main', type: 'sweep' as const, spawnMinute: 0, lane: 2, direction: 'east' as const },
    { id: 'pace-main', type: 'pace' as const, spawnMinute: 0, lane: 2, direction: 'east' as const }
  )
  
  return vehicles
}

const ALL_VEHICLES = createVehicles()

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

  // Animation for smooth transitions
  const [displayTime, setDisplayTime] = useState(initialMinute * 60)
  const animationRef = useRef<number | undefined>(undefined)
  
  // State for arrow key transitions
  const [targetTime, setTargetTime] = useState(initialMinute * 60)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Update current minute when display time changes
  useEffect(() => {
    // Ensure displayTime stays within bounds
    const boundedTime = displayTime % 3600
    const newMinute = Math.floor(boundedTime / 60) % 60
    if (newMinute !== currentMinute) {
      setCurrentMinute(newMinute)
    }
  }, [displayTime, currentMinute, setCurrentMinute])

  // Get vehicle position for special vehicles (sweep and pace)
  const getSpecialVehiclePosition = (vehicle: SpecialVehicle, time: number): VehiclePosition | null => {
    const currentMin = Math.floor(time / 60) % 60
    
    if (vehicle.type === 'sweep') {
      const transitMinutes = 10
      const stagingOffset = 35
      
      // Sweep schedule
      if (currentMin >= 50) {
        // Moving east :50-:59
        const progress = (currentMin - 50) / transitMinutes
        const distance = LAYOUT.TUNNEL_WIDTH * progress
        return { x: LAYOUT.QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 }
      } else if (currentMin < 10) {
        if (currentMin >= 0 && currentMin <= 5) {
          // Moving to west staging :00-:05
          const progress = Math.min(currentMin / 4, 1)
          const startX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
          const endX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50
          const startY = getLaneY('east', 2)
          const endY = getLaneY('west', 1) - stagingOffset
          
          return {
            x: startX + (endX - startX) * progress,
            y: startY + (endY - startY) * progress,
            state: 'staging',
            opacity: 1
          }
        } else {
          // Staging west :06-:09
          return {
            x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 1) - stagingOffset,
            state: 'staging',
            opacity: 1
          }
        }
      } else if (currentMin >= 20 && currentMin < 30) {
        // Moving west :20-:29
        const progress = (currentMin - 20) / transitMinutes
        const distance = LAYOUT.TUNNEL_WIDTH * progress
        return { 
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance, 
          y: getLaneY('west', 1), 
          state: 'tunnel', 
          opacity: 1 
        }
      } else if (currentMin >= 30 && currentMin <= 35) {
        // Moving to east staging :30-:35
        const progress = (currentMin - 30) / 5
        const startX = LAYOUT.QUEUE_AREA_WIDTH
        const endX = LAYOUT.QUEUE_AREA_WIDTH - 50
        const startY = getLaneY('west', 1)
        const endY = getLaneY('east', 2) + stagingOffset
        
        return {
          x: startX + (endX - startX) * progress,
          y: startY + (endY - startY) * progress,
          state: 'staging',
          opacity: 1
        }
      } else if (currentMin >= 10 && currentMin < 20) {
        // Staging west :10-:19
        return {
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
          y: getLaneY('west', 1) - stagingOffset,
          state: 'staging',
          opacity: 1
        }
      } else {
        // Staging east :36-:49
        return {
          x: LAYOUT.QUEUE_AREA_WIDTH - 50,
          y: getLaneY('east', 2) + stagingOffset,
          state: 'staging',
          opacity: 1
        }
      }
    } else if (vehicle.type === 'pace') {
      const transitMinutes = 5
      const stagingOffset = 60
      
      // Pace schedule
      if (currentMin >= 55) {
        // Moving east :55-:59
        const progress = (currentMin - 55) / transitMinutes
        const distance = LAYOUT.TUNNEL_WIDTH * progress
        return { x: LAYOUT.QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 }
      } else if (currentMin >= 0 && currentMin <= 5) {
        // Moving to west staging :00-:05
        const progress = Math.min(currentMin / 4, 1)
        const startX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
        const endX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50
        const startY = getLaneY('east', 2)
        const endY = getLaneY('west', 1) - stagingOffset
        
        return {
          x: startX + (endX - startX) * progress,
          y: startY + (endY - startY) * progress,
          state: 'staging',
          opacity: 1
        }
      } else if (currentMin >= 25 && currentMin < 30) {
        // Moving west :25-:29
        const progress = (currentMin - 25) / transitMinutes
        const distance = LAYOUT.TUNNEL_WIDTH * progress
        return { 
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance, 
          y: getLaneY('west', 1), 
          state: 'tunnel', 
          opacity: 1 
        }
      } else if (currentMin >= 30 && currentMin <= 35) {
        // Moving to east staging :30-:35
        const progress = (currentMin - 30) / 5
        const startX = LAYOUT.QUEUE_AREA_WIDTH
        const endX = LAYOUT.QUEUE_AREA_WIDTH - 50
        const startY = getLaneY('west', 1)
        const endY = getLaneY('east', 2) + stagingOffset
        
        return {
          x: startX + (endX - startX) * progress,
          y: startY + (endY - startY) * progress,
          state: 'staging',
          opacity: 1
        }
      } else if (currentMin >= 6 && currentMin < 25) {
        // Staging west :06-:24
        return {
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
          y: getLaneY('west', 1) - stagingOffset,
          state: 'staging',
          opacity: 1
        }
      } else {
        // Staging east :36-:54
        return {
          x: LAYOUT.QUEUE_AREA_WIDTH - 50,
          y: getLaneY('east', 2) + stagingOffset,
          state: 'staging',
          opacity: 1
        }
      }
    }
    
    return null
  }

  // Get vehicle position with interpolation
  const getVehiclePosition = (vehicle: SpecialVehicle, time: number): VehiclePosition | null => {
    // For vehicles with instances, use their getPosition method
    if (vehicle.instance) {
      return vehicle.instance.getPosition(time)
    }
    
    // For special vehicles, interpolate between minute positions
    const currentSec = time % 60
    const currentMinuteTime = Math.floor(time)
    const nextMinuteTime = (currentMinuteTime + 1) % 60
    
    const currentPos = getSpecialVehiclePosition(vehicle, currentMinuteTime)
    const nextPos = getSpecialVehiclePosition(vehicle, nextMinuteTime)
    
    if (!currentPos) return null
    if (!nextPos) return currentPos
    
    // Interpolate between positions
    const interpolationFactor = currentSec / 60
    
    return {
      x: currentPos.x + (nextPos.x - currentPos.x) * interpolationFactor,
      y: currentPos.y + (nextPos.y - currentPos.y) * interpolationFactor,
      state: currentPos.state,
      opacity: currentPos.opacity + (nextPos.opacity - currentPos.opacity) * interpolationFactor
    }
  }

  // Animation loop
  const animate = useCallback(() => {
    if (!isPaused && !isTransitioning) {
      setDisplayTime(prevTime => {
        const newTime = prevTime + speed
        return newTime % 3600
      })
    } else if (isTransitioning) {
      // Smooth transition for arrow key navigation
      setDisplayTime(prevTime => {
        let diff = targetTime - prevTime
        
        // Handle wraparound at hour boundaries
        // If diff is very large, we're wrapping around
        if (diff > 1800) { // More than 30 minutes backward, must be :59→:00
          diff = diff - 3600 // Convert to small forward step
        } else if (diff < -1800) { // More than 30 minutes forward, must be :00→:59
          diff = diff + 3600 // Convert to small backward step
        }
        
        if (Math.abs(diff) < 0.5) {
          setIsTransitioning(false)
          return targetTime
        }
        
        // Linear transition: move at constant speed
        const step = 8
        if (diff > 0) {
          let newTime = prevTime + Math.min(step, diff) // Don't overshoot
          // Handle wraparound during animation
          if (newTime >= 3600) newTime -= 3600
          return newTime
        } else {
          let newTime = prevTime - Math.min(step, -diff) // Don't overshoot
          // Handle wraparound during animation
          if (newTime < 0) newTime += 3600
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
        e.preventDefault() // Prevent horizontal scrolling
        // Calculate target based on current target (if transitioning) or display time
        const baseTime = isTransitioning ? targetTime : displayTime
        const currentMinute = Math.floor(baseTime / 60) % 60
        const newMinute = (currentMinute + 1) % 60
        const newTime = newMinute * 60
        
        setTargetTime(newTime)
        setIsTransitioning(true)
        
        // Update URL
        const url = new URL(window.location.href)
        url.searchParams.set('t', newMinute.toString())
        window.history.replaceState({}, '', url.toString())
      } else if (e.code === 'ArrowLeft' && isPaused) {
        e.preventDefault() // Prevent horizontal scrolling
        // Calculate target based on current target (if transitioning) or display time
        const baseTime = isTransitioning ? targetTime : displayTime
        const currentMinute = Math.floor(baseTime / 60) % 60
        const newMinute = (currentMinute - 1 + 60) % 60
        const newTime = newMinute * 60
        
        setTargetTime(newTime)
        setIsTransitioning(true)
        
        // Update URL
        const url = new URL(window.location.href)
        url.searchParams.set('t', newMinute.toString())
        window.history.replaceState({}, '', url.toString())
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPaused, setIsPaused, displayTime, isTransitioning, targetTime])

  // Timeline click handler
  const handleTimelineClick = (minute: number) => {
    const newTime = minute * 60
    setDisplayTime(newTime)
    setTargetTime(newTime)
    setIsTransitioning(false)
    setIsPaused(true)
    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('t', minute.toString())
    window.history.replaceState({}, '', url.toString())
  }

  // Get all visible vehicles
  // Ensure displayTime is properly bounded to avoid edge cases
  const boundedDisplayTime = displayTime % 3600
  const visibleVehicles = ALL_VEHICLES
    .map(vehicle => ({
      vehicle,
      position: getVehiclePosition(vehicle, boundedDisplayTime)
    }))
    .filter(({ position }) => position !== null)

  const renderVehicle = (vehicle: SpecialVehicle, position: VehiclePosition) => {
    let emoji = '🚗'
    if (vehicle.type === 'bike') emoji = '🚴'
    else if (vehicle.type === 'sweep') emoji = '🚐'
    else if (vehicle.type === 'pace') emoji = '🚓'

    // Generate tooltip content
    let tooltip = ''
    const dir = vehicle.direction === 'east' ? 'E/b' : 'W/b'
    if (vehicle.type === 'car') {
      const lane = vehicle.lane === 1 ? 'L' : 'R'
      tooltip = `:${vehicle.spawnMinute.toString().padStart(2, '0')} - ${lane} lane - ${dir}`
    } else if (vehicle.type === 'bike') {
      const bikeIndex = vehicle.spawnMinute / 4
      tooltip = `#${bikeIndex + 1} - :${vehicle.spawnMinute.toString().padStart(2, '0')} spawn - ${dir}`
    } else if (vehicle.type === 'sweep') {
      tooltip = `Sweep - ${dir}`
    } else {
      tooltip = `Pace car - ${dir}`
    }

    // Determine direction for special vehicles based on their phase and staging area
    let actualDirection = vehicle.direction
    if (vehicle.type === 'sweep' || vehicle.type === 'pace') {
      const currentMin = Math.floor(boundedDisplayTime / 60) % 60
      
      if (vehicle.type === 'sweep') {
        // Sweep: east :50-:59, west :20-:29
        if (currentMin >= 50) {
          actualDirection = 'east'
        } else if (currentMin >= 20 && currentMin < 30) {
          actualDirection = 'west'
        } else if (currentMin >= 35) {
          // After arriving at eastbound staging (:35+), face east
          actualDirection = 'east'
        } else if (currentMin >= 6) {
          // At westbound staging (:06-:34), face west
          actualDirection = 'west'
        } else {
          // Moving to westbound staging (:00-:05), still face east
          actualDirection = 'east'
        }
      } else if (vehicle.type === 'pace') {
        // Pace: east :55-:59, west :25-:29
        if (currentMin >= 55) {
          actualDirection = 'east'
        } else if (currentMin >= 25 && currentMin < 30) {
          actualDirection = 'west'
        } else if (currentMin >= 35) {
          // After arriving at eastbound staging (:35+), face east
          actualDirection = 'east'
        } else if (currentMin >= 6) {
          // At westbound staging (:06-:34), face west
          actualDirection = 'west'
        } else {
          // Moving to westbound staging (:00-:05), still face east
          actualDirection = 'east'
        }
      }
    }

    // Only flip eastbound vehicles to face right (emojis face left by default)
    const transform = actualDirection === 'east' ? `translate(${position.x * 2},0) scale(-1,1)` : undefined

    return (
      <text
        key={vehicle.id}
        x={position.x}
        y={position.y}
        fontSize="20"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={position.opacity}
        style={{ userSelect: 'none', cursor: 'pointer' }}
        transform={transform}
        data-tooltip-id="vehicle-tooltip"
        data-tooltip-content={tooltip}
      >
        {emoji}
      </text>
    )
  }

  // Calculate marker position based on speed and time
  const calculateMarkerPosition = (startMinute: number, speed: number, currentTime: number, direction: 'east' | 'west'): number => {
    const currentHour = Math.floor(currentTime / 3600)
    const startTime = (currentHour * 3600) + (startMinute * 60)
    
    // Check if marker hasn't started yet
    if (currentTime < startTime) {
      // Check if it might be from previous hour
      const prevStartTime = ((currentHour - 1) * 3600) + (startMinute * 60)
      const timeSincePrevStart = currentTime - prevStartTime
      
      // If it's been too long since previous hour start, marker hasn't started
      if (timeSincePrevStart > 600) { // 10 minutes max transit
        return direction === 'east' ? LAYOUT.QUEUE_AREA_WIDTH : LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
      }
      
      // Use previous hour timing
      const distance = speed * timeSincePrevStart
      return direction === 'east' ? 
        LAYOUT.QUEUE_AREA_WIDTH + distance : 
        LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance
    }
    
    const elapsedTime = currentTime - startTime
    const distance = speed * elapsedTime
    
    return direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH + distance : 
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance
  }
  
  // Calculate bike marker position (variable speed)
  const calculateBikeMarkerPosition = (startMinute: number, currentTime: number, direction: 'east' | 'west'): number => {
    const currentHour = Math.floor(currentTime / 3600)
    const startTime = (currentHour * 3600) + (startMinute * 60)
    
    // Check if marker hasn't started yet
    if (currentTime < startTime) {
      // Check if it might be from previous hour
      const prevStartTime = ((currentHour - 1) * 3600) + (startMinute * 60)
      const timeSincePrevStart = currentTime - prevStartTime
      
      // If it's been too long since previous hour start, marker hasn't started
      if (timeSincePrevStart > 600) { // 10 minutes max transit
        return direction === 'east' ? LAYOUT.QUEUE_AREA_WIDTH : LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
      }
      
      // Use previous hour timing
      return calculateBikeDistance(timeSincePrevStart, direction)
    }
    
    const elapsedTime = currentTime - startTime
    return calculateBikeDistance(elapsedTime, direction)
  }
  
  // Helper to calculate bike distance with variable speed
  const calculateBikeDistance = (elapsedTime: number, direction: 'east' | 'west'): number => {
    const halfwayTime = (LAYOUT.TUNNEL_WIDTH / 2) / SPEEDS.BIKE_DOWNHILL
    let distance
    
    if (elapsedTime <= halfwayTime) {
      distance = SPEEDS.BIKE_DOWNHILL * elapsedTime
    } else {
      distance = (LAYOUT.TUNNEL_WIDTH / 2) + SPEEDS.BIKE_UPHILL * (elapsedTime - halfwayTime)
    }
    
    const x = direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH + distance : 
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance
    
    // Clamp to tunnel bounds
    return Math.max(LAYOUT.QUEUE_AREA_WIDTH, Math.min(LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH, x))
  }

  // Color rectangles as fills between markers
  const renderColorRectangles = () => {
    const rects = []
    
    // Eastbound markers (removed bike marker to eliminate yellow)
    const eastMarker1 = calculateMarkerPosition(45, SPEEDS.CAR, boundedDisplayTime, 'east')
    const eastMarker3 = calculateMarkerPosition(50, SPEEDS.SWEEP, boundedDisplayTime, 'east')
    const eastMarker4 = calculateMarkerPosition(55, SPEEDS.CAR, boundedDisplayTime, 'east')
    
    // Green rectangle between marker 3 (trailing) and marker 1 (leading)
    // Clamp both start and end to tunnel boundaries
    if (eastMarker1 > eastMarker3 && eastMarker3 >= LAYOUT.QUEUE_AREA_WIDTH) {
      const startX = Math.max(eastMarker3, LAYOUT.QUEUE_AREA_WIDTH)
      const endX = Math.min(eastMarker1, LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH)
      if (endX > startX) {
        rects.push(
          <rect
            key="east-green"
            x={startX}
            y={230}
            width={endX - startX}
            height={LAYOUT.LANE_HEIGHT}
            fill="#28a745"
          />
        )
      }
    }
    
    // Red rectangle between marker 4 (trailing) and marker 3 (leading)
    if (eastMarker3 > eastMarker4 && eastMarker4 >= LAYOUT.QUEUE_AREA_WIDTH) {
      rects.push(
        <rect
          key="east-red"
          x={eastMarker4}
          y={230}
          width={eastMarker3 - eastMarker4}
          height={LAYOUT.LANE_HEIGHT}
          fill="#dc3545"
        />
      )
    }
    
    // Westbound markers (removed bike marker to eliminate yellow)
    const westMarker1 = calculateMarkerPosition(15, SPEEDS.CAR, boundedDisplayTime, 'west')
    const westMarker3 = calculateMarkerPosition(20, SPEEDS.SWEEP, boundedDisplayTime, 'west')
    const westMarker4 = calculateMarkerPosition(25, SPEEDS.CAR, boundedDisplayTime, 'west')
    
    // Green rectangle between marker 3 (trailing) and marker 1 (leading)
    // For westbound, marker1 < marker3 when marker1 is ahead
    // Clamp both start and end to tunnel boundaries
    if (westMarker1 < westMarker3 && westMarker3 <= LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
      const startX = Math.max(westMarker1, LAYOUT.QUEUE_AREA_WIDTH) // Don't extend past left tunnel entrance
      const endX = Math.min(westMarker3, LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH)
      if (endX > startX) {
        rects.push(
          <rect
            key="west-green"
            x={startX}
            y={100}
            width={endX - startX}
            height={LAYOUT.LANE_HEIGHT}
            fill="#28a745"
          />
        )
      }
    }
    
    // Red rectangle between marker 4 (trailing) and marker 3 (leading)
    if (westMarker3 < westMarker4 && westMarker4 <= LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
      rects.push(
        <rect
          key="west-red"
          x={westMarker3}
          y={100}
          width={westMarker4 - westMarker3}
          height={LAYOUT.LANE_HEIGHT}
          fill="#dc3545"
        />
      )
    }
    
    return rects
  }

  const eastPhase = getPhase(currentMinute, 'east')
  const westPhase = getPhase(currentMinute, 'west')

  return (
    <div className="holland-tunnel-container">
      <div className="control-panel">
        <div className="header-left">
          <h1>Holland Tunnel Bike Lane Concept</h1>
          <div className="controls">
            <button onClick={() => {
              setIsPaused(!isPaused)
              // Update URL when pausing
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
          <AnalogClock minute={displayTime / 60} />
          <div className="digital-time-large">
            0:{String(Math.floor(displayTime / 60) % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="tunnel-visualization-svg">
        <svg width="1100" height="400" viewBox="0 0 1100 400">
          {/* Tunnel structure */}
          <g>
            {/* Westbound */}
            <text x={20} y={80} fontSize="16" fontWeight="bold">Westbound (← NJ) - 14th St</text>
            <text x={20} y={100} fontSize="12" fill="#666">Phase: {westPhase}</text>
            
            {/* Lanes */}
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={100} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={130} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
            
            {/* Bike pen */}
            <rect x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 20} y={40} width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
            <text x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 80} y={30} fontSize="12" textAnchor="middle">Bike Pen</text>
            
            {/* Eastbound */}
            <text x={20} y={180} fontSize="16" fontWeight="bold">Eastbound (Manhattan →) - 12th St</text>
            <text x={20} y={200} fontSize="12" fill="#666">Phase: {eastPhase}</text>
            
            {/* Lanes */}
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={200} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={230} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
            
            {/* Bike pen */}
            <rect x={20} y={290} width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
            <text x={80} y={280} fontSize="12" textAnchor="middle">Bike Pen</text>
            
            {/* Lane markers */}
            <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={120} fontSize="12" fill="white">R Lane</text>
            <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={150} fontSize="12" fill="white">L Lane (Cars Only)</text>
            <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={220} fontSize="12" fill="white">L Lane (Cars Only)</text>
            <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={250} fontSize="12" fill="white">R Lane</text>
          </g>
          
          {/* Color rectangles */}
          {renderColorRectangles()}
          
          {/* Vehicles */}
          <g>
            {visibleVehicles.map(({ vehicle, position }) => 
              renderVehicle(vehicle, position!)
            )}
          </g>
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
      </div>

      <Tooltip id="vehicle-tooltip" />
    </div>
  )
}
