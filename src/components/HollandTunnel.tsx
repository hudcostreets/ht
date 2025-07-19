import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useSessionStorageState from 'use-session-storage-state';
import { Vehicle } from './Vehicle';
import { AnalogClock } from './AnalogClock';
import './HollandTunnel.css';

interface VehicleData {
  id: string;
  type: 'car' | 'bike' | 'sweep' | 'pace';
  lane: number;
  position: number;
  direction: 'east' | 'west';
  speed: number;
}

export function HollandTunnel() {
  const [currentMinute, setCurrentMinute] = useSessionStorageState('ht-current-minute', 0);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [isPaused, setIsPaused] = useSessionStorageState('ht-is-paused', false);
  const [speed, setSpeed] = useSessionStorageState('ht-speed', 1);
  const vehicleIdCounter = useRef(0);

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

  // Track last spawn time to ensure consistent spacing
  const lastSpawnTime = useRef({ east: 0, west: 0 });

  // Spawn vehicles continuously
  useEffect(() => {
    if (isPaused) return;

    const spawnInterval = setInterval(() => {
      const now = Date.now();
      const eastPhase = getPhase(currentMinute, 'east');
      const westPhase = getPhase(currentMinute, 'west');

      // Eastbound spawning
      if (eastPhase === 'normal' && now - lastSpawnTime.current.east > 1000) {
        const lane = Math.random() < 0.5 ? 1 : 2;
        setVehicles(prev => [...prev, {
          id: `car-e-${vehicleIdCounter.current++}`,
          type: 'car',
          lane,
          position: 0,
          direction: 'east',
          speed: 1.2
        }]);
        lastSpawnTime.current.east = now;
      }

      if (eastPhase === 'bikes-enter' && now - lastSpawnTime.current.east > 800) {
        setVehicles(prev => [...prev, {
          id: `bike-e-${vehicleIdCounter.current++}`,
          type: 'bike',
          lane: 2,
          position: 0,
          direction: 'east',
          speed: 0.9
        }]);
        lastSpawnTime.current.east = now;
      }

      // Spawn sweep van once per sweep phase
      if (eastPhase === 'sweep') {
        setVehicles(prev => {
          if (!prev.some(v => v.type === 'sweep' && v.direction === 'east')) {
            return [...prev, {
              id: `sweep-e-${vehicleIdCounter.current++}`,
              type: 'sweep',
              lane: 2,
              position: 0,
              direction: 'east',
              speed: 0.5
            }];
          }
          return prev;
        });
      }

      // Spawn pace car and following cars
      if (eastPhase === 'pace-car') {
        setVehicles(prev => {
          const hasPace = prev.some(v => v.type === 'pace' && v.direction === 'east');
          if (!hasPace) {
            return [...prev, {
              id: `pace-e-${vehicleIdCounter.current++}`,
              type: 'pace',
              lane: 2,
              position: 0,
              direction: 'east',
              speed: 0.7
            }];
          }
          return prev;
        });

        // Cars follow pace car
        if (now - lastSpawnTime.current.east > 1200) {
          setVehicles(prev => [...prev, {
            id: `car-e-${vehicleIdCounter.current++}`,
            type: 'car',
            lane: 2,
            position: 0,
            direction: 'east',
            speed: 0.7
          }]);
          lastSpawnTime.current.east = now;
        }
      }

      // Westbound spawning (similar logic)
      if (westPhase === 'normal' && now - lastSpawnTime.current.west > 1000) {
        const lane = Math.random() < 0.5 ? 1 : 2;
        setVehicles(prev => [...prev, {
          id: `car-w-${vehicleIdCounter.current++}`,
          type: 'car',
          lane,
          position: 0,
          direction: 'west',
          speed: 1.2
        }]);
        lastSpawnTime.current.west = now;
      }

      if (westPhase === 'bikes-enter' && now - lastSpawnTime.current.west > 800) {
        setVehicles(prev => [...prev, {
          id: `bike-w-${vehicleIdCounter.current++}`,
          type: 'bike',
          lane: 2,
          position: 0,
          direction: 'west',
          speed: 0.9
        }]);
        lastSpawnTime.current.west = now;
      }

      if (westPhase === 'sweep') {
        setVehicles(prev => {
          if (!prev.some(v => v.type === 'sweep' && v.direction === 'west')) {
            return [...prev, {
              id: `sweep-w-${vehicleIdCounter.current++}`,
              type: 'sweep',
              lane: 2,
              position: 0,
              direction: 'west',
              speed: 0.5
            }];
          }
          return prev;
        });
      }

      if (westPhase === 'pace-car') {
        setVehicles(prev => {
          const hasPace = prev.some(v => v.type === 'pace' && v.direction === 'west');
          if (!hasPace) {
            return [...prev, {
              id: `pace-w-${vehicleIdCounter.current++}`,
              type: 'pace',
              lane: 2,
              position: 0,
              direction: 'west',
              speed: 0.7
            }];
          }
          return prev;
        });

        if (now - lastSpawnTime.current.west > 1200) {
          setVehicles(prev => [...prev, {
            id: `car-w-${vehicleIdCounter.current++}`,
            type: 'car',
            lane: 2,
            position: 0,
            direction: 'west',
            speed: 0.7
          }]);
          lastSpawnTime.current.west = now;
        }
      }
    }, 100); // Check every 100ms for responsive spawning

    return () => clearInterval(spawnInterval);
  }, [currentMinute, isPaused]);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setVehicles(prev => {
        const updated = prev
          .map(vehicle => ({
            ...vehicle,
            position: vehicle.position + vehicle.speed * speed
          }))
          .filter(vehicle => vehicle.position <= 100);
        
        return updated;
      });
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [isPaused, speed]);

  // Animation loop for time
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentMinute(prev => (prev + 1) % 60);
    }, 1000 / speed); // 1 second = 1 minute in simulation

    return () => clearInterval(interval);
  }, [isPaused, speed]);

  const formatTime = (minute: number) => {
    const mins = minute % 60;
    return `0:${mins.toString().padStart(2, '0')}`;
  };

  const eastPhase = getPhase(currentMinute, 'east');
  const westPhase = getPhase(currentMinute, 'west');

  // Count queuing vehicles
  const eastBikeQueue = eastPhase === 'normal' || eastPhase === 'clearing' ? Math.min(Math.floor((currentMinute % 60) / 3), 15) : 0;
  const westBikeQueue = westPhase === 'normal' || westPhase === 'clearing' ? Math.min(Math.floor(((currentMinute + 30) % 60) / 3), 15) : 0;
  
  // Cars queue during bike/sweep phases
  const eastCarQueue = (eastPhase === 'bikes-enter' || eastPhase === 'sweep' || eastPhase === 'clearing') ? 
    Math.min(Math.floor(((currentMinute % 60) - 45) * 2), 10) : 0;
  const westCarQueue = (westPhase === 'bikes-enter' || westPhase === 'sweep' || westPhase === 'clearing') ? 
    Math.min(Math.floor((((currentMinute + 30) % 60) - 45) * 2), 10) : 0;

  return (
    <div className="holland-tunnel-container">
      <header className="control-panel">
        <h1>Holland Tunnel Bike Lane Concept</h1>
        <div className="controls">
          <div className="clock-container">
            <AnalogClock minute={currentMinute} />
            <div className="digital-time">{formatTime(currentMinute)}</div>
          </div>
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
        </div>
      </header>

      <main className="tunnel-visualization">
        <div className="direction-container">
          <h2>Westbound (← New Jersey) - 14th St</h2>
          <div className="phase-indicator">Phase: {westPhase}</div>
          <div className="tunnel westbound">
            <div className="lane lane-1" data-phase={westPhase}>
              <div className="lane-marker">Lane 1</div>
              <AnimatePresence>
                {vehicles
                  .filter(v => v.direction === 'west' && v.lane === 1)
                  .map(vehicle => (
                    <Vehicle
                      key={vehicle.id}
                      type={vehicle.type}
                      position={vehicle.position}
                      lane={vehicle.lane}
                      direction={vehicle.direction}
                      tunnelLength={100}
                    />
                  ))}
              </AnimatePresence>
            </div>
            <div className="lane lane-2" data-phase={westPhase}>
              <div className="lane-marker">Lane 2 {westPhase !== 'normal' ? '(Bike Lane)' : ''}</div>
              <AnimatePresence>
                {vehicles
                  .filter(v => v.direction === 'west' && v.lane === 2)
                  .map(vehicle => (
                    <Vehicle
                      key={vehicle.id}
                      type={vehicle.type}
                      position={vehicle.position}
                      lane={vehicle.lane}
                      direction={vehicle.direction}
                      tunnelLength={100}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="queue-area queue-area-west">
            <div className="bike-pen">
              <span className="queue-label">Bike Pen:</span>
              <div className="pen-bikes">
                <AnimatePresence>
                  {Array.from({ length: westBikeQueue }).map((_, i) => (
                    <motion.span 
                      key={`west-bike-${i}`} 
                      className="penned-bike"
                      initial={{ 
                        left: `${10 + Math.random() * 80}%`,
                        top: `${10 + Math.random() * 60}%`,
                        opacity: 0,
                        scale: 0
                      }}
                      animate={{ 
                        opacity: 1,
                        scale: 1
                      }}
                      exit={{
                        left: '100%',
                        opacity: 0,
                        transition: { duration: 0.5, delay: i * 0.1 }
                      }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      🚴
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            {westCarQueue > 0 && (
              <div className="car-queue-line">
                <span className="queue-label">Car Queue:</span>
                <div className="queue-cars-line">
                  <AnimatePresence>
                    {Array.from({ length: westCarQueue }).map((_, i) => (
                      <motion.span 
                        key={`west-car-${i}`} 
                        className="queued-car-line"
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ 
                          x: 100,
                          opacity: 0,
                          transition: { duration: 0.5, delay: i * 0.2 }
                        }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                      >
                        🚗
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="direction-container">
          <h2>Eastbound (Manhattan →) - 12th St</h2>
          <div className="phase-indicator">Phase: {eastPhase}</div>
          <div className="tunnel eastbound">
            <div className="lane lane-1" data-phase={eastPhase}>
              <div className="lane-marker">Lane 1</div>
              <AnimatePresence>
                {vehicles
                  .filter(v => v.direction === 'east' && v.lane === 1)
                  .map(vehicle => (
                    <Vehicle
                      key={vehicle.id}
                      type={vehicle.type}
                      position={vehicle.position}
                      lane={vehicle.lane}
                      direction={vehicle.direction}
                      tunnelLength={100}
                    />
                  ))}
              </AnimatePresence>
            </div>
            <div className="lane lane-2" data-phase={eastPhase}>
              <div className="lane-marker">Lane 2 {eastPhase !== 'normal' ? '(Bike Lane)' : ''}</div>
              <AnimatePresence>
                {vehicles
                  .filter(v => v.direction === 'east' && v.lane === 2)
                  .map(vehicle => (
                    <Vehicle
                      key={vehicle.id}
                      type={vehicle.type}
                      position={vehicle.position}
                      lane={vehicle.lane}
                      direction={vehicle.direction}
                      tunnelLength={100}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="queue-area queue-area-east">
            <div className="bike-pen">
              <span className="queue-label">Bike Pen:</span>
              <div className="pen-bikes">
                <AnimatePresence>
                  {Array.from({ length: eastBikeQueue }).map((_, i) => (
                    <motion.span 
                      key={`east-bike-${i}`} 
                      className="penned-bike"
                      initial={{ 
                        left: `${10 + Math.random() * 80}%`,
                        top: `${10 + Math.random() * 60}%`,
                        opacity: 0,
                        scale: 0
                      }}
                      animate={{ 
                        opacity: 1,
                        scale: 1
                      }}
                      exit={{
                        left: '-20%',
                        opacity: 0,
                        transition: { duration: 0.5, delay: i * 0.1 }
                      }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      🚴
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            {eastCarQueue > 0 && (
              <div className="car-queue-line">
                <span className="queue-label">Car Queue:</span>
                <div className="queue-cars-line">
                  <AnimatePresence>
                    {Array.from({ length: eastCarQueue }).map((_, i) => (
                      <motion.span 
                        key={`east-car-${i}`} 
                        className="queued-car-line"
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ 
                          x: -100,
                          opacity: 0,
                          transition: { duration: 0.5, delay: i * 0.2 }
                        }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                      >
                        🚗
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="legend">
        <h3>Timeline (per hour):</h3>
        <ul>
          <li>:00-:45 - Normal traffic (both lanes for cars)</li>
          <li>:45-:48 - Bikes enter dedicated lane</li>
          <li>:48-:50 - Clearing period (no entry)</li>
          <li>:50-:55 - Sweep van crosses tunnel</li>
          <li>:55-:00 - Pace car leads traffic back</li>
        </ul>
        <p><em>Westbound cycle is offset by 30 minutes</em></p>
      </footer>
    </div>
  );
}