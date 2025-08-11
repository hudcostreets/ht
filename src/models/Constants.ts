// Get responsive tunnel width based on container width
function getResponsiveTunnelWidth(): number {
  if (typeof window === 'undefined') return 730 // SSR fallback (850 - 120 padding)
  const vw = window.innerWidth
  // Container max-width is 850px with padding
  // Tunnels should span the full container width minus padding
  const containerWidth = Math.min(vw - 40, 850) // Account for body padding
  if (vw <= 500) {
    return containerWidth - 60 // Subtract phone padding (2x30)
  }
  if (vw < 768) {
    return containerWidth - 80 // Subtract tablet padding (2x40)
  }
  return Math.min(containerWidth - 120, 730) // Subtract desktop padding (2x60), max 730
}

// Get responsive fade distance based on viewport
function getResponsiveFadeDistance(): number {
  if (typeof window === 'undefined') return 100 // SSR fallback
  const vw = window.innerWidth
  if (vw <= 500) return 50  // Narrow screens: more fade to keep vehicles visible
  if (vw < 768) return 60   // Small screens
  return 100                 // Desktop: full fade
}

// Layout constants
export const LAYOUT = {
  get TUNNEL_WIDTH() {
    return getResponsiveTunnelWidth()
  },
  get QUEUE_AREA_WIDTH() {
    // Responsive queue area - narrower on mobile to shift lanes left
    if (typeof window === 'undefined') return 100
    const vw = window.innerWidth
    if (vw <= 500) return 50   // Minimal on narrow screens
    if (vw < 768) return 70    // Small screens
    return 100                  // Desktop
  },
  LANE_HEIGHT: 30,
  TUNNEL_LENGTH_MILES: 2,

  // Bike arrangement in pen
  BIKES_PER_ROW: 5,
  BIKE_WIDTH: 20,
  BIKE_SPACING_X: 20,
  BIKE_SPACING_Y: 15,
  BIKE_PEN_MARGIN: 10,

  // Vehicle staging offsets - responsive
  get SWEEP_STAGING_OFFSET() {
    // Sweep stages closer on narrow screens to stay visible
    if (typeof window === 'undefined') return 35
    const vw = window.innerWidth
    if (vw <= 500) return 20   // Closer on narrow screens but with some clearance
    if (vw < 768) return 25    // Medium distance on small screens
    return 35                   // Farther on desktop for better separation
  },
  get PACE_STAGING_OFFSET() {
    // Pace stages at same X as Sweep, but vertically offset
    return this.SWEEP_STAGING_OFFSET
  },
  STAGING_VERTICAL_OFFSET: 30,

  // Bike pen positioning
  BIKE_PEN_INSET: 0, // How far inside the tunnel entrance to place the pen

  // Fade animation - responsive
  get FADE_DISTANCE_PX() {
    return getResponsiveFadeDistance()
  },
}

// Computed layout values
export const COMPUTED_LAYOUT = {
  // Maximum bikes that queue
  // With 15 bikes evenly distributed over 60 mins: spawn at 0, 4, 8, 12...
  // Pen closes at minute 3, so only bike at minute 0 enters without queueing
  // All other 14 bikes must queue
  MAX_QUEUED_BIKES: 14,

  // Bike pen dimensions based on max queued bikes (legacy, for backwards compatibility)
  get BIKE_PEN_WIDTH() {
    // Grid width: (bikes-1) * spacing + bike width
    const gridWidth = (LAYOUT.BIKES_PER_ROW - 1) * LAYOUT.BIKE_SPACING_X + LAYOUT.BIKE_WIDTH
    return gridWidth + 2 * LAYOUT.BIKE_PEN_MARGIN
  },
  get BIKE_PEN_HEIGHT() {
    const rows = Math.ceil(this.MAX_QUEUED_BIKES / LAYOUT.BIKES_PER_ROW)
    // Grid height: (rows-1) * spacing + bike height (assume square bikes)
    const gridHeight = (rows - 1) * LAYOUT.BIKE_SPACING_Y + LAYOUT.BIKE_WIDTH
    return gridHeight + 2 * LAYOUT.BIKE_PEN_MARGIN
  },

  // Helper functions for custom pen dimensions
  getBikePenWidth(cols: number) {
    const gridWidth = (cols - 1) * LAYOUT.BIKE_SPACING_X + LAYOUT.BIKE_WIDTH
    return gridWidth + 2 * LAYOUT.BIKE_PEN_MARGIN
  },
  getBikePenHeight(rows: number) {
    const gridHeight = (rows - 1) * LAYOUT.BIKE_SPACING_Y + LAYOUT.BIKE_WIDTH
    return gridHeight + 2 * LAYOUT.BIKE_PEN_MARGIN
  },

  // SVG dimensions - responsive to use available space
  get SVG_WIDTH() {
    // Tighter layout: just tunnel width + fade distances on both sides
    // Queue area is already included in QUEUE_AREA_WIDTH (left side)
    // Right side uses responsive fade distance
    return LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH + LAYOUT.FADE_DISTANCE_PX
  }
}
