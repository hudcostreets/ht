import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Vehicle } from './Vehicle';
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
  const [currentMinute, setCurrentMinute] = useState(0);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
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

  // Spawn vehicles based on phase
  useEffect(() => {
    const eastPhase = getPhase(currentMinute, 'east');
    const westPhase = getPhase(currentMinute, 'west');

    // Spawn logic for eastbound
    if (eastPhase === 'normal' && Math.random() < 0.3) {
      // Spawn cars in both lanes
      const lane = Math.random() < 0.5 ? 1 : 2;
      setVehicles(prev => [...prev, {
        id: `car-${vehicleIdCounter.current++}`,
        type: 'car',
        lane,
        position: 0,
        direction: 'east',
        speed: 1 + Math.random() * 0.5
      }]);
    }

    if (eastPhase === 'bikes-enter' && Math.random() < 0.4) {
      // Spawn bikes in lane 2
      setVehicles(prev => [...prev, {
        id: `bike-${vehicleIdCounter.current++}`,
        type: 'bike',
        lane: 2,
        position: 0,
        direction: 'east',
        speed: 0.8 + Math.random() * 0.3
      }]);
    }

    if (eastPhase === 'sweep' && !vehicles.some(v => v.type === 'sweep' && v.direction === 'east')) {
      // Spawn sweep van
      setVehicles(prev => [...prev, {
        id: `sweep-${vehicleIdCounter.current++}`,
        type: 'sweep',
        lane: 2,
        position: 0,
        direction: 'east',
        speed: 0.5 // Slower to pick up stragglers
      }]);
    }

    if (eastPhase === 'pace-car' && !vehicles.some(v => v.type === 'pace' && v.direction === 'east')) {
      // Spawn pace car
      setVehicles(prev => [...prev, {
        id: `pace-${vehicleIdCounter.current++}`,
        type: 'pace',
        lane: 2,
        position: 0,
        direction: 'east',
        speed: 0.7
      }]);
    }

    // Similar logic for westbound (simplified for brevity)
    if (westPhase === 'normal' && Math.random() < 0.3) {
      const lane = Math.random() < 0.5 ? 1 : 2;
      setVehicles(prev => [...prev, {
        id: `car-${vehicleIdCounter.current++}`,
        type: 'car',
        lane,
        position: 0,
        direction: 'west',
        speed: 1 + Math.random() * 0.5
      }]);
    }
  }, [currentMinute]);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setVehicles(prev => prev
        .map(vehicle => ({
          ...vehicle,
          position: vehicle.position + vehicle.speed * speed
        }))
        .filter(vehicle => vehicle.position <= 100)
      );
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

  // Count queuing bikes
  const eastBikeQueue = eastPhase === 'normal' || eastPhase === 'clearing' ? Math.min(Math.floor((currentMinute % 60) / 3), 15) : 0;
  const westBikeQueue = westPhase === 'normal' || westPhase === 'clearing' ? Math.min(Math.floor(((currentMinute + 30) % 60) / 3), 15) : 0;

  return (
    <div className="holland-tunnel-container">
      <header className="control-panel">
        <h1>Holland Tunnel Bike Lane Concept</h1>
        <div className="controls">
          <div className="clock">{formatTime(currentMinute)}</div>
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
          <h2>Eastbound (Manhattan →)</h2>
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
          <div className="queue-area">
            <div className="bike-queue">
              🚴 Bike Queue: {eastBikeQueue} waiting
            </div>
          </div>
        </div>

        <div className="direction-container">
          <h2>Westbound (← New Jersey)</h2>
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
          <div className="queue-area">
            <div className="bike-queue">
              🚴 Bike Queue: {westBikeQueue} waiting
            </div>
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