import { LAYOUT } from './Constants'
import type { TunnelsConfig } from './Tunnels'

export const Common = {
  period: 60,
  lengthMi: 2,
  carMph: 24,      // mph
  bikeUpMph: 8,
  bikeDownMph: 15,
  bikeFlatMph: 12,
  penCloseMin: 3,
  sweepStartMin: 5,
  paceCarStartMin: 10,
  carsPerMin: 1,  // 60 cars per hour
  carsReleasedPerMin: 5,
  bikesPerMin: 0.25, // 15 bikes per hour
  bikesReleasedPerMin: 5,

  // Layout (eastbound-specific coordinates)
  laneWidthPx: LAYOUT.TUNNEL_WIDTH,
  laneHeightPx: LAYOUT.LANE_HEIGHT,
  penWidthPx: LAYOUT.BIKE_PEN_WIDTH,
  penHeightPx: LAYOUT.BIKE_PEN_HEIGHT,
  queuedCarWidthPx: 30,   // Queued car spacing
  fadeDistance: 100,  // Pixels to travel while fading out
  fadeMins: 1,
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
    speed: 12,
    stagingOffset: 35
  },
  
  paceConfig: {
    speed: Common.carMph,
    stagingOffset: 60
  }
}
