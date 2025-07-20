// Vehicle position and state
export interface VehiclePosition {
  x: number;
  y: number;
  state: 'approaching' | 'queued' | 'tunnel' | 'exiting' | 'staging' | 'pen';
  opacity: number;
}

// Base vehicle interface
export interface VehicleData {
  id: string;
  type: 'car' | 'bike' | 'sweep' | 'pace';
  spawnMinute: number;
  lane: number;
  direction: 'east' | 'west';
}

// Speed constants in pixels per second
export const SPEEDS = {
  CAR: 0, // Will be calculated
  BIKE_DOWNHILL: 0,
  BIKE_UPHILL: 0,
  SWEEP: 0,
  PACE: 0
}

// Layout constants
export const LAYOUT = {
  TUNNEL_WIDTH: 800,
  QUEUE_AREA_WIDTH: 150,
  LANE_HEIGHT: 30,
  BIKE_PEN_WIDTH: 120,
  BIKE_PEN_HEIGHT: 80,
  TUNNEL_LENGTH_MILES: 2
}

// Convert MPH to pixels per second
function mphToPixelsPerSecond(mph: number): number {
  const pixelsPerMile = LAYOUT.TUNNEL_WIDTH / LAYOUT.TUNNEL_LENGTH_MILES
  const pixelsPerHour = mph * pixelsPerMile
  const pixelsPerMinute = pixelsPerHour / 60
  const pixelsPerSecond = pixelsPerMinute / 60
  return pixelsPerSecond
}

// Initialize speeds
SPEEDS.CAR = mphToPixelsPerSecond(24)
SPEEDS.BIKE_DOWNHILL = mphToPixelsPerSecond(15)
SPEEDS.BIKE_UPHILL = mphToPixelsPerSecond(8)
SPEEDS.SWEEP = mphToPixelsPerSecond(12)
SPEEDS.PACE = SPEEDS.CAR

// Get phase for a given minute
export function getPhase(minute: number, direction: 'east' | 'west'): string {
  const offset = direction === 'west' ? 30 : 0
  const adjustedMinute = (minute + offset) % 60
  
  if (adjustedMinute < 45) return 'normal'
  if (adjustedMinute < 48) return 'bikes-enter'
  if (adjustedMinute < 50) return 'clearing'
  if (adjustedMinute < 55) return 'sweep'
  return 'pace-car'
}

// Get Y position for a lane
export function getLaneY(direction: 'east' | 'west', lane: number): number {
  if (direction === 'west') {
    const baseY = 100
    // Lane 1 (R) is top, Lane 2 (L) is bottom (relative to westbound travel direction)
    return baseY + (lane - 1) * LAYOUT.LANE_HEIGHT + LAYOUT.LANE_HEIGHT / 2
  } else {
    const baseY = 200
    // Lane 1 (L) is top, Lane 2 (R) is bottom (relative to eastbound travel direction)
    return baseY + (lane - 1) * LAYOUT.LANE_HEIGHT + LAYOUT.LANE_HEIGHT / 2
  }
}

// Abstract base class for vehicles
export abstract class Vehicle {
  data: VehicleData
  
  constructor(data: VehicleData) {
    this.data = data
  }
  
  abstract getPosition(time: number): VehiclePosition | null;
  
  protected getTunnelEntrance(): number {
    return this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH : 
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
  }
}

// Car class
export class Car extends Vehicle {
  private readonly fadeZone = 100
  
