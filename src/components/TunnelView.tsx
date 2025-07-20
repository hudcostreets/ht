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

export const TunnelView: FC<TunnelViewProps> = ({ direction, phase, vehicles, colorRectangles }) => {
  const isWestbound = direction === 'west'
  
  // For westbound, we'll flip the entire tunnel view
  // The transform origin should be the center of the entire viewable area
  const viewWidth = LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
  const viewHeight = LAYOUT.LANE_HEIGHT * 2
  const transform = isWestbound ? 'scale(-1, -1)' : undefined
  const transformOrigin = isWestbound ? `${viewWidth / 2} ${viewHeight / 2}` : undefined
  
  // Filter vehicles and rectangles for this direction
  const directionVehicles = vehicles.filter(v => v.direction === direction)
  const directionRectangles = colorRectangles.filter(r => r.direction === direction)
  
  // Bike pen position - for westbound it will be flipped automatically
  const penX = 20  // Always on the left side, flip will put it on right for westbound
  const penY = 90   // Below the lanes
  
  return (
    <g transform={transform} style={{ transformOrigin }}>
      {/* Direction label - needs to be flipped back for westbound */}
      <g transform={isWestbound ? 'scale(-1, -1)' : undefined} style={{ transformOrigin: isWestbound ? '300 -20' : undefined }}>
        <text x={20} y={-20} fontSize="16" fontWeight="bold">
          {direction === 'east' ? 'Eastbound (Manhattan →) - 12th St' : 'Westbound (← NJ) - 14th St'}
        </text>
        <text x={20} y={0} fontSize="12" fill="#666">Phase: {phase}</text>
      </g>
      
      {/* Lanes */}
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={0} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={30} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      
      {/* Bike pen */}
      <rect x={penX} y={penY} width={LAYOUT.BIKE_PEN_WIDTH} height={LAYOUT.BIKE_PEN_HEIGHT} 
        fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
      
      {/* Bike pen label - needs to be flipped back for westbound */}
      <g transform={isWestbound ? 'scale(-1, -1)' : undefined} 
        style={{ transformOrigin: isWestbound ? `${penX + LAYOUT.BIKE_PEN_WIDTH/2} ${penY - 10}` : undefined }}>
        <text x={penX + LAYOUT.BIKE_PEN_WIDTH/2} y={penY - 10} fontSize="12" textAnchor="middle">Bike Pen</text>
      </g>
      
      {/* Lane markers - need to be flipped back for westbound */}
      <g transform={isWestbound ? 'scale(-1, -1)' : undefined}
        style={{ transformOrigin: isWestbound ? `${LAYOUT.QUEUE_AREA_WIDTH + 60} 25` : undefined }}>
        <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={20} fontSize="12" fill="white">
          {direction === 'east' ? 'L Lane (Cars Only)' : 'R Lane'}
        </text>
        <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={50} fontSize="12" fill="white">
          {direction === 'east' ? 'R Lane' : 'L Lane (Cars Only)'}
        </text>
      </g>
      
      {/* Color rectangles - already positioned correctly for this tunnel */}
      {directionRectangles.map((rect, index) => (
        <g key={`${direction}-color-${index}`}>
          <rect
            x={rect.x + LAYOUT.QUEUE_AREA_WIDTH}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.color === 'green' ? '#4caf50' : '#f44336'}
            opacity={0.3}
          />
        </g>
      ))}
      
      {/* Vehicles for this direction */}
      {directionVehicles.map(vehicle => {
        // Calculate position relative to this tunnel view
        let x = vehicle.position.x + LAYOUT.QUEUE_AREA_WIDTH
        let y = vehicle.position.y
        
        // Handle special states
        if (vehicle.position.state === 'pen') {
          // For pen positions, we need to adjust based on direction
          if (direction === 'east') {
            x = vehicle.position.x
            y = vehicle.position.y - 200  // Eastbound pen is at bottom, adjust for local coords
          } else {
            // Westbound pen position needs to be mapped to our coordinate system
            x = vehicle.position.x
            y = vehicle.position.y - 100  // Westbound pen is at top, adjust for local coords
          }
        } else if (vehicle.position.state === 'staging') {
          x = vehicle.position.x
          y = vehicle.position.y - (direction === 'east' ? 200 : 100)
        }
        
        // For emoji direction:
        // - Eastbound vehicles face right (need flip)
        // - Westbound vehicles face left (default)
        // - When the whole tunnel is flipped for westbound, we need to counter-flip westbound vehicles
        const vehicleTransform = direction === 'east' ? 
          `translate(${x * 2},0) scale(-1,1)` :  // Eastbound: flip to face right
          'scale(-1, -1)'  // Westbound: counter-flip to keep facing left after tunnel flip
        
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
            transform={vehicleTransform}
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
