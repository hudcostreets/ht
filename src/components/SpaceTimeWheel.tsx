import React, { type FC, useMemo, memo } from 'react'

interface Props {
  currentMinute: number
  tunnel: any // E/b tunnel instance
}

const SpaceTimeWheelComponent: FC<Props> = ({ currentMinute, tunnel }) => {
  const centerX = 60
  const centerY = 70
  const outerRadius = 50
  const innerRadius = 15
  // For equal areas: π(outer² - middle²) = π(middle² - inner²)
  // outer² - middle² = middle² - inner²
  // outer² + inner² = 2 * middle²
  // middle = sqrt((outer² + inner²) / 2)
  const middleRadius = Math.sqrt((outerRadius * outerRadius + innerRadius * innerRadius) / 2)

  // Convert minute to angle (0 minutes = top = -90 degrees)
  const minuteToAngle = (min: number) => {
    return (min / 60) * 360 - 90
  }

  // Generate colored segments
  const segments = useMemo(() => {
    const segs = []
    const { period } = tunnel.config
    const tunnelWidth = tunnel.config.laneWidthPx

    // Reduced resolution for better performance
    const timeSteps = 60 // One sample per minute
    const spaceSteps = 10 // Divide tunnel into 10 segments

    for (let timeStep = 0; timeStep < timeSteps; timeStep++) {
      const min = (timeStep / timeSteps) * 60 // Use 60 minutes for full circle
      // Adjust for E/b offset (45 minutes)
      const relMin = tunnel.relMins(min + 45)
      const colorData = tunnel.colorZones.at(relMin)

      const [greenStart, greenEnd, redEnd] = colorData || [-1, -1, -1]

      // For each position segment in the tunnel
      for (let spaceStep = 0; spaceStep < spaceSteps; spaceStep++) {
        const pos = spaceStep / spaceSteps // 0 to 1 (entrance to exit)
        const pixelPos = pos * tunnelWidth

        // Determine color at this position
        let color = '#666' // Default grey
        if (greenStart >= 0 && greenEnd >= 0) {
          if (pixelPos >= greenStart && pixelPos <= greenEnd) {
            color = '#4caf50' // Green
          } else if (greenEnd < redEnd) {
            // Red zone after green
            if (pixelPos > greenEnd && pixelPos <= redEnd) {
              color = '#f44336' // Red
            }
          } else if (redEnd < greenStart) {
            // Red zone before green (pace behind sweep)
            if (pixelPos >= redEnd && pixelPos < greenStart) {
              color = '#f44336' // Red
            }
          }
        }

        // Calculate radii for this space segment
        const r1 = innerRadius + (middleRadius - innerRadius) * (spaceStep / spaceSteps)
        const r2 = innerRadius + (middleRadius - innerRadius) * ((spaceStep + 1) / spaceSteps)

        // Calculate angles for this time segment
        const angle1 = minuteToAngle(min)
        const angle2 = minuteToAngle(min + 60 / timeSteps)

        segs.push({
          color,
          r1,
          r2,
          angle1,
          angle2
        })
      }
    }

    return segs
  }, [tunnel, innerRadius, middleRadius])

  // Create path for a wedge segment
  const createWedgePath = (r1: number, r2: number, angle1: number, angle2: number) => {
    const rad1 = (angle1 * Math.PI) / 180
    const rad2 = (angle2 * Math.PI) / 180

    const x1 = centerX + r1 * Math.cos(rad1)
    const y1 = centerY + r1 * Math.sin(rad1)
    const x2 = centerX + r2 * Math.cos(rad1)
    const y2 = centerY + r2 * Math.sin(rad1)
    const x3 = centerX + r2 * Math.cos(rad2)
    const y3 = centerY + r2 * Math.sin(rad2)
    const x4 = centerX + r1 * Math.cos(rad2)
    const y4 = centerY + r1 * Math.sin(rad2)

    // Use arc for smoother curves
    const largeArcFlag = Math.abs(angle2 - angle1) > 180 ? 1 : 0

    return `
      M ${x1} ${y1}
      L ${x2} ${y2}
      A ${r2} ${r2} 0 ${largeArcFlag} 1 ${x3} ${y3}
      L ${x4} ${y4}
      A ${r1} ${r1} 0 ${largeArcFlag} 0 ${x1} ${y1}
      Z
    `
  }

  // Clock hand
  const handAngle = minuteToAngle(currentMinute % 60)
  const handRad = (handAngle * Math.PI) / 180
  const handX1 = centerX + innerRadius * 0.5 * Math.cos(handRad)
  const handY1 = centerY + innerRadius * 0.5 * Math.sin(handRad)
  const handX2 = centerX + outerRadius * 0.95 * Math.cos(handRad)
  const handY2 = centerY + outerRadius * 0.95 * Math.sin(handRad)

  return (
    <svg width="120" height="140" viewBox="0 0 120 140">
      {/* Background circles */}
      <circle cx={centerX} cy={centerY} r={outerRadius} fill="none" stroke="#ddd" strokeWidth="1" />
      <circle cx={centerX} cy={centerY} r={middleRadius} fill="none" stroke="#ddd" strokeWidth="1" />
      <circle cx={centerX} cy={centerY} r={innerRadius} fill="none" stroke="#ddd" strokeWidth="1" />

      {/* Outer ring (L lane - always grey) */}
      <path
        d={`
          M ${centerX} ${centerY - outerRadius}
          A ${outerRadius} ${outerRadius} 0 1 1 ${centerX} ${centerY + outerRadius}
          A ${outerRadius} ${outerRadius} 0 1 1 ${centerX} ${centerY - outerRadius}
          L ${centerX} ${centerY - middleRadius}
          A ${middleRadius} ${middleRadius} 0 1 0 ${centerX} ${centerY + middleRadius}
          A ${middleRadius} ${middleRadius} 0 1 0 ${centerX} ${centerY - middleRadius}
          Z
        `}
        fill="#666"
        opacity="0.3"
      />

      {/* Inner ring segments (R lane) */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={createWedgePath(seg.r1, seg.r2, seg.angle1, seg.angle2)}
          fill={seg.color}
          opacity="0.3"
          stroke="none"
        />
      ))}

      {/* Clock hand */}
      <line
        x1={handX1}
        y1={handY1}
        x2={handX2}
        y2={handY2}
        stroke="#000"
        strokeWidth="2"
        opacity="0.8"
      />

      {/* Center dot */}
      <circle cx={centerX} cy={centerY} r="2" fill="#000" />

      {/* Minute markers */}
      {[0, 15, 30, 45].map(min => {
        const angle = minuteToAngle(min)
        const rad = (angle * Math.PI) / 180
        const x1 = centerX + (outerRadius - 5) * Math.cos(rad)
        const y1 = centerY + (outerRadius - 5) * Math.sin(rad)
        const x2 = centerX + (outerRadius) * Math.cos(rad)
        const y2 = centerY + (outerRadius) * Math.sin(rad)

        return (
          <g key={min}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#333"
              strokeWidth="1.5"
            />
            <text
              x={centerX + (outerRadius - 12) * Math.cos(rad)}
              y={centerY + (outerRadius - 12) * Math.sin(rad)}
              fontSize="10"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#333"
            >
              :{String(min).padStart(2, '0')}
            </text>
          </g>
        )
      })}

      {/* Labels */}
      <text
        x={centerX}
        y={12}
        fontSize="9"
        textAnchor="middle"
        fill="#333"
        fontWeight="bold"
      >
        E/b Space-Time
      </text>

      {/* Legend markers */}
      <g transform="translate(5, 125)">
        <rect x="0" y="0" width="8" height="4" fill="#666" opacity="0.3" />
        <text x="10" y="3" fontSize="7" fill="#666">Car</text>

        <rect x="30" y="0" width="8" height="4" fill="#4caf50" opacity="0.3" />
        <text x="40" y="3" fontSize="7" fill="#666">Bike</text>

        <rect x="60" y="0" width="8" height="4" fill="#f44336" opacity="0.3" />
        <text x="70" y="3" fontSize="7" fill="#666">DMZ</text>
      </g>
    </svg>
  )
}

export const SpaceTimeWheel = memo(SpaceTimeWheelComponent)