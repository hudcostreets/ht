import { useState, useEffect, useCallback, useRef } from 'react';
import useSessionStorageState from 'use-session-storage-state';
import { Tooltip } from 'react-tooltip';
import { AnalogClock } from './AnalogClock';
import './HollandTunnel.css';

interface Vehicle {
  id: string;
  type: 'car' | 'bike' | 'sweep' | 'pace';
  spawnMinute: number; // Which minute this vehicle spawns (0-59 for cars, index for bikes)
  lane: number;
  direction: 'east' | 'west';
}

interface VehiclePosition {
  x: number;
  y: number;
  state: 'approaching' | 'queued' | 'tunnel' | 'exiting' | 'staging' | 'pen';
  opacity: number;
}

// Layout constants
const TUNNEL_WIDTH = 800;
const QUEUE_AREA_WIDTH = 150;
const LANE_HEIGHT = 30;
const BIKE_PEN_WIDTH = 120;
const BIKE_PEN_HEIGHT = 80;

// Speed constants in MPH
const CAR_MPH = 24;
const SWEEP_MPH = 12;
const BIKE_DOWNHILL_MPH = 15;
const BIKE_UPHILL_MPH = 8;
const PACE_MPH = 24;

// Tunnel dimensions
const TUNNEL_LENGTH_MILES = 2;
const TUNNEL_LENGTH_PX = 800;
const PX_PER_MILE = TUNNEL_LENGTH_PX / TUNNEL_LENGTH_MILES;

// Convert MPH to pixels per simulated second
function mphToPixelsPerSecond(mph: number): number {
  const milesPerHour = mph;
  const pixelsPerHour = milesPerHour * PX_PER_MILE;
  const pixelsPerMinute = pixelsPerHour / 60;
  const pixelsPerSecond = pixelsPerMinute / 60;
  return pixelsPerSecond;
}

// Calculate speeds
const CAR_SPEED = mphToPixelsPerSecond(CAR_MPH);
const SWEEP_SPEED = mphToPixelsPerSecond(SWEEP_MPH);
const BIKE_SPEED_DOWNHILL = mphToPixelsPerSecond(BIKE_DOWNHILL_MPH);
const BIKE_SPEED_UPHILL = mphToPixelsPerSecond(BIKE_UPHILL_MPH);
const PACE_SPEED = mphToPixelsPerSecond(PACE_MPH);

// Precompute all vehicles
const ALL_VEHICLES: Vehicle[] = [];

// Cars for each lane - but skip certain minutes for R lane
for (let minute = 0; minute < 60; minute++) {
  // Lane 1 cars always spawn
  ALL_VEHICLES.push(
    { id: `car-e1-${minute}`, type: 'car', spawnMinute: minute, lane: 1, direction: 'east' },
    { id: `car-w1-${minute}`, type: 'car', spawnMinute: minute, lane: 1, direction: 'west' }
  );
  
  // Lane 2 (R lane) - only during normal phase
  // East: :00-:44, then :56-:59 (resume after pace car)
  if (minute < 45 || minute >= 56) {
    ALL_VEHICLES.push(
      { id: `car-e2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'east' }
    );
  } else if (minute === 45) {
    // :45 car that will queue and enter at :56
    ALL_VEHICLES.push(
      { id: `car-e2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'east' }
    );
  }
  
  // West: :26-:59 and :00-:14, then queue :15
  if ((minute >= 26 || minute < 15)) {
    ALL_VEHICLES.push(
      { id: `car-w2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'west' }
    );
  } else if (minute === 15) {
    // :15 car that will queue and enter at :26
    ALL_VEHICLES.push(
      { id: `car-w2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'west' }
    );
  }
}

// 15 bikes for each direction (spawn every 4 minutes)
for (let i = 0; i < 15; i++) {
  ALL_VEHICLES.push(
    { id: `bike-e-${i}`, type: 'bike', spawnMinute: i, lane: 2, direction: 'east' },
    { id: `bike-w-${i}`, type: 'bike', spawnMinute: i, lane: 2, direction: 'west' }
  );
}

// Sweep and pace vehicles
ALL_VEHICLES.push(
  { id: 'sweep-main', type: 'sweep', spawnMinute: 0, lane: 2, direction: 'east' },
  { id: 'pace-main', type: 'pace', spawnMinute: 0, lane: 2, direction: 'east' }
);

