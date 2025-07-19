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
  state: 'queued' | 'entering' | 'tunnel' | 'exiting';
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

// Speed constants
// Tunnel is 800px = 2 miles
// Update every 50ms = 20 updates/sec
// When speed multiplier = 1: 1 real second = 1 simulated minute
// 
// Cars at 20mph cross 2mi in 6 min = 6 real seconds = 120 updates
// 800px / 120 updates = 6.67 px/update
// BUT this needs to be divided by speed multiplier in the movement code
//
// For consistent speeds without overtaking:
const CAR_SPEED = 1.33;  // Will be multiplied by speed factor
const BIKE_SPEED_DOWNHILL = 1.0;  // 15mph
const BIKE_SPEED_UPHILL = 0.53;   // 8mph 
const SWEEP_SPEED = 0.8;  // 12mph - slower than cars
const PACE_SPEED = CAR_SPEED;  // Same as cars

// Vehicle sizes for spacing
const VEHICLE_LENGTH = 30;  // pixels
const MIN_GAP = 35;  // 1 car length spacing

export function HollandTunnelSVG() {
  const [currentMinute, setCurrentMinute] = useSessionStorageState('ht-current-minute', 0);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isPaused, setIsPaused] = useSessionStorageState('ht-is-paused', false);
  const [speed, setSpeed] = useSessionStorageState('ht-speed', 1);
  const vehicleIdCounter = useRef(0);
  const lastSpawnTime = useRef({ east: 0, west: 0 });

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
  const getLaneY = (direction: 'east' | 'west', lane: number) => {
    const baseY = direction === 'west' ? 100 : 200;
    return baseY + (lane - 1) * LANE_HEIGHT + LANE_HEIGHT / 2;
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
  const isSafeToSpawn = (x: number, y: number, direction: 'east' | 'west') => {
    return !vehicles.some(v => {
      if (v.y !== y) return false;
      const distance = Math.abs(v.x - x);
      return distance < MIN_GAP;
    });
  };

  // Spacebar handler
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setIsPaused(prev => !prev);
    }
  }, [setIsPaused]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Spawn vehicles
  useEffect(() => {
    if (isPaused) return;

    const spawnInterval = setInterval(() => {
      const now = Date.now();
      const eastPhase = getPhase(currentMinute, 'east');
      const westPhase = getPhase(currentMinute, 'west');

      // Eastbound spawning - continuous stream during each phase
      if (eastPhase === 'normal') {
        const lane = Math.random() < 0.5 ? 1 : 2;
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const spawnY = getLaneY('east', lane);
        
        if (isSafeToSpawn(spawnX, spawnY, 'east')) {
          setVehicles(prev => [...prev, {
            id: `car-e-${vehicleIdCounter.current++}`,
            type: 'car',
            x: spawnX,
            y: spawnY,
            lane,
            direction: 'east',
            speed: CAR_SPEED,
            state: 'tunnel',
            spawnTime: now
          }]);
        }
      }

      // Queue cars during bike phase
      if ((eastPhase === 'bikes-enter' || eastPhase === 'sweep') && now - lastSpawnTime.current.east > 2000) {
        const queuedCars = vehicles.filter(v => v.direction === 'east' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length < 8) {
          setVehicles(prev => [...prev, {
            id: `car-e-${vehicleIdCounter.current++}`,
            type: 'car',
            x: 100 - queuedCars.length * 30,
            y: getLaneY('east', 1),
            lane: 1,
            direction: 'east',
            speed: CAR_SPEED,
            state: 'queued'
          }]);
        }
        lastSpawnTime.current.east = now;
      }

      // Pace car phase - continuous stream of cars following pace car
      if (eastPhase === 'pace-car') {
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const spawnY = getLaneY('east', 2);
        
        // Check if pace car has left space
        const paceCar = vehicles.find(v => v.type === 'pace' && v.direction === 'east');
        const canSpawn = !paceCar || paceCar.x > spawnX + MIN_GAP;
        
        if (canSpawn && isSafeToSpawn(spawnX, spawnY, 'east')) {
          setVehicles(prev => [...prev, {
            id: `car-e-${vehicleIdCounter.current++}`,
            type: 'car',
            x: spawnX,
            y: spawnY,
            lane: 2,
            direction: 'east',
            speed: CAR_SPEED,
            state: 'tunnel',
            spawnTime: now
          }]);
        }
      }

      if (eastPhase === 'bikes-enter') {
        // Continuous stream of bikes from pen - no gaps
        const spawnX = QUEUE_AREA_WIDTH + 10;
        const spawnY = getLaneY('east', 2);
        
        if (isSafeToSpawn(spawnX, spawnY, 'east')) {
          // Find the bike closest to entrance
          setVehicles(prev => {
            const queuedBikes = prev.filter(v => v.direction === 'east' && v.type === 'bike' && v.state === 'queued');
            if (queuedBikes.length > 0) {
              // Sort by distance to entrance
              queuedBikes.sort((a, b) => a.x - b.x);
              const bike = queuedBikes[0];
              bike.state = 'entering';
              bike.targetX = spawnX;
              bike.targetY = spawnY;
            }
            return [...prev];
          });
        }
      }

      // Westbound spawning
      if (westPhase === 'normal') {
        const lane = Math.random() < 0.5 ? 1 : 2;
        const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
        const spawnY = getLaneY('west', lane);
        
        if (isSafeToSpawn(spawnX, spawnY, 'west')) {
          setVehicles(prev => [...prev, {
            id: `car-w-${vehicleIdCounter.current++}`,
            type: 'car',
            x: spawnX,
            y: spawnY,
            lane,
            direction: 'west',
            speed: CAR_SPEED,
            state: 'tunnel'
          }]);
        }
      }

      // Queue cars during bike phase
      if ((westPhase === 'bikes-enter' || westPhase === 'sweep') && now - lastSpawnTime.current.west > 2000) {
        const queuedCars = vehicles.filter(v => v.direction === 'west' && v.type === 'car' && v.state === 'queued');
        if (queuedCars.length < 8) {
          setVehicles(prev => [...prev, {
            id: `car-w-${vehicleIdCounter.current++}`,
            type: 'car',
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50 + queuedCars.length * 25,
            y: getLaneY('west', 1) + 15,
            lane: 1,
            direction: 'west',
            speed: 2,
            state: 'queued'
          }]);
        }
        lastSpawnTime.current.west = now;
      }

      if (westPhase === 'bikes-enter') {
        // Continuous stream of bikes from pen - no gaps
        const spawnX = TUNNEL_WIDTH + QUEUE_AREA_WIDTH - 10;
        const spawnY = getLaneY('west', 2);
        
        if (isSafeToSpawn(spawnX, spawnY, 'west')) {
          // Find the bike closest to entrance (rightmost for westbound)
          setVehicles(prev => {
            const queuedBikes = prev.filter(v => v.direction === 'west' && v.type === 'bike' && v.state === 'queued');
            if (queuedBikes.length > 0) {
              // Sort by distance to entrance (rightmost first)
              queuedBikes.sort((a, b) => b.x - a.x);
              const bike = queuedBikes[0];
              bike.state = 'entering';
              bike.targetX = spawnX;
              bike.targetY = spawnY;
            }
            return [...prev];
          });
        }
      }

      // Spawn sweep vans
      if (eastPhase === 'sweep' && !vehicles.some(v => v.type === 'sweep' && v.direction === 'east')) {
        setVehicles(prev => [...prev, {
          id: `sweep-e-${vehicleIdCounter.current++}`,
          type: 'sweep',
          x: QUEUE_AREA_WIDTH - 30,
          y: getLaneY('east', 2),
          lane: 2,
          direction: 'east',
          speed: 1,
          state: 'tunnel'
        }]);
      }

      if (westPhase === 'sweep' && !vehicles.some(v => v.type === 'sweep' && v.direction === 'west')) {
        setVehicles(prev => [...prev, {
          id: `sweep-w-${vehicleIdCounter.current++}`,
          type: 'sweep',
          x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 30,
          y: getLaneY('west', 2),
          lane: 2,
          direction: 'west',
          speed: 1,
          state: 'tunnel'
        }]);
      }

      // Spawn pace cars
      if (eastPhase === 'pace-car' && !vehicles.some(v => v.type === 'pace' && v.direction === 'east')) {
        setVehicles(prev => [...prev, {
          id: `pace-e-${vehicleIdCounter.current++}`,
          type: 'pace',
          x: QUEUE_AREA_WIDTH - 30,
          y: getLaneY('east', 2),
          lane: 2,
          direction: 'east',
          speed: 1.5,
          state: 'tunnel'
        }]);
      }

      if (westPhase === 'pace-car' && !vehicles.some(v => v.type === 'pace' && v.direction === 'west')) {
        setVehicles(prev => [...prev, {
          id: `pace-w-${vehicleIdCounter.current++}`,
          type: 'pace',
          x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 30,
          y: getLaneY('west', 2),
          lane: 2,
          direction: 'west',
          speed: 1.5,
          state: 'tunnel'
        }]);
      }

    }, 100);

    return () => clearInterval(spawnInterval);
  }, [currentMinute, isPaused]);

  // Add bikes to queue during normal phase
  useEffect(() => {
    if (isPaused) return;
    
    const bikeInterval = setInterval(() => {
      const eastPhase = getPhase(currentMinute, 'east');
      const westPhase = getPhase(currentMinute, 'west');

      // Add bikes to east pen
      if (eastPhase === 'normal' || eastPhase === 'clearing') {
        const eastBikes = vehicles.filter(v => v.direction === 'east' && v.type === 'bike' && v.state === 'queued');
        if (eastBikes.length < 15) {
          setVehicles(prev => [...prev, {
            id: `bike-e-${vehicleIdCounter.current++}`,
            type: 'bike',
            x: QUEUE_AREA_WIDTH + 20 + Math.random() * (BIKE_PEN_WIDTH - 40),
            y: 280 + Math.random() * (BIKE_PEN_HEIGHT - 30),
            lane: 2,
            direction: 'east',
            speed: BIKE_SPEED_DOWNHILL,
            state: 'queued'
          }]);
        }
      }

      // Add bikes to west pen
      if (westPhase === 'normal' || westPhase === 'clearing') {
        const westBikes = vehicles.filter(v => v.direction === 'west' && v.type === 'bike' && v.state === 'queued');
        if (westBikes.length < 15) {
          setVehicles(prev => [...prev, {
            id: `bike-w-${vehicleIdCounter.current++}`,
            type: 'bike',
            x: TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH + Math.random() * (BIKE_PEN_WIDTH - 40),
            y: 30 + Math.random() * (BIKE_PEN_HEIGHT - 30),
            lane: 2,
            direction: 'west',
            speed: BIKE_SPEED_DOWNHILL,
            state: 'queued'
          }]);
        }
      }
    }, 1000); // Add bike every second

    return () => clearInterval(bikeInterval);
  }, [currentMinute, vehicles, isPaused]);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const moveInterval = setInterval(() => {
      setVehicles(prev => prev.map(vehicle => {
        const newVehicle = { ...vehicle };

        // Move towards target if entering
        if (vehicle.state === 'entering' && vehicle.targetX !== undefined) {
          const dx = vehicle.targetX - vehicle.x;
          const dy = vehicle.targetY! - vehicle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 5) {
            newVehicle.x += (dx / dist) * vehicle.speed * speed;
            newVehicle.y += (dy / dist) * vehicle.speed * speed;
          } else {
            newVehicle.state = 'tunnel';
            newVehicle.targetX = undefined;
            newVehicle.targetY = undefined;
          }
        }
        // Move through tunnel
        else if (vehicle.state === 'tunnel' || vehicle.state === 'entering') {
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
        // Remove vehicles that have exited
        if (v.direction === 'east' && v.x > TUNNEL_WIDTH + QUEUE_AREA_WIDTH + 50) return false;
        if (v.direction === 'west' && v.x < -50) return false;
        return true;
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
            <span className="hint">Press spacebar to play/pause</span>
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
            <rect x={QUEUE_AREA_WIDTH} y="100" width={TUNNEL_WIDTH} height={LANE_HEIGHT} fill={westPhase === 'normal' ? '#666' : '#666'} />
            <rect x={QUEUE_AREA_WIDTH} y="130" width={TUNNEL_WIDTH} height={LANE_HEIGHT} 
                  fill={westPhase !== 'normal' ? '#28a745' : '#666'} />
            <line x1={QUEUE_AREA_WIDTH} y1="130" x2={TUNNEL_WIDTH + QUEUE_AREA_WIDTH} y2="130" stroke="#333" strokeWidth="2" />
            
            {/* Lane labels */}
            <text x={QUEUE_AREA_WIDTH + 10} y="120" fontSize="12" fill="white">Lane 1</text>
            <text x={QUEUE_AREA_WIDTH + 10} y="150" fontSize="12" fill="white">
              Lane 2 {westPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>

            {/* Bike pen - positioned above right entrance */}
            <rect x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 10} y="20" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                  fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
            <text x={TUNNEL_WIDTH + QUEUE_AREA_WIDTH - BIKE_PEN_WIDTH - 5} y="15" fontSize="12" fontWeight="bold">Bike Pen</text>
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
            <text x={QUEUE_AREA_WIDTH + 10} y="220" fontSize="12" fill="white">Lane 1</text>
            <text x={QUEUE_AREA_WIDTH + 10} y="250" fontSize="12" fill="white">
              Lane 2 {eastPhase !== 'normal' ? '(Bike Lane)' : ''}
            </text>

            {/* Bike pen - positioned below left entrance */}
            <rect x={QUEUE_AREA_WIDTH + 10} y="270" width={BIKE_PEN_WIDTH} height={BIKE_PEN_HEIGHT} 
                  fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="4" />
            <text x={QUEUE_AREA_WIDTH + 15} y="365" fontSize="12" fontWeight="bold">Bike Pen</text>
          </g>

          {/* Render all vehicles */}
          {vehicles.map(vehicle => (
            <VehicleEmoji key={vehicle.id} vehicle={vehicle} />
          ))}
        </svg>
      </main>

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