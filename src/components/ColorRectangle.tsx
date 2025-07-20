import React from 'react'
import { LAYOUT } from '../models/Vehicle'

interface ColorRectangleProps {
  direction: 'east' | 'west'
  color: 'green' | 'red'
  x: number
  width: number
  y: number
  height: number
}

export const ColorRectangle: React.FC<ColorRectangleProps> = ({ direction, color, x, width, y, height }) => {
  // Adjust position for SVG coordinates
  const svgX = x + LAYOUT.QUEUE_AREA_WIDTH
  const svgY = direction === 'west' ? y + 100 : y + 200
  
  return (
    <rect
      x={svgX}
      y={svgY}
      width={width}
      height={height}
      fill={color === 'green' ? '#4caf50' : '#f44336'}
      opacity={0.3}
    />
  )
}