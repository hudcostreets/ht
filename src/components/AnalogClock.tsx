import { motion } from 'framer-motion'

interface AnalogClockProps {
  minute: number;
  size?: number;
  x?: number;
  y?: number;
  embedded?: boolean;
}

export function AnalogClock({ minute, size = 80, x = 0, y = 0, embedded = false }: AnalogClockProps) {
  // Calculate minute hand angle (6 degrees per minute)
  // Use fractional minutes for smooth animation
  const minuteAngle = (minute * 6) - 90 // -90 to start from top

  // Create arc path for a slice on the clock
  const createArcPath = (startMin: number, endMin: number, innerRadius: number, outerRadius: number) => {
    const startAngle = (startMin * 6) - 90 // Convert minutes to degrees, -90 to start from top
    const endAngle = (endMin * 6) - 90

    const startAngleRad = (startAngle * Math.PI) / 180
    const endAngleRad = (endAngle * Math.PI) / 180

    const x1Inner = 40 + innerRadius * Math.cos(startAngleRad)
    const y1Inner = 40 + innerRadius * Math.sin(startAngleRad)
    const x2Inner = 40 + innerRadius * Math.cos(endAngleRad)
    const y2Inner = 40 + innerRadius * Math.sin(endAngleRad)

    const x1Outer = 40 + outerRadius * Math.cos(startAngleRad)
    const y1Outer = 40 + outerRadius * Math.sin(startAngleRad)
    const x2Outer = 40 + outerRadius * Math.cos(endAngleRad)
    const y2Outer = 40 + outerRadius * Math.sin(endAngleRad)

    const largeArcFlag = endMin - startMin > 30 ? 1 : 0

    return `
      M ${x1Inner} ${y1Inner}
      L ${x1Outer} ${y1Outer}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}
      L ${x2Inner} ${y2Inner}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}
      Z
    `
  }

  const clockContent = (
    <>
      {/* Clock face */}
      <circle
        cx="40"
        cy="40"
        r="38"
        fill="white"
        stroke="#333"
        strokeWidth="2"
      />

      {/* Green slice for E/b bikes (45-48) */}
      <path
        d={createArcPath(45, 48, 20, 36)}
        fill="#4caf50"
        opacity="0.3"
      />

      {/* Red slice for E/b DMZ (48-50) */}
      <path
        d={createArcPath(48, 50, 20, 36)}
        fill="#f44336"
        opacity="0.3"
      />

      {/* Green slice for W/b bikes (15-18) */}
      <path
        d={createArcPath(15, 18, 20, 36)}
        fill="#4caf50"
        opacity="0.3"
      />

      {/* Red slice for W/b DMZ (18-20) */}
      <path
        d={createArcPath(18, 20, 20, 36)}
        fill="#f44336"
        opacity="0.3"
      />

      {/* Hour markers */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30) - 90
        const isMainHour = i % 3 === 0
        const x1 = 40 + (isMainHour ? 30 : 32) * Math.cos(angle * Math.PI / 180)
        const y1 = 40 + (isMainHour ? 30 : 32) * Math.sin(angle * Math.PI / 180)
        const x2 = 40 + 35 * Math.cos(angle * Math.PI / 180)
        const y2 = 40 + 35 * Math.sin(angle * Math.PI / 180)

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#333"
            strokeWidth={isMainHour ? 2 : 1}
          />
        )
      })}

      {/* Numbers */}
      <text x="40" y="15" textAnchor="middle" fontSize="12" fontWeight="bold">12</text>
      <text x="65" y="43" textAnchor="middle" fontSize="12" fontWeight="bold">3</text>
      <text x="40" y="70" textAnchor="middle" fontSize="12" fontWeight="bold">6</text>
      <text x="15" y="43" textAnchor="middle" fontSize="12" fontWeight="bold">9</text>

      {/* Hour hand (fixed at 12) */}
      <line
        x1="40"
        y1="40"
        x2="40"
        y2="20"
        stroke="#333"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Minute hand */}
      <motion.line
        x1="40"
        y1="40"
        x2={40 + 25 * Math.cos(minuteAngle * Math.PI / 180)}
        y2={40 + 25 * Math.sin(minuteAngle * Math.PI / 180)}
        stroke="#007bff"
        strokeWidth="3"
        strokeLinecap="round"
        animate={{ rotate: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Center dot */}
      <circle cx="40" cy="40" r="3" fill="#333" />
    </>
  )

  // If embedded, return as a group element
  if (embedded) {
    return (
      <g transform={`translate(${x}, ${y}) scale(${size / 80})`}>
        {clockContent}
      </g>
    )
  }

  // Otherwise return as standalone SVG
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className="analog-clock"
    >
      {clockContent}
    </svg>
  )
}
