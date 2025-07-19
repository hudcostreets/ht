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
  
  // Lane 2 (R lane)
  // East: All minutes spawn, but :45-:55 will queue
  ALL_VEHICLES.push(
    { id: `car-e2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'east' }
  );
  
  // West: All minutes spawn, but :15-:25 will queue
  ALL_VEHICLES.push(
    { id: `car-w2-${minute}`, type: 'car', spawnMinute: minute, lane: 2, direction: 'west' }
  );
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
          // Moving east :50-:59
          const progress = (currentMin - 50) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
        } else if (currentMin < 10) {
          // :00-:09
          if (currentMin >= 0 && currentMin <= 5) {
            // Moving to west staging :00-:05
            const progress = Math.min(currentMin / 4, 1); // Over 4 minutes, cap at 1
            const startX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH;
            const endX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50;
            const startY = getLaneY('east', 2);
            const endY = getLaneY('west', 2) - stagingOffset;
            
            return {
              x: startX + (endX - startX) * progress,
              y: startY + (endY - startY) * progress,
              state: 'staging',
              opacity: 1
            };
          } else {
            // Staging west :06-:09
            return {
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
              y: getLaneY('west', 2) - stagingOffset,
              state: 'staging',
              opacity: 1
            };
          }
        } else if (currentMin >= 20 && currentMin < 30) {
          // Moving west :20-:29
          const progress = (currentMin - 20) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { 
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - distance, 
            y: getLaneY('west', 2), 
            state: 'tunnel', 
            opacity: 1 
          };
        } else if (currentMin >= 30 && currentMin <= 35) {
          // Moving to east staging :30-:35
          const progress = (currentMin - 30) / 5; // Over 5 minutes
          const startX = QUEUE_AREA_WIDTH;
          const endX = QUEUE_AREA_WIDTH - 50;
          const startY = getLaneY('west', 2);
          const endY = getLaneY('east', 2) + stagingOffset;
          
          return {
            x: startX + (endX - startX) * progress,
            y: startY + (endY - startY) * progress,
            state: 'staging',
            opacity: 1
          };
        } else if (currentMin >= 10 && currentMin < 20) {
          // Staging west :10-:19
          return {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 2) - stagingOffset,
            state: 'staging',
            opacity: 1
          };
        } else {
          // Staging east :36-:49
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
          // Moving east :55-:59
          const progress = (currentMin - 55) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { x: QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
        } else if (currentMin >= 0 && currentMin <= 5) {
          // Moving to west staging :00-:05
          const progress = Math.min(currentMin / 4, 1); // Over 4 minutes, cap at 1
          const startX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH;
          const endX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50;
          const startY = getLaneY('east', 2);
          const endY = getLaneY('west', 2) - stagingOffset;
          
          return {
            x: startX + (endX - startX) * progress,
            y: startY + (endY - startY) * progress,
            state: 'staging',
            opacity: 1
          };
        } else if (currentMin >= 25 && currentMin < 30) {
          // Moving west :25-:29
          const progress = (currentMin - 25) / transitMinutes;
          const distance = TUNNEL_WIDTH * progress;
          return { 
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - distance, 
            y: getLaneY('west', 2), 
            state: 'tunnel', 
            opacity: 1 
          };
        } else if (currentMin >= 30 && currentMin <= 35) {
          // Moving to east staging :30-:35
          const progress = (currentMin - 30) / 5; // Over 5 minutes
          const startX = QUEUE_AREA_WIDTH;
          const endX = QUEUE_AREA_WIDTH - 50;
          const startY = getLaneY('west', 2);
          const endY = getLaneY('east', 2) + stagingOffset;
          
          return {
            x: startX + (endX - startX) * progress,
            y: startY + (endY - startY) * progress,
            state: 'staging',
            opacity: 1
          };
        } else if (currentMin >= 6 && currentMin < 25) {
          // Staging west :06-:24
          return {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 2) - stagingOffset,
            state: 'staging',
            opacity: 1
          };
        } else {
          // Staging east :36-:54
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
      
      // Don't show bikes that haven't spawned yet
      if (vehicle.spawnMinute > 13 || bikeSpawnMinute > minuteInHour) {
        // Check if we're in the minute before spawn (for fade-in handling in interpolation)
        if (bikeSpawnMinute === minuteInHour + 1 && vehicle.spawnMinute <= 13) {
          // Return position with 0 opacity so interpolation can fade it in
          const col = vehicle.spawnMinute % 3;
          const row = Math.floor(vehicle.spawnMinute / 3);
          const penX = vehicle.direction === 'east' ? 70 : TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 70;
          const penY = vehicle.direction === 'east' ? 310 : 60;
          
          return {
            x: penX + (col * 25 - 25),
            y: penY + (row * 15 - 30),
            state: 'pen',
            opacity: 0
          };
        }
        return null;
      }
      
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
      
      // Check if this bike spawned after pen close
      const penCloseMinute = vehicle.direction === 'east' ? 48 : 18;
      
      if (bikeSpawnMinute >= penCloseMinute) {
        // Bikes spawning at or after pen close stay in pen permanently
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
        // Still in pen waiting to be released
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
      
      // Calculate opacity for fade zones
      let opacity = 1;
      const fadeZone = 50;
      const tunnelExitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH : 
        QUEUE_AREA_WIDTH;
      
      // Start fading when exiting tunnel
      if (vehicle.direction === 'east' && x > tunnelExitX) {
        const fadeProgress = (x - tunnelExitX) / fadeZone;
        opacity = Math.max(0, 1 - fadeProgress);
      } else if (vehicle.direction === 'west' && x < tunnelExitX) {
        const fadeProgress = (tunnelExitX - x) / fadeZone;
        opacity = Math.max(0, 1 - fadeProgress);
      }
      
      // Check if completely faded out
      const exitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH + fadeZone : 
        QUEUE_AREA_WIDTH - fadeZone;
      
      if ((vehicle.direction === 'east' && x > exitX) ||
          (vehicle.direction === 'west' && x < exitX)) {
        return null;
      }
      
      // Determine state based on position
      let state: 'approaching' | 'queued' | 'tunnel' | 'exiting' | 'staging' | 'pen';
      if (x >= QUEUE_AREA_WIDTH && x <= TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        state = 'tunnel';
      } else if (vehicle.direction === 'east' && x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        state = 'exiting';
      } else if (vehicle.direction === 'west' && x < QUEUE_AREA_WIDTH) {
        state = 'exiting';
      } else {
        state = 'approaching';
      }
      
      return {
        x,
        y: getLaneY(vehicle.direction, vehicle.lane),
        state,
        opacity
      };
    }
    
    // Handle cars
    if (vehicle.type === 'car') {
      const spawnMinute = vehicle.spawnMinute;
      const phase = getPhase(spawnMinute, vehicle.direction);
      const isBlocked = vehicle.lane === 2 && phase !== 'normal';
      
      // Check if car exists yet
      if (spawnMinute > currentMin) {
        // Check if we're in the minute before spawn (for fade-in handling in interpolation)
        if (spawnMinute === currentMin + 1) {
          // Calculate staging position 1 minute away from final position
          const oneMinuteDistance = CAR_SPEED * 60; // Distance car travels in 1 minute
          
          // Determine if this car will queue
          let willQueue = false;
          let queueIndex = 0;
          
          if (isBlocked) {
            if (vehicle.direction === 'east' && spawnMinute >= 45 && spawnMinute <= 55) {
              willQueue = true;
              queueIndex = spawnMinute - 45;
            } else if (vehicle.direction === 'west' && spawnMinute >= 15 && spawnMinute <= 25) {
              willQueue = true;
              queueIndex = spawnMinute - 15;
            }
          }
          
          // Special handling for :56 and :57 cars that arrive when queue is moving
          const isLateArrival = (vehicle.direction === 'east' && (spawnMinute === 56 || spawnMinute === 57)) ||
                               (vehicle.direction === 'west' && (spawnMinute === 26 || spawnMinute === 27));
          
          // Calculate staging position
          let x;
          if (willQueue || isLateArrival) {
            // For queued cars, staging position is offset from queue position
            const queueSpacing = 30;
            const baseOffset = 50;
            
            if (isLateArrival) {
              // For late arrivals, calculate where the back of the queue will be
              const queueStartTime = vehicle.direction === 'east' ? 55 : 25;
              const elapsedMinutes = spawnMinute - queueStartTime;
              const paceProgress = elapsedMinutes / 5; // 5 minutes to cross
              const paceDistance = TUNNEL_WIDTH * paceProgress;
              
              // Calculate position based on being at back of moving queue
              const lastQueuedIndex = 10; // :55/:25 is the last in the original queue
              const effectiveIndex = spawnMinute - (vehicle.direction === 'east' ? 45 : 15);
              const offset = (effectiveIndex + 1) * queueSpacing;
              
              const queueBackX = vehicle.direction === 'east' ? 
                QUEUE_AREA_WIDTH + paceDistance - offset :
                TUNNEL_WIDTH + QUEUE_AREA_WIDTH - paceDistance + offset;
              
              x = vehicle.direction === 'east' ? 
                queueBackX - oneMinuteDistance :
                queueBackX + oneMinuteDistance;
            } else {
              // Normal queued car staging
              const queueX = vehicle.direction === 'east' ? 
                QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
                TUNNEL_WIDTH + QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing);
              
              x = vehicle.direction === 'east' ? 
                queueX - oneMinuteDistance :
                queueX + oneMinuteDistance;
            }
          } else {
            // For non-queued cars, staging position is upstream of tunnel entrance
            x = vehicle.direction === 'east' ? 
              QUEUE_AREA_WIDTH - oneMinuteDistance :
              TUNNEL_WIDTH + QUEUE_AREA_WIDTH + oneMinuteDistance;
          }
          
          return {
            x,
            y: getLaneY(vehicle.direction, vehicle.lane),
            state: 'approaching',
            opacity: 0
          };
        }
        return null;
      }
      
      // Calculate when car can enter
      let enterMinute = spawnMinute;
      let queueIndex = 0;
      
      // Special handling for :56/:57 and :26/:27 cars
      const isLateArrival = (vehicle.direction === 'east' && (spawnMinute === 56 || spawnMinute === 57)) ||
                           (vehicle.direction === 'west' && (spawnMinute === 26 || spawnMinute === 27));
      
      if (isBlocked) {
        if (vehicle.direction === 'east') {
          if (spawnMinute >= 45 && spawnMinute <= 55) {
            enterMinute = 56;
            // Queue index based on order of blocked cars
            queueIndex = spawnMinute - 45; // :45=0, :46=1, :47=2, etc.
          }
        } else {
          if (spawnMinute >= 15 && spawnMinute <= 25) {
            enterMinute = 26;
            // Queue index based on order of blocked cars
            queueIndex = spawnMinute - 15; // :15=0, :16=1, :17=2, etc.
          }
        }
      }
      
      if (currentMin < enterMinute) {
        // Normal queued position
        const queueSpacing = 30;
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
      
      // Check if we're following the pace car (queued cars entering at :56/:26)
      const isFollowingPace = (enterMinute === 56 && vehicle.direction === 'east') || 
                              (enterMinute === 26 && vehicle.direction === 'west');
      
      let x;
      if (isFollowingPace || isLateArrival) {
        // Calculate pace car position
        const paceStartMinute = vehicle.direction === 'east' ? 55 : 25;
        const paceProgress = (currentMin - paceStartMinute) / 5; // 5 minutes to cross
        const paceDistance = TUNNEL_WIDTH * paceProgress;
        
        // Pace car position
        const paceX = vehicle.direction === 'east' ? 
          QUEUE_AREA_WIDTH + paceDistance :
          TUNNEL_WIDTH + QUEUE_AREA_WIDTH - paceDistance;
        
        // Follow with queue offset
        const queueSpacing = 30;
        let effectiveIndex;
        
        if (isLateArrival) {
          // Late arrivals use their spawn minute to determine position
          effectiveIndex = spawnMinute - (vehicle.direction === 'east' ? 45 : 15);
        } else {
          effectiveIndex = queueIndex;
        }
        
        const offset = (effectiveIndex + 1) * queueSpacing; // +1 because pace car is in front
        
        x = vehicle.direction === 'east' ? 
          paceX - offset :
          paceX + offset;
      } else {
        // Normal movement
        const distance = CAR_SPEED * 60 * travelMinutes;
        const startX = vehicle.direction === 'east' ? QUEUE_AREA_WIDTH : TUNNEL_WIDTH + QUEUE_AREA_WIDTH;
        x = vehicle.direction === 'east' ? startX + distance : startX - distance;
      }
      
      // Calculate opacity for fade zones
      let opacity = 1;
      const fadeZone = 100;
      const tunnelExitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH : 
        QUEUE_AREA_WIDTH;
      
      // Start fading when exiting tunnel
      if (vehicle.direction === 'east' && x > tunnelExitX) {
        const fadeProgress = (x - tunnelExitX) / fadeZone;
        opacity = Math.max(0, 1 - fadeProgress);
      } else if (vehicle.direction === 'west' && x < tunnelExitX) {
        const fadeProgress = (tunnelExitX - x) / fadeZone;
        opacity = Math.max(0, 1 - fadeProgress);
      }
      
      // Check if completely faded out
      const exitX = vehicle.direction === 'east' ? 
        TUNNEL_WIDTH + QUEUE_AREA_WIDTH + fadeZone : 
        QUEUE_AREA_WIDTH - fadeZone;
      
      if ((vehicle.direction === 'east' && x > exitX) ||
          (vehicle.direction === 'west' && x < exitX)) {
        return null;
      }
      
      // Determine state based on position
      let state: 'approaching' | 'queued' | 'tunnel' | 'exiting' | 'staging' | 'pen';
      if (x >= QUEUE_AREA_WIDTH && x <= TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        state = 'tunnel';
      } else if (vehicle.direction === 'east' && x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH) {
        state = 'exiting';
      } else if (vehicle.direction === 'west' && x < QUEUE_AREA_WIDTH) {
        state = 'exiting';
      } else {
        state = 'approaching';
      }
      
      return {
        x,
        y: getLaneY(vehicle.direction, vehicle.lane),
        state,
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

  // Get color rectangle state at a specific minute time
  const getColorRectAtMinute = (direction: 'east' | 'west', minuteTime: number) => {
    const currentMin = Math.floor(minuteTime / 60) % 60;
    const currentSec = minuteTime % 60;
    const phase = getPhase(currentMin, direction);
    
    // Color zones are calculated based on their leading edge position
    let greenPos = 0, yellowPos = 0, redPos = 0, grayPos = 0;
    
    if (direction === 'west') {
      // Westbound: colors move right to left (decreasing x)
      
      // Green starts when bike phase begins
      const greenStartTime = 15 * 60; // Bike phase starts at :15
      const timeSinceGreenStart = minuteTime - greenStartTime;
      if (timeSinceGreenStart > 0) {
        greenPos = Math.min(CAR_SPEED * timeSinceGreenStart, TUNNEL_WIDTH + 200);
      }
      
      // Yellow follows last bike (emanates from pen close)
      const yellowStartTime = 18 * 60; // Pen closes at :18
      const timeSinceYellowStart = minuteTime - yellowStartTime;
      if (timeSinceYellowStart > 0) {
        // Variable speed for bikes
        const halfwayTime = (TUNNEL_WIDTH / 2) / BIKE_SPEED_DOWNHILL;
        if (timeSinceYellowStart <= halfwayTime) {
          yellowPos = BIKE_SPEED_DOWNHILL * timeSinceYellowStart;
        } else {
          yellowPos = (TUNNEL_WIDTH / 2) + BIKE_SPEED_UPHILL * (timeSinceYellowStart - halfwayTime);
        }
        yellowPos = Math.min(yellowPos, TUNNEL_WIDTH + 200);
      }
      
      // Red follows sweep van
      const sweepStartTime = 20 * 60;
      const timeSinceSweepStart = minuteTime - sweepStartTime;
      if (timeSinceSweepStart > 0) {
        redPos = Math.min(SWEEP_SPEED * timeSinceSweepStart, TUNNEL_WIDTH + 200);
      }
      
      // Gray follows pace car
      const paceStartTime = 25 * 60;
      const timeSincePaceStart = minuteTime - paceStartTime;
      if (timeSincePaceStart > 0) {
        grayPos = Math.min(PACE_SPEED * timeSincePaceStart, TUNNEL_WIDTH + 200);
      }
      
      // Convert positions to rectangles (westbound colors stack from right)
      const rects = {
        green: null as { x: number; width: number } | null,
        yellow: null as { x: number; width: number } | null,
        red: null as { x: number; width: number } | null,
        gray: null as { x: number; width: number } | null
      };
      
      // Gray (rightmost when visible)
      if (grayPos > 0 && grayPos < TUNNEL_WIDTH) {
        rects.gray = {
          x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - grayPos,
          width: grayPos
        };
      }
      
      // Red (between gray and yellow)
      if (redPos > grayPos && redPos < TUNNEL_WIDTH) {
        const redStart = Math.max(0, grayPos);
        const redEnd = Math.min(redPos, TUNNEL_WIDTH);
        if (redEnd > redStart) {
          rects.red = {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - redEnd,
            width: redEnd - redStart
          };
        }
      }
      
      // Yellow (between red and green)
      if (yellowPos > redPos && yellowPos < TUNNEL_WIDTH) {
        const yellowStart = Math.max(0, redPos);
        const yellowEnd = Math.min(yellowPos, TUNNEL_WIDTH);
        if (yellowEnd > yellowStart) {
          rects.yellow = {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - yellowEnd,
            width: yellowEnd - yellowStart
          };
        }
      }
      
      // Green (leftmost when visible)
      if (greenPos > yellowPos) {
        const greenStart = Math.max(0, yellowPos);
        const greenEnd = Math.min(greenPos, TUNNEL_WIDTH);
        if (greenEnd > greenStart && greenStart < TUNNEL_WIDTH) {
          rects.green = {
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - greenEnd,
            width: greenEnd - greenStart
          };
        }
      }
      
      return rects;
    }
    
    // Eastbound: colors move left to right (increasing x)
    if (direction === 'east') {
      // Green starts when bike phase begins
      const greenStartTime = 45 * 60; // Bike phase starts at :45
      const timeSinceGreenStart = minuteTime - greenStartTime;
      if (timeSinceGreenStart > 0) {
        greenPos = Math.min(CAR_SPEED * timeSinceGreenStart, TUNNEL_WIDTH + 200);
      }
      
      // Yellow follows last bike (emanates from pen close)
      const yellowStartTime = 48 * 60; // Pen closes at :48
      const timeSinceYellowStart = minuteTime - yellowStartTime;
      if (timeSinceYellowStart > 0) {
        // Variable speed for bikes
        const halfwayTime = (TUNNEL_WIDTH / 2) / BIKE_SPEED_DOWNHILL;
        if (timeSinceYellowStart <= halfwayTime) {
          yellowPos = BIKE_SPEED_DOWNHILL * timeSinceYellowStart;
        } else {
          yellowPos = (TUNNEL_WIDTH / 2) + BIKE_SPEED_UPHILL * (timeSinceYellowStart - halfwayTime);
        }
        yellowPos = Math.min(yellowPos, TUNNEL_WIDTH + 200);
      }
      
      // Red follows sweep van
      const sweepStartTime = 50 * 60;
      const timeSinceSweepStart = minuteTime - sweepStartTime;
      if (timeSinceSweepStart > 0) {
        redPos = Math.min(SWEEP_SPEED * timeSinceSweepStart, TUNNEL_WIDTH + 200);
      }
      
      // Gray follows pace car
      const paceStartTime = 55 * 60;
      const timeSincePaceStart = minuteTime - paceStartTime;
      if (timeSincePaceStart > 0) {
        grayPos = Math.min(PACE_SPEED * timeSincePaceStart, TUNNEL_WIDTH + 200);
      }
      
      // Convert positions to rectangles (eastbound colors stack from left)
      const rects = {
        green: null as { x: number; width: number } | null,
        yellow: null as { x: number; width: number } | null,
        red: null as { x: number; width: number } | null,
        gray: null as { x: number; width: number } | null
      };
      
      // Gray (leftmost when visible)
      if (grayPos > 0 && grayPos < TUNNEL_WIDTH) {
        rects.gray = {
          x: QUEUE_AREA_WIDTH,
          width: grayPos
        };
      }
      
      // Red (between gray and yellow)
      if (redPos > grayPos && redPos < TUNNEL_WIDTH) {
        const redStart = Math.max(0, grayPos);
        const redEnd = Math.min(redPos, TUNNEL_WIDTH);
        if (redEnd > redStart) {
          rects.red = {
            x: QUEUE_AREA_WIDTH + redStart,
            width: redEnd - redStart
          };
        }
      }
      
      // Yellow (between red and green)
      if (yellowPos > redPos && yellowPos < TUNNEL_WIDTH) {
        const yellowStart = Math.max(0, redPos);
        const yellowEnd = Math.min(yellowPos, TUNNEL_WIDTH);
        if (yellowEnd > yellowStart) {
          rects.yellow = {
            x: QUEUE_AREA_WIDTH + yellowStart,
            width: yellowEnd - yellowStart
          };
        }
      }
      
      // Green (rightmost when visible)
      if (greenPos > yellowPos) {
        const greenStart = Math.max(0, yellowPos);
        const greenEnd = Math.min(greenPos, TUNNEL_WIDTH);
        if (greenEnd > greenStart && greenStart < TUNNEL_WIDTH) {
          rects.green = {
            x: QUEUE_AREA_WIDTH + greenStart,
            width: greenEnd - greenStart
          };
        }
      }
      
      return rects;
    }
    
    return { green: null, yellow: null, red: null, gray: null };
  };

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
              const currentSec = displayTime % 60;
              const currentMinuteTime = Math.floor(displayTime / 60) * 60;
              const nextMinuteTime = currentMinuteTime + 60;
              
              // Get color states at current and next minute
              const currentColors = getColorRectAtMinute('west', currentMinuteTime);
              const nextColors = getColorRectAtMinute('west', nextMinuteTime);
              
              // Interpolation factor
              const t = currentSec / 60;
              
              const currentMin = Math.floor(displayTime / 60) % 60;
              const currentTime = currentMin * 60 + currentSec;
              
              // Render all color rects with interpolation
              const layers = [];
              
              // Gray rect (pace car phase)
              if (currentColors.gray || nextColors.gray) {
                const currentGray = currentColors.gray || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                const nextGray = nextColors.gray || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                
                const grayX = currentGray.x + (nextGray.x - currentGray.x) * t;
                const grayWidth = currentGray.width + (nextGray.width - currentGray.width) * t;
                
                if (grayWidth > 0) {
                  layers.push(
                    <rect key="gray"
                      x={grayX} 
                      y="100" 
                      width={grayWidth} 
                      height={LANE_HEIGHT} 
                      fill="#666" 
                    />
                  );
                }
              }
              
              // Red rect (sweep phase)
              if (currentColors.red || nextColors.red) {
                const currentRed = currentColors.red || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                const nextRed = nextColors.red || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                
                const redX = currentRed.x + (nextRed.x - currentRed.x) * t;
                const redWidth = currentRed.width + (nextRed.width - currentRed.width) * t;
                
                if (redWidth > 0) {
                  layers.push(
                    <rect key="red"
                      x={redX} 
                      y="100" 
                      width={redWidth} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
              }
              
              // Yellow rect
              if (currentColors.yellow || nextColors.yellow) {
                const currentYellow = currentColors.yellow || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                const nextYellow = nextColors.yellow || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                
                const yellowX = currentYellow.x + (nextYellow.x - currentYellow.x) * t;
                const yellowWidth = currentYellow.width + (nextYellow.width - currentYellow.width) * t;
                
                if (yellowWidth > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={yellowX} 
                      y="100" 
                      width={yellowWidth} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
              }
              
              // Green rect  
              if (currentColors.green || nextColors.green) {
                const currentGreen = currentColors.green || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                const nextGreen = nextColors.green || { x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH, width: 0 };
                
                const greenX = currentGreen.x + (nextGreen.x - currentGreen.x) * t;
                const greenWidth = currentGreen.width + (nextGreen.width - currentGreen.width) * t;
                
                if (greenWidth > 0) {
                  layers.push(
                    <rect key="green"
                      x={greenX} 
                      y="100" 
                      width={greenWidth} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
              }
              
              return layers.length > 0 ? <>{layers}</> : null;
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
              const currentSec = displayTime % 60;
              const currentMinuteTime = Math.floor(displayTime / 60) * 60;
              const nextMinuteTime = currentMinuteTime + 60;
              
              // Get color states at current and next minute
              const currentColors = getColorRectAtMinute('east', currentMinuteTime);
              const nextColors = getColorRectAtMinute('east', nextMinuteTime);
              
              // Interpolation factor
              const t = currentSec / 60;
              
              // Render all color rects with interpolation
              const layers = [];
              
              // Gray rect (pace car phase)
              if (currentColors.gray || nextColors.gray) {
                const currentGray = currentColors.gray || { x: QUEUE_AREA_WIDTH, width: 0 };
                const nextGray = nextColors.gray || { x: QUEUE_AREA_WIDTH, width: 0 };
                
                const grayX = currentGray.x + (nextGray.x - currentGray.x) * t;
                const grayWidth = currentGray.width + (nextGray.width - currentGray.width) * t;
                
                if (grayWidth > 0) {
                  layers.push(
                    <rect key="gray"
                      x={grayX} 
                      y="230" 
                      width={grayWidth} 
                      height={LANE_HEIGHT} 
                      fill="#666" 
                    />
                  );
                }
              }
              
              // Red rect (sweep phase)
              if (currentColors.red || nextColors.red) {
                const currentRed = currentColors.red || { x: QUEUE_AREA_WIDTH, width: 0 };
                const nextRed = nextColors.red || { x: QUEUE_AREA_WIDTH, width: 0 };
                
                const redX = currentRed.x + (nextRed.x - currentRed.x) * t;
                const redWidth = currentRed.width + (nextRed.width - currentRed.width) * t;
                
                if (redWidth > 0) {
                  layers.push(
                    <rect key="red"
                      x={redX} 
                      y="230" 
                      width={redWidth} 
                      height={LANE_HEIGHT} 
                      fill="#dc3545" 
                    />
                  );
                }
              }
              
              // Yellow rect
              if (currentColors.yellow || nextColors.yellow) {
                const currentYellow = currentColors.yellow || { x: QUEUE_AREA_WIDTH, width: 0 };
                const nextYellow = nextColors.yellow || { x: QUEUE_AREA_WIDTH, width: 0 };
                
                const yellowX = currentYellow.x + (nextYellow.x - currentYellow.x) * t;
                const yellowWidth = currentYellow.width + (nextYellow.width - currentYellow.width) * t;
                
                if (yellowWidth > 0) {
                  layers.push(
                    <rect key="yellow"
                      x={yellowX} 
                      y="230" 
                      width={yellowWidth} 
                      height={LANE_HEIGHT} 
                      fill="#ffeb3b" 
                    />
                  );
                }
              }
              
              // Green rect  
              if (currentColors.green || nextColors.green) {
                const currentGreen = currentColors.green || { x: QUEUE_AREA_WIDTH, width: 0 };
                const nextGreen = nextColors.green || { x: QUEUE_AREA_WIDTH, width: 0 };
                
                const greenX = currentGreen.x + (nextGreen.x - currentGreen.x) * t;
                const greenWidth = currentGreen.width + (nextGreen.width - currentGreen.width) * t;
                
                if (greenWidth > 0) {
                  layers.push(
                    <rect key="green"
                      x={greenX} 
                      y="230" 
                      width={greenWidth} 
                      height={LANE_HEIGHT} 
                      fill="#28a745" 
                    />
                  );
                }
              }
              
              return layers.length > 0 ? <>{layers}</> : null;
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