  getPosition(time: number): VehiclePosition | null {
    const currentHour = Math.floor(time / 3600)
    const spawnTime = (currentHour * 3600) + (this.data.spawnMinute * 60)
    
    // Check if we're within 1 minute of spawn time
    if (time < spawnTime - 60) return null
    
    // If we're before spawn time but within fade-in period, car is fading in
    if (time < spawnTime && time >= spawnTime - 60) {
      const timeUntilSpawn = spawnTime - time
      const fadeProgress = 1 - (timeUntilSpawn / 60)
      
      // Calculate staging position (1 minute of travel distance before tunnel entrance)
      const oneMinuteDistance = SPEEDS.CAR * 60
      const stagingX = this.data.direction === 'east' ?
        this.getTunnelEntrance() - oneMinuteDistance :
        this.getTunnelEntrance() + oneMinuteDistance
      
      // Interpolate from staging position to tunnel entrance
      const currentX = stagingX + (this.getTunnelEntrance() - stagingX) * fadeProgress
      
      return {
        x: currentX,
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'approaching',
        opacity: fadeProgress
      }
    }
    
    // Check if lane is blocked
    const phase = getPhase(this.data.spawnMinute, this.data.direction)
    // R lane is blocked during bike phases: lane 2 for eastbound, lane 1 for westbound
    const rLane = this.data.direction === 'east' ? 2 : 1
    const isRLaneBlocked = this.data.lane === rLane && phase !== 'normal'
    
    let enterTime = spawnTime
    
    if (isRLaneBlocked) {
      // Calculate when car can enter
      const nextNormalMinute = this.getNextNormalMinute()
      const nextNormalTime = (currentHour * 3600) + (nextNormalMinute * 60)
      
      if (nextNormalMinute === 60) {
        enterTime = ((currentHour + 1) * 3600)
      } else {
        enterTime = nextNormalTime
      }
      
      // If still waiting to enter, show in queue
      if (time < enterTime) {
        return this.getQueuePosition()
      }
    }
    
    // Moving through tunnel
    const travelTime = time - enterTime
    const tunnelTransitTime = (LAYOUT.TUNNEL_LENGTH_MILES / 24) * 3600 // 5 minutes at 24mph
    const totalTransitTime = tunnelTransitTime + 120 // Add 2 minutes for fade zones
    
    // Handle previous hour cars
    if (travelTime < 0) {
      const prevHourTravelTime = travelTime + 3600
      if (prevHourTravelTime > totalTransitTime) return null
      return this.calculateMovingPosition(prevHourTravelTime)
    }
    
    // Car has exited
    if (travelTime > totalTransitTime) return null
    
    return this.calculateMovingPosition(travelTime)
  }
  
  private getNextNormalMinute(): number {
    const minute = this.data.spawnMinute
    
    if (this.data.direction === 'east') {
      if (minute === 45) return 56
      if (minute < 45 || minute >= 56) return minute
      return 60 // :46-:55 don't exist
    } else {
      if (minute === 15) return 26
      if (minute >= 30 || minute < 15) return minute
      return 30
    }
  }
  
  private getQueuePosition(): VehiclePosition {
    // Calculate unique queue position based on spawn minute
    const queueIndex = this.data.spawnMinute % 15
    const queueSpacing = 40
    const baseOffset = 50
    
    const x = this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing)
    
    return {
      x,
      y: getLaneY(this.data.direction, this.data.lane),
      state: 'queued',
      opacity: 1
    }
  }
  
  private calculateMovingPosition(travelTime: number): VehiclePosition | null {
    const distance = SPEEDS.CAR * travelTime
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) {
      return null
    }
    
    // Calculate opacity for fade out at exits
    let opacity = 1
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone - x) / this.fadeZone)
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) / this.fadeZone)
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'approaching' : 'tunnel'
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity }
  }
}

// Bike class
export class Bike extends Vehicle {
  private readonly fadeZone = 50
  
