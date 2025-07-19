import { useState, useEffect, useRef, useCallback } from 'react';
import useSessionStorageState from 'use-session-storage-state';
import { AnalogClock } from './AnalogClock';
import './HollandTunnel.css';

interface Vehicle {
  id: string;
  type: 'car' | 'bike' | 'sweep' | 'pace';
  x: number;
  y: number;
  lane: number;
  direction: 'east' | 'west';
  speed: number;
  state: 'queued' | 'entering' | 'tunnel' | 'exiting' | 'returning';
  targetX?: number;
  targetY?: number;
  spawnTime?: number;
}

// Layout constants
const TUNNEL_WIDTH = 800;
const TUNNEL_HEIGHT = 60;
const LANE_HEIGHT = 30;
const QUEUE_AREA_WIDTH = 150;
const BIKE_PEN_WIDTH = 120;
const BIKE_PEN_HEIGHT = 80;

// Speed constants in MPH
const CAR_MPH = 20;
const SWEEP_MPH = 12;
const BIKE_DOWNHILL_MPH = 15;
const BIKE_UPHILL_MPH = 8;
const PACE_MPH = 20;

// Tunnel dimensions
const TUNNEL_LENGTH_MILES = 2;
const TUNNEL_LENGTH_PX = 800;
const PX_PER_MILE = TUNNEL_LENGTH_PX / TUNNEL_LENGTH_MILES;

// Convert MPH to pixels per update
// At speed=1: 1 real second = 1 simulated minute
// Update interval: 50ms = 20 updates/second
// So 1 simulated hour = 60 real seconds = 1200 updates
function mphToPixelsPerUpdate(mph: number): number {
  const milesPerMinute = mph / 60;
  const pixelsPerMinute = milesPerMinute * PX_PER_MILE;
  const updatesPerMinute = 20; // 20 updates/sec * 1 sec/min
  return pixelsPerMinute / updatesPerMinute;
}

// Calculate actual speeds
const CAR_SPEED = mphToPixelsPerUpdate(CAR_MPH);  // 6.67 px/update
const SWEEP_SPEED = mphToPixelsPerUpdate(SWEEP_MPH);  // 4.0 px/update
const BIKE_SPEED_DOWNHILL = mphToPixelsPerUpdate(BIKE_DOWNHILL_MPH);  // 5.0 px/update
const BIKE_SPEED_UPHILL = mphToPixelsPerUpdate(BIKE_UPHILL_MPH);  // 2.67 px/update
const PACE_SPEED = mphToPixelsPerUpdate(PACE_MPH);  // 6.67 px/update

// Vehicle sizes and spacing
const VEHICLE_LENGTH = 30;  // pixels
const DEFAULT_MIN_GAP_MULTIPLIER = 1;  // car lengths

