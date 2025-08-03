import { motion } from 'framer-motion'

interface AnalogClockProps {
  minute: number;
  size?: number;
}

export function AnalogClock({ minute, size = 80 }: AnalogClockProps) {
  // Calculate minute hand angle (6 degrees per minute)
  // Use fractional minutes for smooth animation
  const minuteAngle = (minute * 6) - 90 // -90 to start from top

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className="analog-clock"
    >
      {/* Clock face */}
      <circle
        cx="40"
        cy="40"
        r="38"
        fill="white"
        stroke="#333"
        strokeWidth="2"
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
    </svg>
  )
}