  getPosition(time: number): VehiclePosition | null {
    const currentHour = Math.floor(time / 3600)
    const spawnTime = (currentHour * 3600) + (this.data.spawnMinute * 60)
    const minuteInHour = Math.floor(time / 60) % 60
    
    // Bike hasn't spawned yet
    if (time < spawnTime) return null
    
    // Determine bike pen window and release time
    const penOpenMinute = this.data.direction === 'east' ? 45 : 15
    const penCloseMinute = this.data.direction === 'east' ? 48 : 18
    const releaseMinute = this.data.direction === 'east' ? 45 : 15
    const releaseTime = (currentHour * 3600) + (releaseMinute * 60)
    
    // Check if this bike arrives during the pen window (can join traveling group)
    const arrivesDuringPenWindow = this.data.spawnMinute >= penOpenMinute && this.data.spawnMinute < penCloseMinute
    
    // Bikes that arrive DURING pen window can join the traveling group directly
    if (arrivesDuringPenWindow) {
      // Calculate when they join the traveling group (immediately at spawn time)
      const joinTime = spawnTime
      
      if (time < joinTime) {
        return null // Haven't spawned yet
      }
      
      // Calculate position in the traveling group
      const travelTime = time - joinTime
      const groupStartTime = releaseTime
      const groupTravelTime = time - groupStartTime
      
      // Calculate how far the group has traveled from tunnel entrance
      let groupDistance = 0
      if (groupTravelTime > 0) {
        const halfwayTime = (LAYOUT.TUNNEL_WIDTH / 2) / SPEEDS.BIKE_DOWNHILL
        if (groupTravelTime <= halfwayTime) {
          groupDistance = SPEEDS.BIKE_DOWNHILL * groupTravelTime
        } else {
          groupDistance = (LAYOUT.TUNNEL_WIDTH / 2) + SPEEDS.BIKE_UPHILL * (groupTravelTime - halfwayTime)
        }
      }
      
      // This bike joins at the back of the group
      const joinOffset = 20 // meters behind the group
      const bikeDistance = Math.max(0, groupDistance - joinOffset)
      
      const x = this.data.direction === 'east' ? 
        this.getTunnelEntrance() + bikeDistance : 
        this.getTunnelEntrance() - bikeDistance
      
      return this.calculateBikePositionWithFade(x)
    }
    
    // Bikes that arrive OUTSIDE pen window go to pen to wait
    if (this.data.spawnMinute >= penCloseMinute) {
      // Late arrivals go to pen and wait for their turn to be released
      
      // They must spawn first
      if (time < spawnTime) {
        return null
      }
      
      // Late arrivals wait for the NEXT cycle (30 minutes later)
      const nextCycleReleaseTime = releaseTime + (30 * 60) // 30 minutes later
      const lateArrivalOrder = this.data.spawnMinute - penCloseMinute
      const releaseDelay = lateArrivalOrder * 12
      const actualReleaseTime = nextCycleReleaseTime + releaseDelay
      
      // Stay in pen until their release time
      if (time < actualReleaseTime) {
        return this.getPenPosition()
      }
      
      // Moving through tunnel
      const travelTime = time - actualReleaseTime
      return this.calculateMovingPosition(travelTime)
    }
    
    // Early bikes (arrive before pen opens) - only bikes before pen opens
    if (this.data.spawnMinute >= penOpenMinute) return null
    
    // These are the original traveling bikes, released sequentially starting at :45/:15
    if (time < releaseTime) {
      return this.getPenPosition()
    }
    
    // First bike stages at tunnel entrance
    const isFirstBike = this.data.spawnMinute === 0
    if (isFirstBike && time >= releaseTime && time < releaseTime + 12) {
      return {
        x: this.getTunnelEntrance(),
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'tunnel',
        opacity: 1
      }
    }
    
    // Calculate release timing for early bikes (need to convert back to index for release order)
    const releaseOrder = this.data.spawnMinute / 4
    const releaseDelay = releaseOrder * 12 // 5 per minute = 12 seconds apart
    const actualReleaseTime = releaseTime + releaseDelay
    
    if (time < actualReleaseTime) {
      return this.getPenPosition()
    }
    
    // Moving through tunnel
    const travelTime = time - actualReleaseTime
    return this.calculateMovingPosition(travelTime)
  }
  
  private getPenPosition(): VehiclePosition {
    // Calculate position index for pen arrangement
    const penOpenMinute = this.data.direction === 'east' ? 45 : 15
    const penCloseMinute = this.data.direction === 'east' ? 48 : 18
    let positionIndex: number
    
    if (this.data.spawnMinute >= penCloseMinute) {
      // Late arrivals (after pen window) - arrange after the traveling group
      positionIndex = 15 + (this.data.spawnMinute - penCloseMinute)
    } else {
      // Early bikes (traveling group) - arrange by their order (convert back to index)
      positionIndex = this.data.spawnMinute / 4
    }
    
    // Arrange bikes in a 3x5 grid
    const row = Math.floor(positionIndex / 3)
    const col = positionIndex % 3
    
    const penX = this.data.direction === 'east' ? 70 : LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 70
    const penY = this.data.direction === 'east' ? 310 : 60
    
    return {
      x: penX + (col * 20) - 20,
      y: penY + (row * 15) - 30,
      state: 'pen',
      opacity: 1
    }
  }
  
  private calculateBikePositionWithFade(x: number): VehiclePosition | null {
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) {
      return null
    }
    
    // Calculate opacity for fade out at exit
    let opacity = 1
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone - x) / this.fadeZone)
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) / this.fadeZone)
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'exiting' : 'tunnel'
    
    return { 
      x, 
      y: getLaneY(this.data.direction, this.data.lane), 
      state, 
      opacity 
    }
  }
  
  private calculateMovingPosition(travelTime: number): VehiclePosition | null {
    // Calculate position with variable speed
    let distance = 0
    const halfwayTime = (LAYOUT.TUNNEL_WIDTH / 2) / SPEEDS.BIKE_DOWNHILL
    
    if (travelTime <= halfwayTime) {
      distance = SPEEDS.BIKE_DOWNHILL * travelTime
    } else {
      distance = (LAYOUT.TUNNEL_WIDTH / 2) + SPEEDS.BIKE_UPHILL * (travelTime - halfwayTime)
    }
    
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) {
      return null
    }
    
    // Calculate opacity for fade out at exit
    let opacity = 1
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone - x) / this.fadeZone)
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) / this.fadeZone)
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'approaching' : 'tunnel'
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity }
  }
}
