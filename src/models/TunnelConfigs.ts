import type { TunnelsConfig } from './Tunnels'
import { LAYOUT, SPEEDS } from './Vehicle'

// Default configuration for Holland Tunnel
export const HOLLAND_TUNNEL_CONFIG: TunnelsConfig = {
  eastbound: {
    direction: 'east',
    offsetMinute: 45,  // Pen opens at :45
    lengthMiles: 2,
    carSpeed: 24,      // mph
    bikeUphillSpeed: SPEEDS.BIKE_UPHILL,
    bikeDownhillSpeed: SPEEDS.BIKE_DOWNHILL,
    penOpenMinutes: 3, // :45-:47
    bikesPerMinute: 0.25, // 15 bikes per hour
    carsPerMinute: 1,  // 60 cars per hour
    
    // Layout (eastbound-specific coordinates)
    lanePixelWidth: LAYOUT.TUNNEL_WIDTH,
    lanePixelHeight: LAYOUT.LANE_HEIGHT,
    penRelativeX: -LAYOUT.QUEUE_AREA_WIDTH + 70,  // Relative to tunnel start
    penRelativeY: 110,  // Below the lanes
    penPixelWidth: LAYOUT.BIKE_PEN_WIDTH,
    penPixelHeight: LAYOUT.BIKE_PEN_HEIGHT
  },
  
  westbound: {
    direction: 'west',
    offsetMinute: 15,  // Pen opens at :15
    lengthMiles: 2,
    carSpeed: 24,      // mph
    bikeUphillSpeed: SPEEDS.BIKE_UPHILL,
    bikeDownhillSpeed: SPEEDS.BIKE_DOWNHILL,
    penOpenMinutes: 3, // :15-:17
    bikesPerMinute: 0.25, // 15 bikes per hour
    carsPerMinute: 1,  // 60 cars per hour
    
    // Layout (westbound-specific coordinates)
    lanePixelWidth: LAYOUT.TUNNEL_WIDTH,
    lanePixelHeight: LAYOUT.LANE_HEIGHT,
    penRelativeX: LAYOUT.TUNNEL_WIDTH + 70,  // Relative to tunnel start
    penRelativeY: -80,  // Above the lanes
    penPixelWidth: LAYOUT.BIKE_PEN_WIDTH,
    penPixelHeight: LAYOUT.BIKE_PEN_HEIGHT
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