import { LAYOUT, SPEEDS } from './Vehicle'
import type { TunnelsConfig } from './Tunnels'

export const Common = {
  period: 60,
  lengthMi: 2,
  carMph: 24,      // mph
  bikeUpMph: SPEEDS.BIKE_UPHILL,
  bikeDownMph: SPEEDS.BIKE_DOWNHILL,
  penCloseMin: 3,
  sweepStartMin: 5,
  paceCarStartMin: 10,
  bikesPerMin: 0.25, // 15 bikes per hour
  carsPerMin: 1,  // 60 cars per hour
  bikesReleasedPerMin: 5,

  // Layout (eastbound-specific coordinates)
  laneWidthPx: LAYOUT.TUNNEL_WIDTH,
  laneHeightPx: LAYOUT.LANE_HEIGHT,
  penWidthPx: LAYOUT.BIKE_PEN_WIDTH,
  penHeightPx: LAYOUT.BIKE_PEN_HEIGHT,
  queuedCarWidthPx: 30,   // Queued car spacing
  fadeDistance: 100,  // Pixels to travel while fading out
}

// Default configuration for Holland Tunnel
export const HOLLAND_TUNNEL_CONFIG: TunnelsConfig = {
  eastbound: {
    direction: 'east',
    offsetMin: 45,
    penRelativeX: -LAYOUT.QUEUE_AREA_WIDTH + 70,  // Relative to tunnel start
    penRelativeY: 110,  // Below the lanes
    ...Common,
  },
  
  westbound: {
    direction: 'west',
    offsetMin: 15,  // Pen opens at :15
    penRelativeX: LAYOUT.TUNNEL_WIDTH + 70,  // Relative to tunnel start
    penRelativeY: -80,  // Above the lanes
    ...Common,
  },
  
  sweepConfig: {
    speed: SPEEDS.SWEEP,
    stagingOffset: 35
  },
  
  paceConfig: {
    speed: SPEEDS.CAR,  // Same as car speed
    stagingOffset: 60
  }
}
