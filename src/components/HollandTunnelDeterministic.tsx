import { useState, useEffect, useCallback, useRef } from 'react';
import useSessionStorageState from 'use-session-storage-state';
import { Tooltip } from 'react-tooltip';
import { AnalogClock } from './AnalogClock';
import { Bike, Vehicle as VehicleClass, LAYOUT, SPEEDS, getPhase, getLaneY } from '../models/Vehicle';
import type { VehicleData, VehiclePosition } from '../models/Vehicle';
import { Car } from '../models/EnhancedVehicle';
import type { CarData } from '../models/EnhancedVehicle';
import './HollandTunnel.css';

// Special vehicle types that aren't in the models yet
interface SpecialVehicle extends VehicleData {
  instance?: VehicleClass;
}

// Convert our internal time to model time (seconds)
const toModelTime = (displayTime: number): number => displayTime;

// Precompute all vehicles
const createVehicles = (): SpecialVehicle[] => {
  const vehicles: SpecialVehicle[] = [];
  
  // Cars for each lane
  for (let minute = 0; minute < 60; minute++) {
    // Lane 1 cars always spawn
    const eastCar1: CarData = { 
      id: `car-e1-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 1, 
      direction: 'east' as const 
    };
    const westCar1: CarData = { 
      id: `car-w1-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 1, 
      direction: 'west' as const 
    };
    
    vehicles.push(
      { ...eastCar1, instance: new Car(eastCar1) },
      { ...westCar1, instance: new Car(westCar1) }
    );
    
    // Lane 2 (R lane) cars - need to handle queue positions
    const eastCar2: CarData = { 
      id: `car-e2-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 2, 
      direction: 'east' as const 
    };
    
    // Set queue position for eastbound cars that queue
    if (minute >= 45 && minute <= 57) {
      eastCar2.queuePosition = minute - 45;
      if (minute === 56 || minute === 57) {
        eastCar2.paceCarStartTime = 55; // Pace car starts at :55
      }
    }
    
    const westCar2: CarData = { 
      id: `car-w2-${minute}`, 
      type: 'car' as const, 
      spawnMinute: minute, 
      lane: 2, 
      direction: 'west' as const 
    };
    
    // Set queue position for westbound cars that queue
    if (minute >= 15 && minute <= 27) {
      westCar2.queuePosition = minute - 15;
      if (minute === 26 || minute === 27) {
        westCar2.paceCarStartTime = 25; // Pace car starts at :25
      }
    }
    
    vehicles.push(
      { ...eastCar2, instance: new Car(eastCar2) },
      { ...westCar2, instance: new Car(westCar2) }
    );
  }
  
  // 15 bikes for each direction (spawn every 4 minutes)
  for (let i = 0; i < 15; i++) {
    const eastBike = { 
      id: `bike-e-${i}`, 
      type: 'bike' as const, 
      spawnMinute: i, 
      lane: 2, 
      direction: 'east' as const 
    };
    const westBike = { 
      id: `bike-w-${i}`, 
      type: 'bike' as const, 
      spawnMinute: i, 
      lane: 2, 
      direction: 'west' as const 
    };
    
    vehicles.push(
      { ...eastBike, instance: new Bike(eastBike) },
      { ...westBike, instance: new Bike(westBike) }
    );
  }
  
  // Sweep and pace vehicles (we'll handle these specially for now)
  vehicles.push(
    { id: 'sweep-main', type: 'sweep' as const, spawnMinute: 0, lane: 2, direction: 'east' as const },
    { id: 'pace-main', type: 'pace' as const, spawnMinute: 0, lane: 2, direction: 'east' as const }
  );
  
  return vehicles;
};

const ALL_VEHICLES = createVehicles();

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
  const [displayTime, setDisplayTime] = useState(initialMinute * 60);
  const animationRef = useRef<number | undefined>(undefined);
  
  // State for arrow key transitions
  const [targetTime, setTargetTime] = useState(initialMinute * 60);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Update current minute when display time changes
  useEffect(() => {
    const newMinute = Math.floor(displayTime / 60) % 60;
    if (newMinute !== currentMinute) {
      setCurrentMinute(newMinute);
    }
  }, [displayTime, currentMinute, setCurrentMinute]);

  // Get vehicle position for special vehicles (sweep and pace)
  const getSpecialVehiclePosition = (vehicle: SpecialVehicle, time: number): VehiclePosition | null => {
    const currentMin = Math.floor(time / 60) % 60;
    
    if (vehicle.type === 'sweep') {
      const transitMinutes = 10;
      const stagingOffset = 35;
      
      // Sweep schedule
      if (currentMin >= 50) {
        // Moving east :50-:59
        const progress = (currentMin - 50) / transitMinutes;
        const distance = LAYOUT.TUNNEL_WIDTH * progress;
        return { x: LAYOUT.QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
      } else if (currentMin < 10) {
        if (currentMin >= 0 && currentMin <= 5) {
          // Moving to west staging :00-:05
          const progress = Math.min(currentMin / 4, 1);
          const startX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH;
          const endX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50;
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
            x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
            y: getLaneY('west', 2) - stagingOffset,
            state: 'staging',
            opacity: 1
          };
        }
      } else if (currentMin >= 20 && currentMin < 30) {
        // Moving west :20-:29
        const progress = (currentMin - 20) / transitMinutes;
        const distance = LAYOUT.TUNNEL_WIDTH * progress;
        return { 
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance, 
          y: getLaneY('west', 2), 
          state: 'tunnel', 
          opacity: 1 
        };
      } else if (currentMin >= 30 && currentMin <= 35) {
        // Moving to east staging :30-:35
        const progress = (currentMin - 30) / 5;
        const startX = LAYOUT.QUEUE_AREA_WIDTH;
        const endX = LAYOUT.QUEUE_AREA_WIDTH - 50;
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
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
          y: getLaneY('west', 2) - stagingOffset,
          state: 'staging',
          opacity: 1
        };
      } else {
        // Staging east :36-:49
        return {
          x: LAYOUT.QUEUE_AREA_WIDTH - 50,
          y: getLaneY('east', 2) + stagingOffset,
          state: 'staging',
          opacity: 1
        };
      }
    } else if (vehicle.type === 'pace') {
      const transitMinutes = 5;
      const stagingOffset = 60;
      
      // Pace schedule
      if (currentMin >= 55) {
        // Moving east :55-:59
        const progress = (currentMin - 55) / transitMinutes;
        const distance = LAYOUT.TUNNEL_WIDTH * progress;
        return { x: LAYOUT.QUEUE_AREA_WIDTH + distance, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 };
      } else if (currentMin >= 0 && currentMin <= 5) {
        // Moving to west staging :00-:05
        const progress = Math.min(currentMin / 4, 1);
        const startX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH;
        const endX = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50;
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
        const distance = LAYOUT.TUNNEL_WIDTH * progress;
        return { 
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance, 
          y: getLaneY('west', 2), 
          state: 'tunnel', 
          opacity: 1 
        };
      } else if (currentMin >= 30 && currentMin <= 35) {
        // Moving to east staging :30-:35
        const progress = (currentMin - 30) / 5;
        const startX = LAYOUT.QUEUE_AREA_WIDTH;
        const endX = LAYOUT.QUEUE_AREA_WIDTH - 50;
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
          x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
          y: getLaneY('west', 2) - stagingOffset,
          state: 'staging',
          opacity: 1
        };
      } else {
        // Staging east :36-:54
        return {
          x: LAYOUT.QUEUE_AREA_WIDTH - 50,
          y: getLaneY('east', 2) + stagingOffset,
          state: 'staging',
          opacity: 1
        };
      }
    }
    
    return null;
  };

  // Get vehicle position with interpolation
  const getVehiclePosition = (vehicle: SpecialVehicle, time: number): VehiclePosition | null => {
    // For vehicles with instances, use their getPosition method
    if (vehicle.instance) {
      return vehicle.instance.getPosition(toModelTime(time));
    }
    
    // For special vehicles, interpolate between minute positions
    const currentSec = time % 60;
    const currentMinuteTime = Math.floor(time / 60) * 60;
    const nextMinuteTime = currentMinuteTime + 60;
    
    const currentPos = getSpecialVehiclePosition(vehicle, currentMinuteTime);
    const nextPos = getSpecialVehiclePosition(vehicle, nextMinuteTime);
    
    if (!currentPos) return null;
    if (!nextPos) return currentPos;
    
    // Interpolate between positions
    const interpolationFactor = currentSec / 60;
    
    return {
      x: currentPos.x + (nextPos.x - currentPos.x) * interpolationFactor,
      y: currentPos.y + (nextPos.y - currentPos.y) * interpolationFactor,
      state: currentPos.state,
      opacity: currentPos.opacity + (nextPos.opacity - currentPos.opacity) * interpolationFactor
    };
  };

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!isPaused && !isTransitioning) {
      setDisplayTime(prevTime => {
        const newTime = prevTime + speed;
        return newTime % 3600;
      });
    } else if (isTransitioning) {
      // Smooth transition for arrow key navigation
      setDisplayTime(prevTime => {
        const diff = targetTime - prevTime;
        if (Math.abs(diff) < 0.5) {
          setIsTransitioning(false);
          return targetTime;
        }
        // Linear transition: move at constant speed
        const step = 4; // Units per frame (faster transition)
        if (diff > 0) {
          return Math.min(prevTime + step, targetTime);
        } else {
          return Math.max(prevTime - step, targetTime);
        }
      });
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [isPaused, isTransitioning, targetTime, speed]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      } else if (e.code === 'ArrowRight' && isPaused) {
        // Calculate target based on current target (if transitioning) or display time
        const baseTime = isTransitioning ? targetTime : displayTime;
        const currentMinute = Math.floor(baseTime / 60);
        const newTime = ((currentMinute + 1) * 60) % 3600;
        setTargetTime(newTime);
        setIsTransitioning(true);
      } else if (e.code === 'ArrowLeft' && isPaused) {
        // Calculate target based on current target (if transitioning) or display time
        const baseTime = isTransitioning ? targetTime : displayTime;
        const currentMinute = Math.floor(baseTime / 60);
        const newTime = ((currentMinute - 1 + 60) % 60) * 60;
        setTargetTime(newTime);
        setIsTransitioning(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, setIsPaused, displayTime, isTransitioning, targetTime]);

  // Timeline click handler
  const handleTimelineClick = (minute: number) => {
    setTargetTime(minute * 60);
    setIsTransitioning(true);
    setIsPaused(true);
  };

  // Get all visible vehicles
  const visibleVehicles = ALL_VEHICLES
    .map(vehicle => ({
      vehicle,
      position: getVehiclePosition(vehicle, displayTime)
    }))
    .filter(({ position }) => position !== null);

  const renderVehicle = (vehicle: SpecialVehicle, position: VehiclePosition) => {
    let emoji = '🚗';
    if (vehicle.type === 'bike') emoji = '🚴';
    else if (vehicle.type === 'sweep') emoji = '🚜';
    else if (vehicle.type === 'pace') emoji = '🚓';

    // Flip eastbound vehicles to face right
    const transform = vehicle.direction === 'east' ? `translate(${position.x * 2},0) scale(-1,1)` : undefined;

    return (
      <text
        key={vehicle.id}
        x={position.x}
        y={position.y}
        fontSize="20"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={position.opacity}
        style={{ userSelect: 'none' }}
        transform={transform}
      >
        {emoji}
      </text>
    );
  };

  // Color rectangles with interpolation
  const renderColorRectangles = () => {
    const rects = [];
    const currentSec = displayTime % 60;
    const interpolationFactor = currentSec / 60;
    
    // Eastbound rectangles
    const eastPhase = getPhase(currentMinute, 'east');
    const eastNextPhase = getPhase((currentMinute + 1) % 60, 'east');
    
    // Green rectangle for bikes
    if (eastPhase === 'bikes-enter' || eastPhase === 'clearing' || 
        eastNextPhase === 'bikes-enter' || eastNextPhase === 'clearing') {
      let startProgress = 0;
      let endProgress = 0;
      
      if (currentMinute >= 44 && currentMinute < 50) {
        startProgress = Math.max(0, currentMinute - 44) / 6;
        endProgress = Math.min(1, (currentMinute + 1 - 44) / 6);
      }
      
      const width = LAYOUT.TUNNEL_WIDTH * (startProgress + (endProgress - startProgress) * interpolationFactor);
      if (width > 0) {
        rects.push(
          <rect
            key="east-green"
            x={LAYOUT.QUEUE_AREA_WIDTH}
            y={230}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(40, 167, 69, 0.3)"
          />
        );
      }
    }
    
    // Yellow rectangle for bike progress
    if (currentMinute >= 45 && currentMinute < 55) {
      const bikeProgress = (currentMinute - 45 + interpolationFactor) / 10;
      const width = LAYOUT.TUNNEL_WIDTH * Math.min(1, bikeProgress * 1.5);
      if (width > 0) {
        rects.push(
          <rect
            key="east-yellow"
            x={LAYOUT.QUEUE_AREA_WIDTH}
            y={230}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(255, 193, 7, 0.3)"
          />
        );
      }
    }
    
    // Red rectangle for sweep DMZ
    if (currentMinute >= 50) {
      const sweepProgress = (currentMinute - 50 + interpolationFactor) / 10;
      const width = LAYOUT.TUNNEL_WIDTH * sweepProgress;
      if (width > 0) {
        rects.push(
          <rect
            key="east-red"
            x={LAYOUT.QUEUE_AREA_WIDTH}
            y={230}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(220, 53, 69, 0.3)"
          />
        );
      }
    }
    
    // Westbound rectangles (30 minute offset)
    const westPhase = getPhase(currentMinute, 'west');
    const westNextPhase = getPhase((currentMinute + 1) % 60, 'west');
    
    // Green rectangle for bikes
    if (westPhase === 'bikes-enter' || westPhase === 'clearing' || 
        westNextPhase === 'bikes-enter' || westNextPhase === 'clearing') {
      let startProgress = 0;
      let endProgress = 0;
      
      if (currentMinute >= 14 && currentMinute < 20) {
        startProgress = Math.max(0, currentMinute - 14) / 6;
        endProgress = Math.min(1, (currentMinute + 1 - 14) / 6);
      }
      
      const width = LAYOUT.TUNNEL_WIDTH * (startProgress + (endProgress - startProgress) * interpolationFactor);
      if (width > 0) {
        rects.push(
          <rect
            key="west-green"
            x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - width}
            y={130}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(40, 167, 69, 0.3)"
          />
        );
      }
    }
    
    // Yellow rectangle for bike progress
    if (currentMinute >= 15 && currentMinute < 25) {
      const bikeProgress = (currentMinute - 15 + interpolationFactor) / 10;
      const width = LAYOUT.TUNNEL_WIDTH * Math.min(1, bikeProgress * 1.5);
      if (width > 0) {
        rects.push(
          <rect
            key="west-yellow"
            x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - width}
            y={130}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(255, 193, 7, 0.3)"
          />
        );
      }
    }
    
    // Red rectangle for sweep DMZ
    if (currentMinute >= 20 && currentMinute < 30) {
      const sweepProgress = (currentMinute - 20 + interpolationFactor) / 10;
      const width = LAYOUT.TUNNEL_WIDTH * sweepProgress;
      if (width > 0) {
        rects.push(
          <rect
            key="west-red"
            x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - width}
            y={130}
            width={width}
            height={LAYOUT.LANE_HEIGHT}
            fill="rgba(220, 53, 69, 0.3)"
          />
        );
      }
    }
    
    return rects;
  };

  const eastPhase = getPhase(currentMinute, 'east');
  const westPhase = getPhase(currentMinute, 'west');

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
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
            </label>
            <span className="hint">Space: play/pause | ←/→: step by 1 minute</span>
          </div>
        </div>
        <div className="clock-container-large">
          <AnalogClock minute={displayTime / 60} />
          <div className="digital-time-large">
            0:{Math.floor(displayTime / 60) % 60}
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
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={130} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill={westPhase === 'normal' ? '#666' : '#28a745'} stroke="#333" />
            
            {/* Bike pen */}
            <rect x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 20} y={40} width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
            <text x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 80} y={30} fontSize="12" textAnchor="middle">Bike Pen</text>
            
            {/* Eastbound */}
            <text x={20} y={180} fontSize="16" fontWeight="bold">Eastbound (Manhattan →) - 12th St</text>
            <text x={20} y={200} fontSize="12" fill="#666">Phase: {eastPhase}</text>
            
            {/* Lanes */}
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={200} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
            <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={230} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill={eastPhase === 'normal' ? '#666' : '#28a745'} stroke="#333" />
            
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
  );
}