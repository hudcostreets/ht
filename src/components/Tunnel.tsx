import React, { type FC } from 'react'
import { LAYOUT } from '../models/Constants'
import { Tunnel as T } from "../models/Tunnel"
import { VehicleI } from "../models/Tunnels"
import { Direction } from "../models/types"

interface Props {
  dir: Direction
  phase: string
  displayTime: number
  tunnel: T
}

export const Tunnel: FC<Props> = ({ dir, displayTime, tunnel }) => {
  const vehs = tunnel.allVehicles(displayTime)
  const rects = tunnel.getColorRectangles(displayTime)

  // Y offset for this tunnel from config
  const yOffset = tunnel.config.y

  return (
    <g>
      {/* Direction label - aligned with tunnel left edge */}
      <text x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset - 10} fontSize="16" fontWeight="bold">
        {dir === 'east' ? 'East-bound (NJ → NY)' : 'West-bound (NJ ← NY)'}
      </text>

      {/* Lanes */}
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />
      <rect x={LAYOUT.QUEUE_AREA_WIDTH} y={yOffset + 30} width={LAYOUT.TUNNEL_WIDTH} height={LAYOUT.LANE_HEIGHT} fill="#666" stroke="#333" />

      {/* Double yellow line between lanes */}
      <line x1={LAYOUT.QUEUE_AREA_WIDTH} y1={yOffset + 30}
            x2={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH} y2={yOffset + 30}
            stroke="#FFD700" strokeWidth="2" opacity="0.8" />
      <line x1={LAYOUT.QUEUE_AREA_WIDTH} y1={yOffset + 30}
            x2={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH} y2={yOffset + 30}
            stroke="#FFD700" strokeWidth="2" opacity="0.8"
            transform={`translate(0, -3)`} />

      {/* Downhill/Uphill indicators */}
      <g opacity="0.6">
        {/* Vertical divider at midpoint */}
        <line x1={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH / 2} y1={yOffset}
          x2={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH / 2} y2={yOffset + 60}
          stroke="white" strokeWidth="1" strokeDasharray="3,3" />

        {/* Left half */}
        <text x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH * 0.25} y={yOffset + (dir === 'east' ? 45 : 15)}
          fontSize="14" textAnchor="middle" dominantBaseline="middle" fill="white">
          {dir === 'east' ? 'downhill ↘' : '↖ uphill'}
        </text>

        {/* Right half */}
        <text x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH * 0.75} y={yOffset + (dir === 'east' ? 45 : 15)}
          fontSize="14" textAnchor="middle" dominantBaseline="middle" fill="white">
          {dir === 'east' ? 'uphill ↗' : '↙ downhill'}
        </text>
      </g>

      {/* Bike pen */}
      {(() => {
        const { pen } = tunnel.config
        const penX = pen.x + LAYOUT.QUEUE_AREA_WIDTH
        const penY = pen.y + yOffset
        return (
          <>
            <rect x={penX} y={penY} width={pen.w} height={pen.h}
              fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" rx="6" />
            <text x={penX + pen.w / 2} y={dir === 'east' ? penY + pen.h + 15 : penY - 10} fontSize="12" textAnchor="middle">Bike Pen</text>
          </>
        )
      })()}

      {/* Lane markers */}
      <text x={dir === 'east' ? LAYOUT.QUEUE_AREA_WIDTH + 10 : LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH - 10}
        y={yOffset + 20} fontSize="12" fill="white" opacity="0.6"
        textAnchor={dir === 'east' ? 'start' : 'end'}>
        {dir === 'east' ? 'L Lane' : 'R Lane'}
      </text>
      <text x={dir === 'east' ? LAYOUT.QUEUE_AREA_WIDTH + 10 : LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH - 10}
        y={yOffset + 50} fontSize="12" fill="white" opacity="0.6"
        textAnchor={dir === 'east' ? 'start' : 'end'}>
        {dir === 'east' ? 'R Lane' : 'L Lane'}
      </text>

      {/* Location labels at entrances and exits */}
      <g opacity="0.5">
        {dir === 'east' ? (
          <>
            {/* E/b entrance (left): 12th St (Jersey City) */}
            <text x={LAYOUT.QUEUE_AREA_WIDTH - 10} y={yOffset + 25} fontSize="11" textAnchor="end" fill="#333">
              12th St
            </text>
            <text x={LAYOUT.QUEUE_AREA_WIDTH - 10} y={yOffset + 40} fontSize="11" textAnchor="end" fill="#333">
              (Jersey City)
            </text>
            {/* E/b exit (right): NYC */}
            <text x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH + 10} y={yOffset + 30} fontSize="11" textAnchor="start" fill="#333">
              NYC
            </text>
          </>
        ) : (
          <>
            {/* W/b entrance (right): NYC */}
            <text x={LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH + 10} y={yOffset + 30} fontSize="11" textAnchor="start" fill="#333">
              NYC
            </text>
            {/* W/b exit (left): 14th St (Jersey City) */}
            <text x={LAYOUT.QUEUE_AREA_WIDTH - 10} y={yOffset + 25} fontSize="11" textAnchor="end" fill="#333">
              14th St
            </text>
            <text x={LAYOUT.QUEUE_AREA_WIDTH - 10} y={yOffset + 40} fontSize="11" textAnchor="end" fill="#333">
              (Jersey City)
            </text>
          </>
        )}
      </g>

      {/* Color rectangles - positioned on R lane */}
      {rects.map((rect, index) => (
        <rect
          key={`${dir}-color-${index}`}
          x={rect.x + LAYOUT.QUEUE_AREA_WIDTH}
          y={yOffset + (dir === 'east' ? 30 : 0)} // R lane position
          width={rect.width}
          height={rect.height}
          fill={rect.color === 'green' ? '#4caf50' : '#f44336'}
          opacity={0.3}
        />
      ))}

      {/* Vehicles */}
      {vehs.map(v => {
        const { id, dir, pos, type, } = v
        // Calculate position (y already includes tunnel offset)
        let x = pos.x + LAYOUT.QUEUE_AREA_WIDTH
        let y = pos.y

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
    // Round to 1 decimal place and remove trailing .0
    const spawnMinStr = parseFloat(vehicle.metadata.spawnMin.toFixed(1)).toString()
    return `#${vehicle.metadata.id} - :${spawnMinStr} - ${laneId} lane - ${dir}`
  } else if (vehicle.type === 'bike') {
    // Round to 1 decimal place and remove trailing .0
    const spawnMinStr = parseFloat(vehicle.metadata.spawnMin.toFixed(1)).toString()
    return `#${vehicle.metadata.id} - :${spawnMinStr} spawn - ${dir}`
  } else if (vehicle.type === 'sweep') {
    return `Sweep - ${dir}`
  } else {
    return `Pace car - ${dir}`
  }
}
