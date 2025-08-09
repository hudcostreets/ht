// Layout constants
export const LAYOUT = {
  TUNNEL_WIDTH: 800,
  QUEUE_AREA_WIDTH: 150,
  LANE_HEIGHT: 30,
  TUNNEL_LENGTH_MILES: 2,

  // Bike arrangement in pen
  BIKES_PER_ROW: 5,
  BIKE_WIDTH: 20,
  BIKE_SPACING_X: 20,
  BIKE_SPACING_Y: 15,
  BIKE_PEN_MARGIN: 10,

  // Vehicle staging offsets
  SWEEP_STAGING_OFFSET: 35,
  PACE_STAGING_OFFSET: 60,
  STAGING_VERTICAL_OFFSET: 30,

  // Bike pen positioning
  BIKE_PEN_INSET: 0, // How far inside the tunnel entrance to place the pen

  // Fade animation
  FADE_DISTANCE_PX: 100, // Pixels to travel while fading in/out
}

// Computed layout values
export const COMPUTED_LAYOUT = {
  // Maximum bikes that queue
  // With 15 bikes evenly distributed over 60 mins: spawn at 0, 4, 8, 12...
  // Pen closes at minute 3, so only bike at minute 0 enters without queueing
  // All other 14 bikes must queue
  MAX_QUEUED_BIKES: 14,

  // Bike pen dimensions based on max queued bikes
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

  // SVG dimensions
  get SVG_WIDTH() {
    // Need space for: queue area + tunnel + pace staging + fade distance buffer
    // Pens are now inside the tunnel bounds, so don't need extra width for them
    // Add fade distance on both ends (vehicles fade in from left, fade out to right)
    return LAYOUT.QUEUE_AREA_WIDTH + LAYOUT.TUNNEL_WIDTH + LAYOUT.PACE_STAGING_OFFSET + LAYOUT.FADE_DISTANCE_PX
  }
}
