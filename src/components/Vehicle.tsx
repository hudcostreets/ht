import { motion } from 'framer-motion';

interface VehicleProps {
  type: 'car' | 'bike' | 'sweep' | 'pace';
  position: number;
  lane: number;
  direction: 'east' | 'west';
  tunnelLength: number;
}

export function Vehicle({ type, position, lane, direction, tunnelLength }: VehicleProps) {
  const emoji = {
    car: '🚗',
    bike: '🚴',
    sweep: '🚐',
    pace: '🚔'
  }[type];

  const size = {
    car: 30,
    bike: 25,
    sweep: 40,
    pace: 35
  }[type];

  const x = direction === 'east' ? position : tunnelLength - position;
  const y = lane === 1 ? 10 : 10; // Both lanes at same vertical position within their container

  return (
    <div
      className={`vehicle vehicle-${type}`}
      style={{
        position: 'absolute',
        fontSize: `${size}px`,
        left: `${x}%`,
        top: `${y}px`,
        transform: direction === 'west' ? 'scaleX(-1)' : 'scaleX(1)',
      }}
    >
      {emoji}
    </div>
  );
}