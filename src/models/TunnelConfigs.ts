import { LAYOUT, SPEEDS } from './Vehicle'
import type { TunnelsConfig } from './Tunnels'

export const Common = {
  lengthMiles: 2,
  carSpeed: 24,      // mph
  bikeUphillSpeed: SPEEDS.BIKE_UPHILL,
  bikeDownhillSpeed: SPEEDS.BIKE_DOWNHILL,
  penOpenMinutes: 3, // :45-:47
  bikesPerMinute: 0.25, // 15 bikes per hour
  carsPerMinute: 1,  // 60 cars per hour
  bikesReleasedPerMin: 5,

  // Layout (eastbound-specific coordinates)
  laneWidthPx: LAYOUT.TUNNEL_WIDTH,
  laneHeightPx: LAYOUT.LANE_HEIGHT,
  penWidthPx: LAYOUT.BIKE_PEN_WIDTH,
  penHeightPx: LAYOUT.BIKE_PEN_HEIGHT,

  // Exit behavior
  exitFadeDistance: 100  // Pixels to travel while fading out
}

// Default configuration for Holland Tunnel
export const HOLLAND_TUNNEL_CONFIG: TunnelsConfig = {
  eastbound: {
    direction: 'east',
    offsetMinute: 45,
    paceCarStartTime: 55,
    penRelativeX: -LAYOUT.QUEUE_AREA_WIDTH + 70,  // Relative to tunnel start
    penRelativeY: 110,  // Below the lanes
    ...Common,
  },
  
  westbound: {
    direction: 'west',
    offsetMinute: 15,  // Pen opens at :15
    paceCarStartTime: 25,
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