export function HollandTunnelDeterministic() {
  // Check URL parameter for initial time
  const urlParams = new URLSearchParams(window.location.search);
  const urlMinute = urlParams.get('t');
  const initialMinute = urlMinute !== null ? parseInt(urlMinute, 10) % 60 : 0;

  const [currentMinute, setCurrentMinute] = useSessionStorageState<number>('ht-current-minute', {
    defaultValue: initialMinute
  });
  const [isPaused, setIsPaused] = useSessionStorageState<boolean>('ht-is-paused', {
    defaultValue: urlMinute !== null // Pause if URL param is set
  });
  const [speed, setSpeed] = useSessionStorageState<number>('ht-speed', {
    defaultValue: 1
  });

  // Animation for smooth transitions
  const [displayTime, setDisplayTime] = useState(currentMinute * 60);
  const animationRef = useRef<number | undefined>(undefined);
  
  // Update current minute when display time changes
  useEffect(() => {
    const newMinute = Math.floor(displayTime / 60) % 60;
    if (newMinute !== currentMinute) {
      setCurrentMinute(newMinute);
    }
  }, [displayTime, currentMinute, setCurrentMinute]);

  // Get phase for a given minute
  const getPhase = (minute: number, direction: 'east' | 'west') => {
    const offset = direction === 'west' ? 30 : 0;
    const adjustedMinute = (minute + offset) % 60;
    
    if (adjustedMinute < 45) return 'normal';
    if (adjustedMinute < 48) return 'bikes-enter';
    if (adjustedMinute < 50) return 'clearing';
    if (adjustedMinute < 55) return 'sweep';
    return 'pace-car';
  };

  // Lane Y positions
  const getLaneY = (direction: 'east' | 'west', lane: number) => {
    if (direction === 'west') {
      const baseY = 100;
      return baseY + (2 - lane) * LANE_HEIGHT + LANE_HEIGHT / 2;
    } else {
      const baseY = 200;
      return baseY + (lane - 1) * LANE_HEIGHT + LANE_HEIGHT / 2;
    }
  };

  // Get vehicle position at an exact minute (no interpolation)
  const getVehiclePositionAtMinute = (vehicle: Vehicle, minuteTime: number): VehiclePosition | null => {
    const currentMin = Math.floor(minuteTime / 60) % 60;
    const currentHour = Math.floor(minuteTime / 3600);
    
    // Handle special vehicles (sweep and pace)
    if (vehicle.type === 'sweep' || vehicle.type === 'pace') {
      const isSweep = vehicle.type === 'sweep';
      const transitMinutes = isSweep ? 10 : 5;
      const stagingOffset = isSweep ? 35 : 60;
      
      // Define schedule states for each minute
      if (isSweep) {
        // Sweep schedule
        if (currentMin >= 50) {
          // Moving east
          const progress = (currentMin - 50) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
        } else if (currentMin < 10) {
          // Still moving east or staging west
          const totalMin = currentMin + 10; // Minutes since :50
          if (totalMin < 10) {
            const progress = totalMin / transitMinutes;
            const distance = TUNNEL_WIDTH * progress;
            return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
          } else {
            // Staging west
            return {
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
              y: getLaneY('west', 2) - stagingOffset,
              state: 'staging',
              opacity: 1
            };
          }
        } else if (currentMin >= 20 && currentMin < 30) {
          // Moving west
          const progress = (currentMin - 20) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { 
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - distance, 
            y: getLaneY('west', 2), 
            state: 'tunnel', 
            opacity: 1 
          };
        } else if (currentMin < 20) {
          // Staging west
          return {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 2) - stagingOffset,
            state: 'staging',
            opacity: 1
          };
        } else {
          // Staging east
          return {
            x: QUEUE_AREA_WIDTH - 50,
            y: getLaneY('east', 2) + stagingOffset,
            state: 'staging',
            opacity: 1
          };
        }
      } else {
        // Pace schedule
        if (currentMin >= 55) {
          // Moving east
          const progress = (currentMin - 55) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
        } else if (currentMin < 5) {
          // Still moving east or staging west
          const totalMin = currentMin + 5; // Minutes since :55
          if (totalMin < 5) {
            const progress = totalMin / transitMinutes;
            const distance = TUNNEL_WIDTH * progress;
            return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
          } else {
            // Staging west
            return {
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
              y: getLaneY('west', 2) - stagingOffset,
              state: 'staging',
              opacity: 1
            };
          }
        } else if (currentMin >= 25 && currentMin < 30) {
          // Moving west
          const progress = (currentMin - 25) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { 
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - distance, 
            y: getLaneY('west', 2), 
            state: 'tunnel', 
            opacity: 1 
          };
        } else if (currentMin < 25) {
          // Staging west
          return {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 2) - stagingOffset,
            state: 'staging',
            opacity: 1
          };
        } else {
          // Staging east
          return {
            x: QUEUE_AREA_WIDTH - 50,
            y: getLaneY('east', 2) + stagingOffset,
            state: 'staging',
            opacity: 1
          };
        }
      }
    }
    
    // Handle bikes
    if (vehicle.type === 'bike') {
      const bikeSpawnMinute = vehicle.spawnMinute * 4;
      const minuteInHour = currentMin;
      
      if (vehicle.spawnMinute > 13 || bikeSpawnMinute > minuteInHour) return null;
      
      const releaseMinute = vehicle.direction === 'east' ? 45 : 15;
      
      if (currentMin < releaseMinute) {
        // In pen
        const col = vehicle.spawnMinute % 3;
        const row = Math.floor(vehicle.spawnMinute / 3);
        const penX = vehicle.direction === 'east' ? 70 : TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 70;
        const penY = vehicle.direction === 'east' ? 310 : 60;
        
        return {
          x: penX + (col * 25 - 25),
          y: penY + (row * 15 - 30),
          state: 'pen',
          opacity: 1
        };
      }
      
      // Calculate minutes since release
      const minutesSinceRelease = currentMin - releaseMinute;
      const releaseOrder = vehicle.spawnMinute;
      const releaseDelayMinutes = releaseOrder / 5; // 5 bikes per minute
      
      if (minutesSinceRelease < releaseDelayMinutes) {
        // Still in pen waiting
        const col = vehicle.spawnMinute % 3;
        const row = Math.floor(vehicle.spawnMinute / 3);
        const penX = vehicle.direction === 'east' ? 70 : TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 70;
        const penY = vehicle.direction === 'east' ? 310 : 60;
        
        return {
          x: penX + (col * 25 - 25),
          y: penY + (row * 15 - 30),
          state: 'pen',
          opacity: 1
        };
      }
      
      // Moving through tunnel
      const travelMinutes = minutesSinceRelease - releaseDelayMinutes;
      
      // Calculate distance based on variable speeds
      let distance = 0;
      const halfwayMinutes = (TUNNEL_WIDTH / 2) / (BIKE_SPEED_DOWNHILL * 60);
      
      if (travelMinutes <= halfwayMinutes) {
        distance = BIKE_SPEED_DOWNHILL * 60 * travelMinutes;
      } else {
        distance = (TUNNEL_WIDTH / 2) + BIKE_SPEED_UPHILL * 60 * (travelMinutes - halfwayMinutes);
      }
      
      const startX = vehicle.direction === 'east' ? QUEUE_AREA_WIDTH : TUNNEL_WIDTH + QUEUE_AREA_WIDTH;
      const x = vehicle.direction === 'east' ? startX + distance : startX - distance;
      
      // Check if exited
      const exitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50 : 
        QUEUE_AREA_WIDTH - 50;
      
      if ((vehicle.direction === 'east' && x > exitX) ||
          (vehicle.direction === 'west' && x < exitX)) {
        return null;
      }
      
      // Calculate opacity for fade zones
      let opacity = 1;
      const fadeZone = 50;
      if (vehicle.direction === 'east' && x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (exitX - x) / fadeZone);
      } else if (vehicle.direction === 'west' && x < QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - exitX) / fadeZone);
      }
      
      return {
        x,
        y: getLaneY(vehicle.direction, vehicle.lane),
        state: 'tunnel',
        opacity
      };
    }
    
    // Handle cars
    if (vehicle.type === 'car') {
      const spawnMinute = vehicle.spawnMinute;
      const phase = getPhase(spawnMinute, vehicle.direction);
      const isBlocked = vehicle.lane === 2 && phase !== 'normal';
      
      // Check if car exists yet
      if (spawnMinute > currentMin) return null;
      
      // Calculate when car can enter
      let enterMinute = spawnMinute;
      if (isBlocked) {
        if (vehicle.direction === 'east') {
          if (spawnMinute === 45) enterMinute = 56;
          else if (spawnMinute >= 46 && spawnMinute <= 55) return null; // These don't spawn
        } else {
          if (spawnMinute === 15) enterMinute = 26;
          else if (spawnMinute >= 16 && spawnMinute <= 25) return null;
        }
      }
      
      if (currentMin < enterMinute) {
        // Queued
        const queueIndex = spawnMinute % 15;
        const queueSpacing = 40;
        const baseOffset = 50;
        
        const x = vehicle.direction === 'east' ? 
          QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
          TUNNEL_WIDTH + QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing);
        
        return {
          x,
          y: getLaneY(vehicle.direction, vehicle.lane),
          state: 'queued',
          opacity: 1
        };
      }
      
      // Moving through tunnel
      const travelMinutes = currentMin - enterMinute;
      const distance = CAR_SPEED * 60 * travelMinutes;
      
      const startX = vehicle.direction === 'east' ? QUEUE_AREA_WIDTH : TUNNEL_WIDTH + QUEUE_AREA_WIDTH;
      const x = vehicle.direction === 'east' ? startX + distance : startX - distance;
      
      // Check if exited
      const exitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 100 : 
        QUEUE_AREA_WIDTH - 100;
      
      if ((vehicle.direction === 'east' && x > exitX) ||
          (vehicle.direction === 'west' && x < exitX)) {
        return null;
      }
      
      // Calculate opacity for fade zones
      let opacity = 1;
      const fadeZone = 100;
      if (vehicle.direction === 'east' && x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (exitX - x) / fadeZone);
      } else if (vehicle.direction === 'west' && x < QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - exitX) / fadeZone);
      }
      
      return {
        x,
        y: getLaneY(vehicle.direction, vehicle.lane),
        state: x < QUEUE_AREA_WIDTH || x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH ? 'approaching' : 'tunnel',
        opacity
      };
    }
    
    return null;
  };
  
  // Get interpolated vehicle position at any time
  const getVehiclePosition = (vehicle: Vehicle, time: number): VehiclePosition | null => {
    const currentSec = time % 60;
    const currentMinuteTime = Math.floor(time / 60) * 60;
    const nextMinuteTime = currentMinuteTime + 60;
    
    // Get positions at current and next minute
    const currentPos = getVehiclePositionAtMinute(vehicle, currentMinuteTime);
    const nextPos = getVehiclePositionAtMinute(vehicle, nextMinuteTime);
    
    // If vehicle doesn't exist at current minute, return null
    if (!currentPos) return null;
    
    // If vehicle doesn't exist at next minute, just return current position
    if (!nextPos) return currentPos;
    
    // Interpolate between positions
    const interpolationFactor = currentSec / 60;
    
    return {
      x: currentPos.x + (nextPos.x - currentPos.x) * interpolationFactor,
      y: currentPos.y + (nextPos.y - currentPos.y) * interpolationFactor,
      state: currentPos.state, // Use current state
      opacity: currentPos.opacity + (nextPos.opacity - currentPos.opacity) * interpolationFactor
    };
  };

  // Get visible vehicles
  const visibleVehicles = ALL_VEHICLES.map(vehicle => {
    const position = getVehiclePosition(vehicle, displayTime);
    return position ? { ...vehicle, position } : null;
  }).filter(Boolean);

  // Keyboard handler
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setIsPaused(prev => !prev);
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      setIsPaused(true);
      
      setCurrentMinute(prev => {
        let newMinute = e.code === 'ArrowRight'
          ? (prev + 1) % 60
          : prev === 0 ? 59 : prev - 1;
        
        // Handle wraparound smoothly
        let targetTime = newMinute * 60;
        
        // For wraparound, use intermediate values
        if (prev === 59 && newMinute === 0 && e.code === 'ArrowRight') {
          targetTime = 60 * 60; // Use minute 60 for animation
          setTimeout(() => {
            setDisplayTime(0); // Reset to 0 after animation
          }, 300);
        } else if (prev === 0 && newMinute === 59 && e.code === 'ArrowLeft') {
          setDisplayTime(60 * 60); // Start from minute 60
          targetTime = 59 * 60;
        }
        
        // Animate to new time
        const oldTime = displayTime;
        const startTime = Date.now();
        const duration = 300; // 300ms animation
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          
          setDisplayTime(oldTime + (targetTime - oldTime) * eased);
          
          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        animate();
        
        // Update URL parameter when stepping with arrow keys
        const url = new URL(window.location.href);
        url.searchParams.set('t', newMinute.toString());
        window.history.replaceState({}, '', url.toString());
        
        return newMinute;
      });
    }
  }, [setIsPaused, displayTime, setCurrentMinute]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Update time when playing using smooth animation
  useEffect(() => {
    if (isPaused) return;
    
    let lastTime = performance.now();
    let rafId: number;
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Calculate how many simulated seconds pass based on real time delta
      const simSecondsPerMs = (speed * 60) / 1000;
      const simSecondsDelta = deltaTime * simSecondsPerMs;
      
      setDisplayTime(prev => {
        const newTime = prev + simSecondsDelta;
        // Wrap around at 60 minutes (3600 seconds)
        return newTime % 3600;
      });
      
      rafId = requestAnimationFrame(animate);
    };
    
    rafId = requestAnimationFrame(animate);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPaused, speed]);

  const formatTime = (minute: number) => {
    const mins = minute % 60;
    return `0:${mins.toString().padStart(2, '0')}`;
  };

  // Calculate yellow distance with variable bike speed
  const calculateYellowDistance = (timeSincePenClose: number): number => {
    if (timeSincePenClose <= 0) return 0;
    
    const halfwayTime = (TUNNEL_WIDTH / 2) / BIKE_SPEED_DOWNHILL;
    let distance;
    
    if (timeSincePenClose <= halfwayTime) {
      // First half - downhill speed
      distance = BIKE_SPEED_DOWNHILL * timeSincePenClose;
    } else {
      // Second half - uphill speed
      distance = (TUNNEL_WIDTH / 2) + BIKE_SPEED_UPHILL * (timeSincePenClose - halfwayTime);
    }
    
    return Math.min(distance, TUNNEL_WIDTH);
  };

  // Handle timeline clicks
  const handleTimelineClick = (targetMinute: number) => {
    setIsPaused(true);
    setCurrentMinute(targetMinute);
    setDisplayTime(targetMinute * 60);
    
    // Update URL parameter
    const url = new URL(window.location.href);
    url.searchParams.set('t', targetMinute.toString());
    window.history.replaceState({}, '', url.toString());
  };

  const eastPhase = getPhase(currentMinute, 'east');
  const westPhase = getPhase(currentMinute, 'west');

  // Count bikes in pens
  const eastBikeCount = visibleVehicles.filter(v => 
    v && v.type === 'bike' && v.direction === 'east' && v.position.state === 'queued'
  ).length;
  
  const westBikeCount = visibleVehicles.filter(v => 
    v && v.type === 'bike' && v.direction === 'west' && v.position.state === 'queued'
  ).length;

  return (
    <div className="holland-tunnel-container">
      <div className="control-panel">
        <div className="header-left">
          <h1>Holland Tunnel Bike Lane Concept</h1>
          <div className="controls">
            <button onClick={() => setIsPaused(!isPaused)}>
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
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
            <span className="hint">Space: play/pause | ←/→: step by 1 minute</span>
          </div>
        </div>
        <div className="clock-container-large">
          <AnalogClock minute={displayTime / 60} size={120} />
          <div className="digital-time-large">{formatTime(currentMinute)}</div>
        </div>
      </div>

      <div className="tunnel-visualization-svg">
        <svg width="1100" height="400" viewBox="0 0 1100 400">
          {/* Background */}
          <rect width="1100" height="400" fill="#f5f5f5" />
          
          {/* Tunnel structure */}
          <rect x={QUEUE_AREA_WIDTH} y="80" width={TUNNEL_WIDTH} height="180" 
                fill="#e0e0e0" stroke="#333" strokeWidth="2" />
          
          {/* Direction separator */}
          <line x1="0" y1="175" x2="1100" y2="175" stroke="#999" strokeWidth="1" strokeDasharray="5,5" />
          
          {/* Westbound lanes */}
          <g id="westbound">
            <text x="10" y="80" fontSize="16" fontWeight="bold">Westbound (← NJ) - 14th St</text>
            <text x="10" y="95" fontSize="12" fill="#666">Phase: {westPhase}</text>
            
            {/* Lane 2 (R Lane) - ABOVE for westbound */}
            <rect x={QUEUE_AREA_WIDTH} y="100" width={TUNNEL_WIDTH} height={LANE_HEIGHT} 
                  fill="#666" />
            {/* Progressive color change overlay */}
            {(() => {
              const currentMin = Math.floor(displayTime / 60) % 60;
              const currentSec = displayTime % 60;
              const currentTime = currentMin * 60 + currentSec;
              
              // Westbound: colors move right to left
              // Show green rect starting at :14 (one minute before bikes-enter phase)
              if (westPhase === 'bikes-enter' || (westPhase === 'normal' && currentMin === 14)) {
                // Green follows behind last car (spawned at :14) at car speed
                const lastCarTime = 14 * 60; // :14 car
                const timeSinceLastCar = currentTime - lastCarTime;
                const lastCarDistance = timeSinceLastCar > 0 ? CAR_SPEED * timeSinceLastCar : 0;
                const greenWidth = Math.min(lastCarDistance, TUNNEL_WIDTH);
                
                return (
                  <rect 
                    x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - greenWidth} 
                    y="100" 
                    width={greenWidth} 
                    height={LANE_HEIGHT} 
                    fill="#28a745" 
                  />
                );
              } else if (westPhase === 'clearing') {
                // Yellow emanates from pen close at :18
                const penCloseTime = 18 * 60;
                const timeSincePenClose = currentTime - penCloseTime;
                const yellowTrailDistance = calculateYellowDistance(timeSincePenClose);
                
                const layers = [];
                
                // Yellow trailing from pen close (moving right to left)
                if (yellowTrailDistance > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - yellowTrailDistance} 
                      y="100" 
                      width={Math.min(yellowTrailDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Green to the left of yellow
                const remainingGreen = TUNNEL_WIDTH - yellowTrailDistance;
                if (remainingGreen > 0) {
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH} 
                      y="100" 
                      width={remainingGreen} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (westPhase === 'sweep') {
                // Continue yellow from pen close at :18
                const penCloseTime = 18 * 60;
                const timeSincePenClose = currentMin >= 18 ? 
                  currentTime - penCloseTime : 
                  currentTime + (60 * 60) - penCloseTime;
                const yellowDistance = calculateYellowDistance(timeSincePenClose);
                
                // Red follows sweep van (starts at :20)
                const sweepStartTime = 20 * 60;
                const timeSinceSweepStart = currentMin >= 20 ? 
                  currentTime - sweepStartTime : 
                  currentTime + (60 * 60) - sweepStartTime;
                const sweepDistance = SWEEP_SPEED * timeSinceSweepStart;
                
                const layers = [];
                
                // Green if yellow hasn't reached start yet
                if (yellowDistance < TUNNEL_WIDTH) {
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH} 
                      y="100" 
                      width={TUNNEL_WIDTH - yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                // Yellow (continuing from clearing phase)
                if (yellowDistance > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - yellowDistance} 
                      y="100" 
                      width={yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Red DMZ behind sweep (moving right to left)
                if (sweepDistance > 0) {
                  layers.push(
                    <rect key="red"
                      x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - sweepDistance} 
                      y="100" 
                      width={Math.min(sweepDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (westPhase === 'pace-car') {
                // Continue calculating positions from previous phases
                const penCloseTime = 18 * 60;
                const timeSincePenClose = currentMin >= 18 ? 
                  currentTime - penCloseTime : 
                  currentTime + (60 * 60) - penCloseTime;
                const yellowDistance = calculateYellowDistance(timeSincePenClose);
                
                // Red continues from sweep phase (started at :20)
                const sweepStartTime = 20 * 60;
                const timeSinceSweepStart = currentMin >= 20 ? 
                  currentTime - sweepStartTime : 
                  currentTime + (60 * 60) - sweepStartTime;
                const redDistance = Math.min(SWEEP_SPEED * timeSinceSweepStart, TUNNEL_WIDTH);
                
                // Gray follows pace car (starts at :25)
                const paceStartTime = 25 * 60;
                const timeSincePaceStart = currentMin >= 25 ? 
                  currentTime - paceStartTime : 
                  currentTime + (60 * 60) - paceStartTime;
                const grayDistance = PACE_SPEED * timeSincePaceStart;
                
                const layers = [];
                
                // Base layer - whatever was there before
                if (yellowDistance < TUNNEL_WIDTH) {
                  // Still some green at the left
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH} 
                      y="100" 
                      width={TUNNEL_WIDTH - yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                // Yellow (if not fully covered by red)
                if (yellowDistance > redDistance) {
                  const yellowStart = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - yellowDistance;
                  const yellowWidth = yellowDistance - redDistance;
                  layers.push(
                    <rect key="yellow"
                      x={yellowStart} 
                      y="100" 
                      width={yellowWidth} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Red (if not fully covered by gray)
                if (redDistance > grayDistance) {
                  const redStart = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - redDistance;
                  const redWidth = redDistance - grayDistance;
                  layers.push(
                    <rect key="red"
                      x={redStart} 
                      y="100" 
                      width={redWidth} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
                
                // Gray following pace car
                if (grayDistance > 0) {
                  layers.push(
                    <rect key="gray"
                      x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - grayDistance} 
                      y="100" 
                      width={Math.min(grayDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#666" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (westPhase !== 'normal') {
                // Transition phases
                return (
                  <rect 
                    x={QUEUE_AREA_WIDTH} 
                    y="100" 
                    width={TUNNEL_WIDTH} 
                    height={LANE_HEIGHT} 
                    fill="#28a745" 
                  />
                );
              }
              return null;
            })()}
            
            {/* Lane 1 (L Lane) - always cars - BELOW for westbound */}
            <rect x={QUEUE_AREA_WIDTH} y="130" width={TUNNEL_WIDTH} height={LANE_HEIGHT} fill="#666" />
            <line x1={QUEUE_AREA_WIDTH} y1="130" x2={TUNNEL_WIDTH + QUEUE_AREA_WIDTH} y2="130" stroke="#333" strokeWidth="2" />
            
            {/* Lane labels */}
            <text x={QUEUE_AREA_WIDTH + 10} y="120" fontSize="12" fill="white">
              R Lane {westPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>
            <text x={QUEUE_AREA_WIDTH + 10} y="150" fontSize="12" fill="white">L Lane (Cars Only)</text>
          </g>
          
          {/* Eastbound lanes */}
          <g id="eastbound">
            <text x="10" y="180" fontSize="16" fontWeight="bold">Eastbound (Manhattan →) - 12th St</text>
            <text x="10" y="195" fontSize="12" fill="#666">Phase: {eastPhase}</text>
            
            {/* Lane 1 (L Lane) - always cars */}
            <rect x={QUEUE_AREA_WIDTH} y="200" width={TUNNEL_WIDTH} height={LANE_HEIGHT} fill="#666" />
            
            {/* Lane 2 (R Lane) - changes based on phase */}
            <rect x={QUEUE_AREA_WIDTH} y="230" width={TUNNEL_WIDTH} height={LANE_HEIGHT} 
                  fill="#666" />
            {/* Progressive color change overlay */}
            {(() => {
              const currentMin = Math.floor(displayTime / 60) % 60;
              const currentSec = displayTime % 60;
              const currentTime = currentMin * 60 + currentSec;
              
              // Eastbound: colors move left to right
              if (eastPhase === 'bikes-enter') {
                // Green follows behind last car (spawned at :44) at car speed
                const lastCarTime = 44 * 60; // :44 car
                const timeSinceLastCar = currentMin >= 44 ? 
                  currentTime - lastCarTime : 
                  currentTime + (60 * 60) - lastCarTime;
                const lastCarDistance = CAR_SPEED * timeSinceLastCar;
                const greenWidth = Math.min(lastCarDistance, TUNNEL_WIDTH);
                
                return (
                  <rect 
                    x={QUEUE_AREA_WIDTH} 
                    y="230" 
                    width={greenWidth} 
                    height={LANE_HEIGHT} 
                    fill="#28a745" 
                  />
                );
              } else if (eastPhase === 'clearing') {
                // Green continues behind last car until fully across
                // Yellow emanates from pen close at :48
                const lastCarTime = 44 * 60;
                const timeSinceLastCar = currentMin >= 44 ? 
                  currentTime - lastCarTime : 
                  currentTime + (60 * 60) - lastCarTime;
                const greenLeadDistance = CAR_SPEED * timeSinceLastCar;
                
                const penCloseTime = 48 * 60;
                const timeSincePenClose = currentTime - penCloseTime;
                const yellowTrailDistance = calculateYellowDistance(timeSincePenClose);
                
                const layers = [];
                
                // Yellow trailing from pen close (if started)
                if (yellowTrailDistance > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={QUEUE_AREA_WIDTH} 
                      y="230" 
                      width={Math.min(yellowTrailDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Green between yellow and tunnel end
                const remainingGreen = TUNNEL_WIDTH - yellowTrailDistance;
                if (remainingGreen > 0) {
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH + yellowTrailDistance} 
                      y="230" 
                      width={remainingGreen} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (eastPhase === 'sweep') {
                // Calculate how far yellow has progressed (from :48)
                const penCloseTime = 48 * 60;
                const timeSincePenClose = currentMin >= 48 ? 
                  currentTime - penCloseTime : 
                  currentTime + (60 * 60) - penCloseTime;
                const yellowDistance = calculateYellowDistance(timeSincePenClose);
                
                // Red follows sweep van (starts at :50)
                const sweepStartTime = 50 * 60;
                const timeSinceSweepStart = currentMin >= 50 ? 
                  currentTime - sweepStartTime : 
                  currentTime + (60 * 60) - sweepStartTime;
                const sweepDistance = SWEEP_SPEED * timeSinceSweepStart;
                
                const layers = [];
                
                // Yellow (continuing from clearing phase)
                if (yellowDistance > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={QUEUE_AREA_WIDTH} 
                      y="230" 
                      width={yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Green if yellow hasn't reached end yet
                if (yellowDistance < TUNNEL_WIDTH) {
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH + yellowDistance} 
                      y="230" 
                      width={TUNNEL_WIDTH - yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                // Red DMZ behind sweep
                if (sweepDistance > 0) {
                  layers.push(
                    <rect key="red"
                      x={QUEUE_AREA_WIDTH} 
                      y="230" 
                      width={Math.min(sweepDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (eastPhase === 'pace-car') {
                // Continue calculating positions from previous phases
                const penCloseTime = 48 * 60;
                const timeSincePenClose = currentMin >= 48 ? 
                  currentTime - penCloseTime : 
                  currentTime + (60 * 60) - penCloseTime;
                const yellowDistance = calculateYellowDistance(timeSincePenClose);
                
                // Red continues from sweep phase (started at :50)
                const sweepStartTime = 50 * 60;
                const timeSinceSweepStart = currentMin >= 50 ? 
                  currentTime - sweepStartTime : 
                  currentTime + (60 * 60) - sweepStartTime;
                const redDistance = Math.min(SWEEP_SPEED * timeSinceSweepStart, TUNNEL_WIDTH);
                
                // Gray follows pace car (starts at :55)
                const paceStartTime = 55 * 60;
                const timeSincePaceStart = currentMin >= 55 ? 
                  currentTime - paceStartTime : 
                  currentTime + (60 * 60) - paceStartTime;
                const grayDistance = PACE_SPEED * timeSincePaceStart;
                
                const layers = [];
                
                // Base layer - whatever was there before
                if (yellowDistance < TUNNEL_WIDTH) {
                  // Still some green at the end
                  layers.push(
                    <rect key="green"
                      x={QUEUE_AREA_WIDTH + yellowDistance} 
                      y="230" 
                      width={TUNNEL_WIDTH - yellowDistance} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
                
                // Yellow (if not fully covered by red)
                if (yellowDistance > redDistance) {
                  layers.push(
                    <rect key="yellow"
                      x={QUEUE_AREA_WIDTH + redDistance} 
                      y="230" 
                      width={yellowDistance - redDistance} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
                
                // Red (if not fully covered by gray)
                if (redDistance > grayDistance) {
                  layers.push(
                    <rect key="red"
                      x={QUEUE_AREA_WIDTH + grayDistance} 
                      y="230" 
                      width={redDistance - grayDistance} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
                
                // Gray following pace car
                if (grayDistance > 0) {
                  layers.push(
                    <rect key="gray"
                      x={QUEUE_AREA_WIDTH} 
                      y="230" 
                      width={Math.min(grayDistance, TUNNEL_WIDTH)} 
                      height={LANE_HEIGHT} 
                      fill="#666" 
                    />
                  );
                }
                
                return <>{layers}</>;
              } else if (eastPhase !== 'normal') {
                // Transition phases
                return (
                  <rect 
                    x={QUEUE_AREA_WIDTH} 
                    y="230" 
                    width={TUNNEL_WIDTH} 
                    height={LANE_HEIGHT} 
                    fill="#28a745" 
                  />
                );
              }
              return null;
            })()}
            <line x1={QUEUE_AREA_WIDTH} y1="230" x2={TUNNEL_WIDTH + QUEUE_AREA_WIDTH} y2="230" stroke="#333" strokeWidth="2" />
            
            {/* Lane labels */}
            <text x={QUEUE_AREA_WIDTH + 10} y="220" fontSize="12" fill="white">L Lane (Cars Only)</text>
            <text x={QUEUE_AREA_WIDTH + 10} y="250" fontSize="12" fill="white">
              R Lane {eastPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>
          </g>
          
          {/* Bike pens */}
          {/* West bike pen - above right entrance */}
          <rect x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 10} y="20" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                fill="#ffeb3b" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
          <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 15} y="15" fontSize="12" fontWeight="bold">Bike Pen</text>
          <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 70} y="60" fontSize="20" textAnchor="middle">
            {westBikeCount} bikes
          </text>
          
          {/* East bike pen - below left entrance */}
          <rect x={10} y="270" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                fill="#ffeb3b" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
          <text x={15} y="263" fontSize="12" fontWeight="bold">Bike Pen</text>
          <text x={70} y="310" fontSize="20" textAnchor="middle">
            {eastBikeCount} bikes
          </text>
          
          {/* Render vehicles */}
          {visibleVehicles.map(vehicle => {
            if (!vehicle) return null;
            
            const emoji = {
              car: vehicle.direction === 'west' ? '🚗' : '🚗',
              bike: vehicle.direction === 'west' ? '🚴' : '🚴',
              sweep: '🚐',
              pace: '🚔'
            }[vehicle.type];
            
            // Create tooltip text
            let tooltip = '';
            const dir = vehicle.direction === 'east' ? 'E/b' : 'W/b';
            if (vehicle.type === 'car') {
              const lane = vehicle.lane === 1 ? 'L' : 'R';
              tooltip = `:${vehicle.spawnMinute.toString().padStart(2, '0')} - ${lane} lane - ${dir}`;
            } else if (vehicle.type === 'bike') {
              const bikeMinute = vehicle.spawnMinute * 4;
              tooltip = `#${vehicle.spawnMinute + 1} - :${bikeMinute.toString().padStart(2, '0')} spawn - ${dir}`;
            } else if (vehicle.type === 'sweep') {
              tooltip = `${dir}`;
            } else {
              tooltip = `${dir}`;
            }
            
            // For eastbound, wrap in a group to apply transform (flip to face right)
            if (vehicle.direction === 'east') {
              return (
                <g key={vehicle.id} transform={`translate(${vehicle.position.x}, ${vehicle.position.y})`}>
                  <text
                    x={0}
                    y={0}
                    fontSize={vehicle.type === 'sweep' ? 28 : vehicle.type === 'pace' ? 26 : 24}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity={vehicle.position.opacity}
                    transform="rotate(0, 0, 0) scale(-1, 1)"
                    style={{
                      cursor: 'pointer'
                    }}
                    data-tooltip-id="vehicle-tooltip"
                    data-tooltip-content={tooltip}
                  >
                    {emoji}
                  </text>
                </g>
              );
            }
            
            return (
              <text
                key={vehicle.id}
                x={vehicle.position.x}
                y={vehicle.position.y}
                fontSize={vehicle.type === 'sweep' ? 28 : vehicle.type === 'pace' ? 26 : 24}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={vehicle.position.opacity}
                style={{
                  cursor: 'pointer'
                }}
                data-tooltip-id="vehicle-tooltip"
                data-tooltip-content={tooltip}
              >
                {emoji}
              </text>
            );
          })}
        </svg>
        <Tooltip id="vehicle-tooltip" />
      </div>

      {/* Phase timeline */}
      <div className="legend">
        <div className="timeline-section">
          <h3>Eastbound Timeline</h3>
          <ul>
            <li 
              className={`${eastPhase === 'normal' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(0)}
            >
              :00-:45 - Normal traffic flow
            </li>
            <li 
              className={`${eastPhase === 'bikes-enter' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(45)}
            >
              :45-:48 - Bikes enter right lane
            </li>
            <li 
              className={`${eastPhase === 'clearing' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(48)}
            >
              :48-:50 - Clearing phase
            </li>
            <li 
              className={`${eastPhase === 'sweep' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(50)}
            >
              :50-:55 - Sweep van
            </li>
            <li 
              className={`${eastPhase === 'pace-car' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(55)}
            >
              :55-:00 - Pace car + cars resume
            </li>
          </ul>
        </div>
        <div className="timeline-section">
          <h3>Westbound Timeline (30 min offset)</h3>
          <ul>
            <li 
              className={`${westPhase === 'normal' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(30)}
            >
              :30-:15 - Normal traffic flow
            </li>
            <li 
              className={`${westPhase === 'bikes-enter' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(15)}
            >
              :15-:18 - Bikes enter right lane
            </li>
            <li 
              className={`${westPhase === 'clearing' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(18)}
            >
              :18-:20 - Clearing phase
            </li>
            <li 
              className={`${westPhase === 'sweep' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(20)}
            >
              :20-:25 - Sweep van
            </li>
            <li 
              className={`${westPhase === 'pace-car' ? 'current-phase' : ''} timeline-item`}
              onClick={() => handleTimelineClick(25)}
            >
              :25-:30 - Pace car + cars resume
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}