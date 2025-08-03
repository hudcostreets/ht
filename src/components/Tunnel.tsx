import React, { type FC } from 'react'
import { LAYOUT } from '../models/Constants'
import { VehicleI } from "../models/Tunnels"
import { Tunnel as T } from "../models/Tunnel"
import { Direction } from "../models/types"

interface Props {
  dir: Direction
  phase: string
  displayTime: number
  tunnel: T
  colorRectangles: Array<{
    direction: Direction
    color: 'green' | 'red'
    x: number
    width: number
    y: number
    height: number
  }>
}

export const Tunnel: FC<Props> = ({ dir, phase, displayTime, tunnel, colorRectangles }) => {
  const vehs = tunnel.allVehicles(displayTime)
  const rects = colorRectangles.filter(r => r.direction === dir)

  // Y offset for this tunnel from config
  const yOffset = tunnel.config.tunnelYOffset

  return (
    <g>
      {/* Direction label */}
      <text x={20} y={yOffset - 20} fontSize="16" fontWeight="bold">
        {dir === 'east' ? 'Eastbound (Manhattan →) - 12th St' : 'Westbound (← NJ) - 14th St'}
      </text>
      <text x={20} y={yOffset} fontSize="12" fill="#666">Phase: {phase}</text>

      {/* Lanes */}
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset + 30} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />

      {/* Bike pen */}
      {(() => {
        const { penOffset, penWidthPx, penHeightPx } = tunnel.config
        const penX = penOffset.x + LAYOUT.QUEUE_AREA_WIDTH
        const penY = penOffset.y + yOffset
        return (
          <>
            <rect x={penX} y={penY} width={penWidthPx} height={penHeightPx}
              fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
            <text x={penX + penWidthPx / 2} y={penY - 10} fontSize="12" textAnchor="middle">Bike Pen</text>
          </>
        )
      })()}

      {/* Lane markers */}
      <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={yOffset + 20} fontSize="12" fill="white">
        {dir === 'east' ? 'L Lane (Cars Only)' : 'R Lane'}
      </text>
      <text x={LAYOUT.QUEUE_AREA_WIDTH + 10} y={yOffset + 50} fontSize="12" fill="white">
        {dir === 'east' ? 'R Lane' : 'L Lane (Cars Only)'}
      </text>

      {/* Color rectangles */}
      {rects.map((rect, index) => (
        <rect
          key={`${dir}-color-${index}`}
          x={rect.x + LAYOUT.QUEUE_AREA_WIDTH}
          y={rect.y + yOffset}
          width={rect.width}
          height={rect.height}
          fill={rect.color === 'green' ? '#4caf50' : '#f44336'}
          opacity={0.3}
        />
      ))}

      {/* Vehicles */}
      {vehs.map(v => {
        const { id, dir, pos, type, } = v
        // Calculate position
        let x = pos.x + LAYOUT.QUEUE_AREA_WIDTH
        let y = pos.y + yOffset

        // Vehicle emoji direction
        const transform = dir === 'east' ? `translate(${x * 2},0) scale(-1,1)` : undefined

        return (
          <text
            key={id}
            x={x}
            y={y}
            fontSize="20"
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={pos.opacity}
            style={{ userSelect: 'none', cursor: 'pointer' }}
            transform={transform}
            data-tooltip-id={pos.state !== 'origin' ? 'vehicle-tooltip' : undefined}
            data-tooltip-content={pos.state !== 'origin' ? getTooltip(v) : undefined}
          >
            {getEmoji(type)}
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

function getTooltip(vehicle: VehicleI): string {
  const dir = vehicle.dir === 'east' ? 'E/b' : 'W/b'

  if (vehicle.type === 'car') {
    const { laneId } = vehicle.metadata
    return `#${vehicle.metadata.idx} - :${vehicle.metadata.spawnMin.toString().padStart(2, '0')} - ${laneId} lane - ${dir}`
  } else if (vehicle.type === 'bike') {
    return `#${vehicle.metadata.idx} - :${vehicle.metadata.spawnMin.toString().padStart(2, '0')} spawn - ${dir}`
  } else if (vehicle.type === 'sweep') {
    return `Sweep - ${dir}`
  } else {
    return `Pace car - ${dir}`
  }
}
