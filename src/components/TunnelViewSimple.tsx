import React, { type FC } from 'react'
import { LAYOUT } from '../models/Vehicle'

interface TunnelViewProps {
  direction: 'east' | 'west'
  phase: string
  vehicles: Array<{
    id: string
    type: 'car' | 'bike' | 'sweep' | 'pace'
    position: { x: number; y: number; state: string; opacity: number }
    direction: 'east' | 'west'
    metadata: any
  }>
  colorRectangles: Array<{
    direction: 'east' | 'west'
    color: 'green' | 'red'
    x: number
    width: number
    y: number
    height: number
  }>
}

export const TunnelViewSimple: FC<TunnelViewProps> = ({ direction, phase, vehicles, colorRectangles }) => {
  // Filter vehicles and rectangles for this direction
  const directionVehicles = vehicles.filter(v => v.direction === direction)
  const directionRectangles = colorRectangles.filter(r => r.direction === direction)
  
  // Y offset for this tunnel (westbound on top, eastbound on bottom)
  const yOffset = direction === 'west' ? 100 : 200
  
  return (
    <g>
      {/* Direction label */}
      <text x={20} y={yOffset - 20} fontSize="16" fontWeight="bold">
        {direction === 'east' ? 'Eastbound (Manhattan →) - 12th St' : 'Westbound (← NJ) - 14th St'}
      </text>
      <text x={20} y={yOffset} fontSize="12" fill="#666">Phase: {phase}</text>
      
      {/* Lanes */}
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset + 30} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      
      {/* Bike pen */}
      {direction === 'east' ? (
        <>
          <rect x={20} y={yOffset + 90} width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} 
            fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
          <text x={80} y={yOffset + 80} fontSize="12" textAnchor="middle">Bike Pen</text>
        </>
      ) : (
        <>
          <rect x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 20} y={yOffset - 60} 
            width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} 
            fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
          <text x={LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 80} y={yOffset - 70} fontSize="12" textAnchor="middle">Bike Pen</text>
        </>
      )}
      
      {/* Lane markers */}
      <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={yOffset + 20} fontSize="12" fill="white">
        {direction === 'east' ? 'L Lane (Cars Only)' : 'R Lane'}
      </text>
      <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={yOffset + 50} fontSize="12" fill="white">
        {direction === 'east' ? 'R Lane' : 'L Lane (Cars Only)'}
      </text>
      
      {/* Color rectangles */}
      {directionRectangles.map((rect, index) => (
        <rect
          key={`${direction}-color-${index}`}
          x={rect.x + LAYOUT.QUEUE_AREA_WIDTH}
          y={rect.y + yOffset}
          width={rect.width}
          height={rect.height}
          fill={rect.color === 'green' ? '#4caf50' : '#f44336'}
          opacity={0.3}
        />
      ))}
      
      {/* Vehicles */}
      {directionVehicles.map(vehicle => {
        // Calculate position
        let x = vehicle.position.x + LAYOUT.QUEUE_AREA_WIDTH
        let y = vehicle.position.y + yOffset
        
        // Handle special states
        if (vehicle.position.state === 'pen' || vehicle.position.state === 'staging') {
          x = vehicle.position.x
          y = vehicle.position.y
        }
        
        // Vehicle emoji direction
        const transform = vehicle.direction === 'east' ? `translate(${x * 2},0) scale(-1,1)` : undefined
        
        return (
          <text
            key={vehicle.id}
            x={x}
            y={y}
            fontSize="20"
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={vehicle.position.opacity}
            style={{ userSelect: 'none', cursor: 'pointer' }}
            transform={transform}
            data-tooltip-id="vehicle-tooltip"
            data-tooltip-content={getTooltip(vehicle)}
          >
            {getEmoji(vehicle.type)}
          </text>
        )
      })}
    </g>
  )
}

function getEmoji(type: string): string {
  switch (type) {
    case 'bike': return '🚴'
    case 'sweep': return '🚐'
    case 'pace': return '🚓'
    default: return '🚗'
  }
}

function getTooltip(vehicle: any): string {
  const dir = vehicle.direction === 'east' ? 'E/b' : 'W/b'
  
  if (vehicle.type === 'car') {
    const lane = vehicle.metadata.lane === 'L' ? 'L' : 'R'
    return `:${vehicle.metadata.spawnMinute.toString().padStart(2, '0')} - ${lane} lane - ${dir}`
  } else if (vehicle.type === 'bike') {
    return `#${vehicle.metadata.index + 1} - :${vehicle.metadata.spawnMinute.toString().padStart(2, '0')} spawn - ${dir}`
  } else if (vehicle.type === 'sweep') {
    return `Sweep - ${dir}`
  } else {
    return `Pace car - ${dir}`
  }
}