export function HollandTunnelSVG() {
  const [currentMinute, setCurrentMinute] = useSessionStorageState<number>('ht-current-minute', {
    defaultValue: 0
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isPaused, setIsPaused] = useSessionStorageState<boolean>('ht-is-paused', {
    defaultValue: false
  });
  const [speed, setSpeed] = useSessionStorageState<number>('ht-speed', {
    defaultValue: 1
  });
  const [carsPerMinute, setCarsPerMinute] = useSessionStorageState<number>('ht-cars-per-minute', {
    defaultValue: 1
  });
  const [minGapMultiplier, setMinGapMultiplier] = useSessionStorageState<number>('ht-min-gap', {
    defaultValue: DEFAULT_MIN_GAP_MULTIPLIER
  });
  const vehicleIdCounter = useRef(0);
  // Track simulated time for spawning (in simulated seconds)
  const simulatedTimeRef = useRef(0);
  const lastCarSpawnSimTime = useRef({ 
    eastLane1: 0, eastLane2: 0, 
    westLane1: 0, westLane2: 0,
    eastQueue: 0, westQueue: 0
  });

  // Calculate phase based on current minute
  const getPhase = (minute: number, direction: 'east' | 'west') => {
    const offset = direction === 'west' ? 30 : 0;
    const adjustedMinute = (minute + offset) % 60;
    
    if (adjustedMinute < 45) return 'normal';
    if (adjustedMinute < 48) return 'bikes-enter';
    if (adjustedMinute < 50) return 'clearing';
    if (adjustedMinute < 55) return 'sweep';
    return 'pace-car';
  };

  // Get lane Y position (center of lane)
  // Lane 1 is always left lane (in direction of travel)
  // Lane 2 is always right lane (in direction of travel)
  const getLaneY = (direction: 'east' | 'west', lane: number) => {
    if (direction === 'west') {
      // Westbound: Lane 1 (bottom) is left, Lane 2 (top) is right
      const baseY = 100;
      return baseY + (2 - lane) * LANE_HEIGHT + LANE_HEIGHT / 2;
    } else {
      // Eastbound: Lane 1 (top) is left, Lane 2 (bottom) is right
      const baseY = 200;
      return baseY + (lane - 1) * LANE_HEIGHT + LANE_HEIGHT / 2;
    }
  };

  // Get bike speed based on position
  const getBikeSpeed = (x: number, direction: 'east' | 'west') => {
    const halfwayPoint = TUNNEL_WIDTH / 2 + QUEUE_AREA_WIDTH;
    if (direction === 'east') {
      return x < halfwayPoint ? BIKE_SPEED_DOWNHILL : BIKE_SPEED_UPHILL;
    } else {
      return x > halfwayPoint ? BIKE_SPEED_DOWNHILL : BIKE_SPEED_UPHILL;
    }
  };

  // Check if position is safe to spawn (no collision)
  const isSafeToSpawn = (x: number, y: number, customGap?: number) => {
    const gap = customGap ?? (VEHICLE_LENGTH * minGapMultiplier);
    return !vehicles.some(v => {
      if (v.y !== y) return false;
      const distance = Math.abs(v.x - x);
      return distance < gap;
    });
  };

  // Keyboard handlers
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setIsPaused((prev: boolean) => !prev);
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      // Pause if running
      setIsPaused(true);
      // Step forward or back by 1 minute
      setCurrentMinute(prev => {
        if (e.code === 'ArrowRight') {
          return (prev + 1) % 60;
        } else {
          return prev === 0 ? 59 : prev - 1;
        }
      });
    }
  }, [setIsPaused, setCurrentMinute]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Initialize persistent vehicles (sweep and pace) - only ONE of each
  useEffect(() => {
    setVehicles(prev => {
      // Remove any duplicate sweep/pace vehicles first
      const filtered = prev.filter(v => v.type !== 'sweep' && v.type !== 'pace');
      
      // Add single sweep and pace vehicles
      return [
        ...filtered,
        {
          id: `sweep-main`,
          type: 'sweep',
          x: QUEUE_AREA_WIDTH + 10, // Near R lane entrance
          y: getLaneY('east', 2) + 35,
          lane: 2,
          direction: 'east',
          speed: SWEEP_SPEED,
          state: 'queued'
        },
        {
          id: `pace-main`,
          type: 'pace',
          x: QUEUE_AREA_WIDTH + 10, // Near R lane entrance
          y: getLaneY('east', 2) + 60,
          lane: 2,
          direction: 'east',
          speed: PACE_SPEED,
          state: 'queued'
        }
      ];
    });
  }, []); // Only run once on mount

  // Spawn vehicles
  useEffect(() => {
    if (isPaused) return;

    const spawnInterval = setInterval(() => {
      // Update simulated time: at speed=1, 1 real second = 1 simulated minute = 60 simulated seconds
      // So 50ms real time = 50ms * speed * 60 simulated seconds/real second / 1000ms
      simulatedTimeRef.current += (50 * speed * 60) / 1000; // Convert to simulated seconds
      
      const simTime = simulatedTimeRef.current;
      const eastPhase = getPhase(currentMinute, 'east');
      const westPhase = getPhase(currentMinute, 'west');
      // Cars spawn every 60 simulated seconds / carsPerMinute
      const carSpawnInterval = 60 / carsPerMinute; // simulated seconds between car spawns

      // Eastbound Lane 1 - ALWAYS gets cars at 1 per minute
      if (simTime - lastCarSpawnSimTime.current.eastLane1 >= carSpawnInterval) {
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const lane1Y = getLaneY('east', 1);
        
        if (isSafeToSpawn(spawnX, lane1Y)) {
          setVehicles(prev => [...prev, {
            id: `car-e1-${vehicleIdCounter.current++}`,
            type: 'car',
            x: spawnX,
            y: lane1Y,
            lane: 1,
            direction: 'east',
            speed: CAR_SPEED,
            state: 'tunnel',
            spawnTime: simTime
          }]);
          lastCarSpawnSimTime.current.eastLane1 = simTime;
        }
      }
      
      // Eastbound Lane 2 - release queued cars quickly during normal phase
      if (eastPhase === 'normal') {
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const lane2Y = getLaneY('east', 2);
        const queuedCars = vehicles.filter(v => v.direction === 'east' && v.type === 'car' && v.state === 'queued');
        
        if (queuedCars.length > 0 && isSafeToSpawn(spawnX, lane2Y)) {
          // Release queued cars as fast as spacing allows
          const firstCar = queuedCars[0];
          setVehicles(prev => prev.map(v => 
            v.id === firstCar.id ? { ...v, state: 'entering', targetX: spawnX, targetY: lane2Y } : v
          ));
        } else if (simTime - lastCarSpawnSimTime.current.eastLane2 >= carSpawnInterval) {
          // Only spawn new cars if no queue and at spawn interval
          if (isSafeToSpawn(spawnX, lane2Y)) {
            setVehicles(prev => [...prev, {
              id: `car-e2-${vehicleIdCounter.current++}`,
              type: 'car',
              x: spawnX,
              y: lane2Y,
              lane: 2,
              direction: 'east',
              speed: CAR_SPEED,
              state: 'tunnel',
              spawnTime: simTime
            }]);
            lastCarSpawnSimTime.current.eastLane2 = simTime;
          }
        }
      }

      // Queue cars during bike phase - at the same rate as normal spawning (1 per minute)
      if ((eastPhase === 'bikes-enter' || eastPhase === 'sweep' || eastPhase === 'clearing') 
          && (simTime - lastCarSpawnSimTime.current.eastQueue >= carSpawnInterval)) {
        const queuedCars = vehicles.filter(v => v.direction === 'east' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length < 10) { // Max 10 cars in queue
          setVehicles(prev => [...prev, {
            id: `car-eq-${vehicleIdCounter.current++}`,
            type: 'car',
            x: QUEUE_AREA_WIDTH - 30 - queuedCars.length * 35,
            y: getLaneY('east', 2), // Queue for Lane 2
            lane: 2,
            direction: 'east',
            speed: CAR_SPEED,
            state: 'queued'
          }]);
          lastCarSpawnSimTime.current.eastQueue = simTime;
        }
      }

      // Pace car phase - release queued cars at 1/min rate
      if (eastPhase === 'pace-car') {
        const queuedCars = vehicles.filter(v => v.direction === 'east' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length > 0 && (simTime - lastCarSpawnSimTime.current.eastLane2 >= carSpawnInterval)) {
          const firstCar = queuedCars[0];
          const spawnX = QUEUE_AREA_WIDTH + 10;
          const spawnY = getLaneY('east', 2);
          
          if (isSafeToSpawn(spawnX, spawnY)) {
            setVehicles(prev => prev.map(v => 
              v.id === firstCar.id ? { ...v, state: 'entering', targetX: spawnX, targetY: spawnY } : v
            ));
            lastCarSpawnSimTime.current.eastLane2 = simTime;
          }
        }
      }

      if (eastPhase === 'bikes-enter') {
        // Continuous stream of bikes from pen - no gaps
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const spawnY = getLaneY('east', 2);
        
        if (isSafeToSpawn(spawnX, spawnY)) {
          // Find the first queued bike and move it
          const queuedBikes = vehicles.filter(v => v.direction === 'east' && v.type === 'bike' && v.state === 'queued');
          if (queuedBikes.length > 0) {
            const bike = queuedBikes[0];
            setVehicles(prev => prev.map(v => 
              v.id === bike.id ? { ...v, state: 'entering', targetX: spawnX, targetY: spawnY } : v
            ));
          }
        }
      }

      // Westbound Lane 1 - ALWAYS gets cars at 1 per minute
      if (simTime - lastCarSpawnSimTime.current.westLane1 >= carSpawnInterval) {
        const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
        const lane1Y = getLaneY('west', 1);
        
        if (isSafeToSpawn(spawnX, lane1Y)) {
          setVehicles(prev => [...prev, {
            id: `car-w1-${vehicleIdCounter.current++}`,
            type: 'car',
            x: spawnX,
            y: lane1Y,
            lane: 1,
            direction: 'west',
            speed: CAR_SPEED,
            state: 'tunnel',
            spawnTime: simTime
          }]);
          lastCarSpawnSimTime.current.westLane1 = simTime;
        }
      }
      
      // Westbound Lane 2 - release queued cars quickly during normal phase
      if (westPhase === 'normal') {
        const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
        const lane2Y = getLaneY('west', 2);
        const queuedCars = vehicles.filter(v => v.direction === 'west' && v.type === 'car' && v.state === 'queued');
        
        if (queuedCars.length > 0 && isSafeToSpawn(spawnX, lane2Y)) {
          // Release queued cars as fast as spacing allows
          const firstCar = queuedCars[0];
          setVehicles(prev => prev.map(v => 
            v.id === firstCar.id ? { ...v, state: 'entering', targetX: spawnX, targetY: lane2Y } : v
          ));
        } else if (simTime - lastCarSpawnSimTime.current.westLane2 >= carSpawnInterval) {
          // Only spawn new cars if no queue and at spawn interval
          if (isSafeToSpawn(spawnX, lane2Y)) {
            setVehicles(prev => [...prev, {
              id: `car-w2-${vehicleIdCounter.current++}`,
              type: 'car',
              x: spawnX,
              y: lane2Y,
              lane: 2,
              direction: 'west',
              speed: CAR_SPEED,
              state: 'tunnel',
              spawnTime: simTime
            }]);
            lastCarSpawnSimTime.current.westLane2 = simTime;
          }
        }
      }

      // Queue cars during bike phase - at the same rate as normal spawning (1 per minute)
      if ((westPhase === 'bikes-enter' || westPhase === 'sweep' || westPhase === 'clearing') 
          && (simTime - lastCarSpawnSimTime.current.westQueue >= carSpawnInterval)) {
        const queuedCars = vehicles.filter(v => v.direction === 'west' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length < 10) { // Max 10 cars in queue
          setVehicles(prev => [...prev, {
            id: `car-wq-${vehicleIdCounter.current++}`,
            type: 'car',
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 30 + queuedCars.length * 35,
            y: getLaneY('west', 2), // Queue for Lane 2
            lane: 2,
            direction: 'west',
            speed: CAR_SPEED,
            state: 'queued'
          }]);
          lastCarSpawnSimTime.current.westQueue = simTime;
        }
      }

      if (westPhase === 'bikes-enter') {
        // Continuous stream of bikes from pen - no gaps
        const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
        const spawnY = getLaneY('west', 2);
        
        if (isSafeToSpawn(spawnX, spawnY)) {
          // Find the first queued bike and move it
          const queuedBikes = vehicles.filter(v => v.direction === 'west' && v.type === 'bike' && v.state === 'queued');
          if (queuedBikes.length > 0) {
            const bike = queuedBikes[0];
            setVehicles(prev => prev.map(v => 
              v.id === bike.id ? { ...v, state: 'entering', targetX: spawnX, targetY: spawnY } : v
            ));
          }
        }
      }

      // Move sweep van from waiting position
      const sweepVan = vehicles.find(v => v.type === 'sweep');
      if (sweepVan && sweepVan.state === 'queued') {
        if (eastPhase === 'sweep' && sweepVan.direction === 'east') {
          setVehicles(prev => prev.map(v => 
            v.id === sweepVan.id ? { 
              ...v, 
              state: 'tunnel',
              x: QUEUE_AREA_WIDTH + 10,
              y: getLaneY('east', 2),
              lane: 2
            } : v
          ));
        } else if (westPhase === 'sweep' && sweepVan.direction === 'west') {
          setVehicles(prev => prev.map(v => 
            v.id === sweepVan.id ? { 
              ...v, 
              state: 'tunnel',
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10,
              y: getLaneY('west', 2),
              lane: 2
            } : v
          ));
        }
      }

      // Move pace car from waiting position
      const paceCar = vehicles.find(v => v.type === 'pace');
      if (paceCar && paceCar.state === 'queued') {
        if (eastPhase === 'pace-car' && paceCar.direction === 'east') {
          setVehicles(prev => prev.map(v => 
            v.id === paceCar.id ? { 
              ...v, 
              state: 'tunnel',
              x: QUEUE_AREA_WIDTH + 10,
              y: getLaneY('east', 2),
              lane: 2
            } : v
          ));
        } else if (westPhase === 'pace-car' && paceCar.direction === 'west') {
          setVehicles(prev => prev.map(v => 
            v.id === paceCar.id ? { 
              ...v, 
              state: 'tunnel',
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10,
              y: getLaneY('west', 2),
              lane: 2
            } : v
          ));
        }
      }
      
      // Westbound pace car phase - release queued cars at 1/min rate
      if (westPhase === 'pace-car') {
        const queuedCars = vehicles.filter(v => v.direction === 'west' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length > 0 && (simTime - lastCarSpawnSimTime.current.westLane2 >= carSpawnInterval)) {
          const firstCar = queuedCars[0];
          const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
          const spawnY = getLaneY('west', 2);
          
          if (isSafeToSpawn(spawnX, spawnY)) {
            setVehicles(prev => prev.map(v => 
              v.id === firstCar.id ? { ...v, state: 'entering', targetX: spawnX, targetY: spawnY } : v
            ));
            lastCarSpawnSimTime.current.westLane2 = simTime;
          }
        }
      }

    }, 50); // Check every 50ms for consistent spawning

    return () => clearInterval(spawnInterval);
  }, [currentMinute, isPaused, carsPerMinute, speed, minGapMultiplier]);

  // Add bikes to queue during appropriate phases
  useEffect(() => {
    if (isPaused) return;
    
    const bikeInterval = setInterval(() => {
      setVehicles(prev => {
        const eastPhase = getPhase(currentMinute, 'east');
        const westPhase = getPhase(currentMinute, 'west');
        const newVehicles = [...prev];
        
        // Add bikes to east pen during all phases except bikes-enter (when they're leaving)
        if (eastPhase !== 'bikes-enter') {
          const eastBikes = prev.filter(v => v.direction === 'east' && v.type === 'bike' && v.state === 'queued');
          if (eastBikes.length < 15) {
            newVehicles.push({
              id: `bike-e-${vehicleIdCounter.current++}`,
              type: 'bike',
              x: QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 10 + 20 + Math.random() * (BIKE_PEN_WIDTH - 40),
              y: 270 + 10 + Math.random() * (BIKE_PEN_HEIGHT - 20),
              lane: 2,
              direction: 'east',
              speed: BIKE_SPEED_DOWNHILL,
              state: 'queued'
            });
          }
        }
        
        // Add bikes to west pen during all phases except bikes-enter (when they're leaving)
        if (westPhase !== 'bikes-enter') {
          const westBikes = prev.filter(v => v.direction === 'west' && v.type === 'bike' && v.state === 'queued');
          if (westBikes.length < 15) {
            newVehicles.push({
              id: `bike-w-${vehicleIdCounter.current++}`,
              type: 'bike',
              x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 10 + 20 + Math.random() * (BIKE_PEN_WIDTH - 40),
              y: 30 + Math.random() * (BIKE_PEN_HEIGHT - 30),
              lane: 2,
              direction: 'west',
              speed: BIKE_SPEED_DOWNHILL,
              state: 'queued'
            });
          }
        }
        
        return newVehicles;
      });
    }, 1000 / speed); // Add bike every simulated second

    return () => clearInterval(bikeInterval);
  }, [isPaused, speed, currentMinute]);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const moveInterval = setInterval(() => {
      setVehicles(prev => prev.map(vehicle => {
        const newVehicle = { ...vehicle };

        // Move towards target if entering or returning
        if ((vehicle.state === 'entering' || vehicle.state === 'returning') && vehicle.targetX !== undefined && vehicle.targetY !== undefined) {
          const dx = vehicle.targetX - vehicle.x;
          const dy = vehicle.targetY - vehicle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 5) {
            const moveSpeed = vehicle.state === 'returning' ? 8 : 10; // Faster when returning
            newVehicle.x += (dx / dist) * moveSpeed;
            newVehicle.y += (dy / dist) * moveSpeed;
          } else {
            // Snap to target position and change state
            newVehicle.x = vehicle.targetX;
            newVehicle.y = vehicle.targetY;
            if (vehicle.state === 'entering') {
              newVehicle.state = 'tunnel';
              newVehicle.lane = 2; // Always lane 2 for special vehicles
            }
            delete newVehicle.targetX;
            delete newVehicle.targetY;
          }
        }
        // Move through tunnel (only if not entering)
        else if (vehicle.state === 'tunnel') {
          // Update bike speed based on position
          if (vehicle.type === 'bike') {
            newVehicle.speed = getBikeSpeed(vehicle.x, vehicle.direction);
          }
          
          if (vehicle.direction === 'east') {
            newVehicle.x += vehicle.speed * speed;
          } else {
            newVehicle.x -= vehicle.speed * speed;
          }
        }

        return newVehicle;
      }).filter(v => {
        // Remove only cars that have exited, keep sweep and pace vehicles
        if (v.type === 'car') {
          if (v.direction === 'east' && v.x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50) return false;
          if (v.direction === 'west' && v.x < -50) return false;
        }
        return true;
      }).map(v => {
        // Move sweep and pace vehicles to waiting positions after crossing
        if ((v.type === 'sweep' || v.type === 'pace') && v.state === 'tunnel') {
          if (v.direction === 'east' && v.x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 30) {
            // Eastbound vehicle reached the end, start returning animation
            // Position just above the entrance to west R lane (Lane 2)
            const yOffset = v.type === 'sweep' ? getLaneY('west', 2) - 35 : getLaneY('west', 2) - 60;
            return { 
              ...v, 
              state: 'returning' as 'returning',
              targetX: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10,
              targetY: yOffset,
              speed: 8 // Faster speed for returning
            };
          } else if (v.direction === 'west' && v.x < QUEUE_AREA_WIDTH - 30) {
            // Westbound vehicle reached the end, start returning animation
            // Position right next to the entrance to east R lane (Lane 2)
            const yOffset = v.type === 'sweep' ? getLaneY('east', 2) + 35 : getLaneY('east', 2) + 60;
            return { 
              ...v, 
              state: 'returning' as 'returning',
              targetX: QUEUE_AREA_WIDTH + 10,
              targetY: yOffset,
              speed: 8 // Faster speed for returning
            };
          }
        }
        // Complete the return journey
        if (v.state === 'returning' && v.targetX !== undefined && v.targetY !== undefined) {
          const dx = v.targetX - v.x;
          const dy = v.targetY - v.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 5) {
            // Arrived at waiting position, flip direction
            return {
              ...v,
              x: v.targetX,
              y: v.targetY,
              direction: (v.direction === 'east' ? 'west' : 'east') as 'east' | 'west',
              state: 'queued' as 'queued',
              lane: 2,
              targetX: undefined,
              targetY: undefined,
              speed: v.type === 'sweep' ? SWEEP_SPEED : PACE_SPEED
            };
          }
        }
        return v;
      }));
    }, 50);

    return () => clearInterval(moveInterval);
  }, [isPaused, speed]);

  // Update time
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentMinute(prev => (prev + 1) % 60);
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPaused, speed, setCurrentMinute]);

  const formatTime = (minute: number) => {
    const mins = minute % 60;
    return `0:${mins.toString().padStart(2, '0')}`;
  };

  const eastPhase = getPhase(currentMinute, 'east');
  const westPhase = getPhase(currentMinute, 'west');

  // Vehicle emoji component
  const VehicleEmoji = ({ vehicle }: { vehicle: Vehicle }) => {
    const emoji = {
      car: '🚗',
      bike: '🚴',
      sweep: '🚐',
      pace: '🚔'
    }[vehicle.type];

    const size = {
      car: 24,
      bike: 20,
      sweep: 28,
      pace: 26
    }[vehicle.type];

    return (
      <text
        x={vehicle.x}
        y={vehicle.y + size/4}
        fontSize={size}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ 
          userSelect: 'none',
          transform: vehicle.direction === 'west' ? `scaleX(-1)` : undefined,
          transformOrigin: `${vehicle.x}px ${vehicle.y}px`
        }}
      >
        {emoji}
      </text>
    );
  };

  return (
    <div className="holland-tunnel-container">
      <header className="control-panel">
        <div className="header-left">
          <h1>Holland Tunnel Bike Lane Concept</h1>
          <div className="controls">
            <button onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? '▶️ Play' : '⏸️ Pause'}
            </button>
            <label>
              Speed: 
              <input 
                type="range" 
                min="0.5" 
                max="10" 
                step="0.5" 
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              {speed}x
            </label>
            <label>
              Cars/min: 
              <input 
                type="range" 
                min="0.5" 
                max="5" 
                step="0.5" 
                value={carsPerMinute}
                onChange={(e) => setCarsPerMinute(Number(e.target.value))}
              />
              {carsPerMinute}
            </label>
            <label>
              Gap: 
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.5" 
                value={minGapMultiplier}
                onChange={(e) => setMinGapMultiplier(Number(e.target.value))}
              />
              {minGapMultiplier}x
            </label>
            <span className="hint">Space: play/pause | ←/→: step by 1 minute</span>
          </div>
        </div>
        <div className="clock-container-large">
          <AnalogClock minute={currentMinute} size={120} />
          <div className="digital-time-large">{formatTime(currentMinute)}</div>
        </div>
      </header>

      <main className="tunnel-visualization-svg">
        <svg 
          width={TUNNEL_WIDTH + QUEUE_AREA_WIDTH * 2} 
          height="400" 
          viewBox={`0 0 ${TUNNEL_WIDTH + QUEUE_AREA_WIDTH * 2} 400`}
          style={{ overflow: 'visible' }}
        >
          {/* Westbound tunnel (top) */}
          <g id="westbound">
            <text x="10" y="80" fontSize="16" fontWeight="bold">Westbound (← NJ) - 14th St</text>
            <text x="10" y="95" fontSize="12" fill="#666">Phase: {westPhase}</text>
            
            {/* Tunnel lanes */}
            <rect x={QUEUE_AREA_WIDTH} y="100" width={TUNNEL_WIDTH} height={TUNNEL_HEIGHT} fill="#444" rx="4" />
            <rect x={QUEUE_AREA_WIDTH} y="100" width={TUNNEL_WIDTH} height={LANE_HEIGHT} 
                  fill={westPhase !== 'normal' ? '#28a745' : '#666'} />
            <rect x={QUEUE_AREA_WIDTH} y="130" width={TUNNEL_WIDTH} height={LANE_HEIGHT} fill="#666" />
            <line x1={QUEUE_AREA_WIDTH} y1="130" x2={TUNNEL_WIDTH + QUEUE_AREA_WIDTH} y2="130" stroke="#333" strokeWidth="2" />
            
            {/* Lane labels */}
            <text x={QUEUE_AREA_WIDTH + 10} y="150" fontSize="12" fill="white">L Lane (Cars Only)</text>
            <text x={QUEUE_AREA_WIDTH + 10} y="120" fontSize="12" fill="white">
              R Lane {westPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>

            {/* Bike pen - positioned above right entrance */}
            <rect x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 10} y="20" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                  fill="#ffeb3b" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
            <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 5} y="15" fontSize="12" fontWeight="bold">Bike Pen</text>
            <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH/2 - 10} y="60" fontSize="20" textAnchor="middle">
              {vehicles.filter(v => v.type === 'bike' && v.direction === 'west' && v.state === 'queued').length} bikes
            </text>
          </g>

          {/* Eastbound tunnel (bottom) */}
          <g id="eastbound">
            <text x="10" y="180" fontSize="16" fontWeight="bold">Eastbound (Manhattan →) - 12th St</text>
            <text x="10" y="195" fontSize="12" fill="#666">Phase: {eastPhase}</text>
            
            {/* Tunnel lanes */}
            <rect x={QUEUE_AREA_WIDTH} y="200" width={TUNNEL_WIDTH} height={TUNNEL_HEIGHT} fill="#444" rx="4" />
            <rect x={QUEUE_AREA_WIDTH} y="200" width={TUNNEL_WIDTH} height={LANE_HEIGHT} fill={eastPhase === 'normal' ? '#666' : '#666'} />
            <rect x={QUEUE_AREA_WIDTH} y="230" width={TUNNEL_WIDTH} height={LANE_HEIGHT} 
                  fill={eastPhase !== 'normal' ? '#28a745' : '#666'} />
            <line x1={QUEUE_AREA_WIDTH} y1="230" x2={TUNNEL_WIDTH + QUEUE_AREA_WIDTH} y2="230" stroke="#333" strokeWidth="2" />
            
            {/* Lane labels */}
            <text x={QUEUE_AREA_WIDTH + 10} y="220" fontSize="12" fill="white">L Lane (Cars Only)</text>
            <text x={QUEUE_AREA_WIDTH + 10} y="250" fontSize="12" fill="white">
              R Lane {eastPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>

            {/* Bike pen - positioned below left entrance */}
            <rect x={QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 10} y="270" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                  fill="#ffeb3b" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
            <text x={QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 5} y="263" fontSize="12" fontWeight="bold">Bike Pen</text>
            <text x={QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH/2 - 10} y="310" fontSize="20" textAnchor="middle">
              {vehicles.filter(v => v.type === 'bike' && v.direction === 'east' && v.state === 'queued').length} bikes
            </text>
          </g>

          {/* Waiting areas for sweep/pace vehicles */}
          <g id="waiting-areas" opacity="0.3">
            {/* East waiting area - where vehicles actually wait */}
            <rect x={QUEUE_AREA_WIDTH - 5} y={getLaneY('east', 2) + 25} width="30" height="45" 
                  fill="#ffd700" stroke="#333" strokeDasharray="2,2" />
            <text x={QUEUE_AREA_WIDTH + 10} y={getLaneY('east', 2) + 20} fontSize="10" textAnchor="middle">Wait</text>
            
            {/* West waiting area - where vehicles actually wait */}
            <rect x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 25} y={getLaneY('west', 2) - 70} width="30" height="45" 
                  fill="#ffd700" stroke="#333" strokeDasharray="2,2" />
            <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10} y={getLaneY('west', 2) - 75} fontSize="10" textAnchor="middle">Wait</text>
          </g>
          
          {/* Render all vehicles */}
          {(() => {
            // Ensure unique vehicles by ID
            const uniqueVehicles = vehicles.reduce((acc, vehicle) => {
              if (!acc.some(v => v.id === vehicle.id)) {
                acc.push(vehicle);
              }
              return acc;
            }, [] as Vehicle[]);
            
            return uniqueVehicles.map(vehicle => (
              <VehicleEmoji key={vehicle.id} vehicle={vehicle} />
            ));
          })()}
        </svg>
      </main>

      {/* Debug info */}
      <div style={{ fontSize: '10px', fontFamily: 'monospace', padding: '10px', background: '#f0f0f0', marginTop: '10px' }}>
        <div>Time: {formatTime(currentMinute)} | Speed: {speed}x | Cars/min: {carsPerMinute}</div>
        <div>East phase: {eastPhase} | West phase: {westPhase}</div>
        <div>Vehicles: {vehicles.length}</div>
        <div>Cars: {vehicles.filter(v => v.type === 'car').length} 
          (E: {vehicles.filter(v => v.type === 'car' && v.direction === 'east').length}, 
           W: {vehicles.filter(v => v.type === 'car' && v.direction === 'west').length})</div>
        <div>Bikes: {vehicles.filter(v => v.type === 'bike').length} 
          (E: {vehicles.filter(v => v.type === 'bike' && v.direction === 'east').length}, 
           W: {vehicles.filter(v => v.type === 'bike' && v.direction === 'west').length})</div>
        <div>Special vehicles:</div>
        {vehicles.filter(v => v.type === 'sweep' || v.type === 'pace').map(v => (
          <div key={v.id} style={{ marginLeft: '10px' }}>
            {v.type} {v.direction}: state={v.state}, x={Math.round(v.x)}, y={Math.round(v.y)}
          </div>
        ))}
      </div>
      
      <footer className="legend">
        <div className="timeline-section">
          <h3>Eastbound Timeline (Manhattan →):</h3>
          <ul>
            <li className={eastPhase === 'normal' ? 'current-phase' : ''}>:00-:45 - Normal traffic (both lanes for cars)</li>
            <li className={eastPhase === 'bikes-enter' ? 'current-phase' : ''}>:45-:48 - Bikes enter dedicated lane</li>
            <li className={eastPhase === 'clearing' ? 'current-phase' : ''}>:48-:50 - Clearing period (no entry)</li>
            <li className={eastPhase === 'sweep' ? 'current-phase' : ''}>:50-:55 - Sweep van crosses tunnel</li>
            <li className={eastPhase === 'pace-car' ? 'current-phase' : ''}>:55-:00 - Pace car leads traffic back</li>
          </ul>
        </div>
        <div className="timeline-section">
          <h3>Westbound Timeline (← New Jersey):</h3>
          <ul>
            <li className={westPhase === 'pace-car' ? 'current-phase' : ''}>:25-:30 - Pace car leads traffic back</li>
            <li className={westPhase === 'normal' ? 'current-phase' : ''}>:30-:15 (next hour) - Normal traffic</li>
            <li className={westPhase === 'bikes-enter' ? 'current-phase' : ''}>:15-:18 - Bikes enter dedicated lane</li>
            <li className={westPhase === 'clearing' ? 'current-phase' : ''}>:18-:20 - Clearing period (no entry)</li>
            <li className={westPhase === 'sweep' ? 'current-phase' : ''}>:20-:25 - Sweep van crosses tunnel</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}