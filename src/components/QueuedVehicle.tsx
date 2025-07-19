import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface QueuedVehicleProps {
  type: 'car' | 'bike';
  index: number;
  isActive: boolean;
  direction: 'east' | 'west';
}

export function QueuedVehicle({ type, index, isActive, direction }: QueuedVehicleProps) {
  const [shouldMove, setShouldMove] = useState(false);
  
  useEffect(() => {
    if (isActive) {
      // Delay based on queue position
      const delay = index * 500;
      const timer = setTimeout(() => setShouldMove(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isActive, index]);

  const emoji = type === 'car' ? '🚗' : '🚴';
  
  // Starting position in queue
  const startX = direction === 'east' ? -50 - (index * 30) : 50 + (index * 30);
  const endX = 0;
  
  return (
    <AnimatePresence>
      {!shouldMove && (
        <motion.div
          initial={{ x: startX, opacity: 1 }}
          animate={{ x: startX + (isActive ? 10 : 0) }}
          exit={{ x: endX, opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            fontSize: '20px',
            top: type === 'car' ? '20px' : '40px',
          }}
        >
          {emoji}
        </motion.div>
      )}
    </AnimatePresence>
  );
}