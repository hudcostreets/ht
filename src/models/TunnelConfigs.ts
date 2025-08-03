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
  paceStartMin: 10,
  carsPerMin: 1,  // 60 cars per hour
  carsReleasedPerMin: 5,
  bikesPerMin: 0.25, // 15 bikes per hour
  bikesReleasedPerMin: 5,
  officialResetMins: 5,

  // Layout (eastbound-specific coordinates)
  laneWidthPx: LAYOUT.TUNNEL_WIDTH,
  laneHeightPx: LAYOUT.LANE_HEIGHT,
  queuedCarWidthPx: 30,   // Queued car spacing
  fadeDistance: 100,  // Pixels to travel while fading out
  fadeMins: 1,
}

// Default configuration for Holland Tunnel
export const HOLLAND_TUNNEL_CONFIG: TunnelsConfig = {
  eb: {
    direction: 'east',
    offsetMin: 45,  // Bike pen opens at :45
    y: 200,  // Eastbound tunnel is at bottom
    pen: {
      x: -LAYOUT.QUEUE_AREA_WIDTH + 70,  // Relative to tunnel start
      y: 110,  // Below the lanes
      w: LAYOUT.BIKE_PEN_WIDTH,
      h: LAYOUT.BIKE_PEN_HEIGHT,
    },
    ...Common,
  },

  wb: {
    direction: 'west',
    offsetMin: 15,  // Bike pen opens at :15
    y: 100,  // Westbound tunnel is at top
    pen: {
      x: LAYOUT.TUNNEL_WIDTH + 70,  // Relative to tunnel start
      y: -80,  // Above the lanes
      w: LAYOUT.BIKE_PEN_WIDTH,
      h: LAYOUT.BIKE_PEN_HEIGHT,
    },
    ...Common,
  },

  sweep: {
    mph: 12,
    stagingOffset: 35
  },

  pace: {
    mph: Common.carMph,
    stagingOffset: 60
  }
}
