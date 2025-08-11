import { LAYOUT, COMPUTED_LAYOUT } from './Constants'
import type { TunnelsConfig } from './Tunnels'

export const Common = {
  period: 60,             // Cycle repeats every 60mins
  lengthMi: 2,            // Total tunnel length
  carMph: 24,             // Car speed through tunnels
  carExitingMph: 24,      // Speed while exiting/fading (same as carMph)
  bikeDownMph: 15,        // Bike downhill speed
  bikeUpMph: 8,           // Bike uphill speed
  bikeExitingMph: 12,     // Speed while exiting/fading (on flat ground)
  penCloseMin: 3,         // "Bike pen" stays open for this many minutes, beginning from ":00" (tunnel's "origin" time)
  sweepStartMin: 5,       // "Sweep" van embarks at this minute mark (tunnel-relative)
  paceStartMin: 10,       // "Pace" car embarks at this minute mark (tunnel-relative)
  carsPerMin: 1,          // 60 cars per hour
  carsReleasedPerMin: 5,  // How many queued cars can enter tunnel per minute (behind pace car)
  bikesPerMin: 0.25,      // Bike "spawn" rate (1 per 4mins, 15 bikes per hour)
  bikesReleasedPerMin: 5, // How many queued bikes can enter tunnel per minute (when pen opens)
  officialResetMins: 5,   // How long sweep and pace cars take to move from one tunnel's exit to their "staging" locations for the other tunnel

  // Layout (eastbound-specific coordinates)
  laneWidthPx: LAYOUT.TUNNEL_WIDTH,
  laneHeightPx: LAYOUT.LANE_HEIGHT,
  queuedCarWidthPx: 30,   // Queued car spacing
}

// Function to generate config with current layout values
export const getHollandTunnelConfig = (): TunnelsConfig => ({
  eb: {
    direction: 'east',
    offsetMin: 45,  // Bike pen opens at :45
    y: 200,  // Eastbound tunnel is at bottom
    pen: {
      x: LAYOUT.BIKE_PEN_INSET,  // Left-aligned with tunnel entrance
      y: 70,  // Below the lanes, closer to tunnel
      w: COMPUTED_LAYOUT.getBikePenWidth(4),  // Width for 4 columns
      h: COMPUTED_LAYOUT.getBikePenHeight(4),  // Height for 4 rows
      rows: 4,  // 4 rows for E/b pen
      cols: 4,  // 4 columns for E/b pen
    },
    ...Common,
  },

  wb: {
    direction: 'west',
    offsetMin: 15,  // Bike pen opens at :15
    y: 100,  // Westbound tunnel is at top
    pen: {
      x: LAYOUT.TUNNEL_WIDTH - COMPUTED_LAYOUT.getBikePenWidth(8) - LAYOUT.BIKE_PEN_INSET,  // Right-aligned with tunnel exit
      y: -65,  // Above the lanes (adjusted for 2-row height)
      w: COMPUTED_LAYOUT.getBikePenWidth(8),  // Width for 8 columns
      h: COMPUTED_LAYOUT.getBikePenHeight(2),  // Height for 2 rows
      rows: 2,  // 2 rows for W/b pen (more horizontal)
      cols: 8,  // 8 columns for W/b pen
    },
    ...Common,
  },

  sweep: {
    mph: 12,
    stagingOffset: LAYOUT.SWEEP_STAGING_OFFSET
  },

  pace: {
    mph: Common.carMph,
    stagingOffset: LAYOUT.PACE_STAGING_OFFSET
  }
})

// Default configuration for Holland Tunnel (for backwards compatibility)
export const HOLLAND_TUNNEL_CONFIG: TunnelsConfig = getHollandTunnelConfig()
