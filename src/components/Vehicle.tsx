import React from 'react'
import { LAYOUT } from '../models/Vehicle'

interface VehicleProps {
  id: string
  type: 'car' | 'bike' | 'sweep' | 'pace'
  position: {
    x: number
    y: number
    state: string
    opacity: number
  }
  direction: 'east' | 'west'
  metadata: any
}

export const Vehicle: React.FC<VehicleProps> = ({ id, type, position, direction, metadata }) => {
  // Calculate actual SVG position from model position
  // Model coordinates are relative to tunnel, need to add queue area offset
  let svgX = position.x + LAYOUT.QUEUE_AREA_WIDTH
  let svgY = position.y
  
  // Adjust Y position based on direction
  if (direction === 'west') {
    // Westbound vehicles are in the upper lanes
    svgY = position.y + 100
  } else {
    // Eastbound vehicles are in the lower lanes
    svgY = position.y + 200
  }
  
  // Special handling for vehicles in pen or staging states
  if (position.state === 'pen') {
    // Pen positions are already absolute
    svgX = position.x
    svgY = position.y
  } else if (position.state === 'staging') {
    // Staging positions might need adjustment
    svgX = position.x
    svgY = position.y
  }
  
  // Determine emoji based on type
  let emoji = '🚗'
  if (type === 'bike') emoji = '🚴'
  else if (type === 'sweep') emoji = '🚐'
  else if (type === 'pace') emoji = '🚓'

  // Generate tooltip content
  let tooltip = ''
  const dir = direction === 'east' ? 'E/b' : 'W/b'
  if (type === 'car') {
    const lane = metadata.lane === 'L' ? 'L' : 'R'
    tooltip = `:${metadata.spawnMinute.toString().padStart(2, '0')} - ${lane} lane - ${dir}`
  } else if (type === 'bike') {
    tooltip = `#${metadata.index + 1} - :${metadata.spawnMinute.toString().padStart(2, '0')} spawn - ${dir}`
  } else if (type === 'sweep') {
    tooltip = `Sweep - ${dir}`
  } else {
    tooltip = `Pace car - ${dir}`
  }

  // Only flip eastbound vehicles to face right (emojis face left by default)
  const transform = direction === 'east' ? `translate(${svgX * 2},0) scale(-1,1)` : undefined

  return (
    <text
      x={svgX}
      y={svgY}
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