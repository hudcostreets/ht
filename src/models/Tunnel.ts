export interface TunnelConfig {
  direction: 'east' | 'west'
  offsetMinute: number  // When pen opens (:45 for E, :15 for W)
  lengthMiles: number   // 2 miles
  carSpeed: number      // mph
  bikeUphillSpeed: number
  bikeDownhillSpeed: number
  penOpenMinutes: number // 3 minutes
  bikesPerMinute: number // 0.25
  carsPerMinute: number  // 1
  
  // Layout
  lanePixelWidth: number
  lanePixelHeight: number
  penRelativeX: number   // Relative to R lane start
  penRelativeY: number   // Relative to R lane start
  penPixelWidth: number
  penPixelHeight: number
}

export interface TimePosition {
  time: number
  x: number
  y: number
  state: 'pen' | 'staging' | 'tunnel' | 'exiting' | 'queued'
  opacity: number
}

export class Tunnel {
  private config: TunnelConfig
  private bikes: TunnelBike[] = []
  private cars: TunnelCar[] = []
  
  constructor(config: TunnelConfig) {
    this.config = config
    this.initializeVehicles()
  }
  
  private initializeVehicles() {
    // Create bikes (spawn every 4 minutes)
    for (let i = 0; i < 15; i++) {
      const spawnMinute = i * 4
      this.bikes.push(new TunnelBike(this, i, spawnMinute))
    }
    
    // Create cars (spawn every minute)
    for (let minute = 0; minute < 60; minute++) {
      // L lane cars (always flow)
      this.cars.push(new TunnelCar(this, minute, minute, 'L'))
      
      // R lane cars (may queue during bike phases)
      this.cars.push(new TunnelCar(this, minute, minute, 'R'))
    }
  }
  
  // Convert absolute time to tunnel-relative time
  getRelativeTime(absoluteTime: number): number {
    const hourInSeconds = Math.floor(absoluteTime / 3600) * 3600
    const relativeTime = absoluteTime - hourInSeconds
    
    // Shift time so that our offset minute becomes "minute 0"
    const shiftedTime = relativeTime - (this.config.offsetMinute * 60)
    
    // Handle negative wrap-around (e.g. if we're at :10 and offset is :15)
    if (shiftedTime < 0) {
      return shiftedTime + 3600 // Add an hour
    }
    
    return shiftedTime
  }
  
  // Convert tunnel-relative time back to absolute
  getAbsoluteTime(relativeTime: number, hourBase: number): number {
    const hourInSeconds = Math.floor(hourBase / 3600) * 3600
    const absoluteTime = hourInSeconds + relativeTime + (this.config.offsetMinute * 60)
    
    // Handle overflow
    if (absoluteTime >= hourInSeconds + 3600) {
      return absoluteTime - 3600
    }
    
    return absoluteTime
  }
  
  // Get phase at relative time (0 = pen opens)
  getPhase(relativeTime: number): 'normal' | 'bikes-enter' | 'clearing' | 'sweep' | 'pace-car' {
    const minute = Math.floor(relativeTime / 60)
    
    if (minute >= 0 && minute < this.config.penOpenMinutes) {
      return 'bikes-enter'
    } else if (minute >= this.config.penOpenMinutes && minute < 5) {
      return 'clearing'
    } else if (minute >= 5 && minute < 10) {
      return 'sweep'
    } else if (minute >= 10 && minute < 15) {
      return 'pace-car'
    } else {
      return 'normal'
    }
  }
  
  getBikes(): TunnelBike[] {
    return this.bikes
  }
  
  getCars(): TunnelCar[] {
    return this.cars
  }
  
  getConfig(): TunnelConfig {
    return this.config
  }
}

export class TunnelBike {
  private tunnel: Tunnel
  private index: number
  private spawnMinute: number
  private timePositions: TimePosition[] = []
  
  constructor(tunnel: Tunnel, index: number, spawnMinute: number) {
    this.tunnel = tunnel
    this.index = index
    this.spawnMinute = spawnMinute
    this.calculateTimePositions()
  }
  
  private calculateTimePositions() {
    // Calculate the full trajectory for this bike
    const config = this.tunnel.getConfig()
    
    // Determine when this bike should be released from pen
    let releaseRelativeTime: number
    
    if (this.spawnMinute < config.offsetMinute) {
      // Early bike - released at pen opening (relative time 0)
      releaseRelativeTime = this.index * 12 // 5 bikes per minute = 12 seconds apart
    } else if (this.spawnMinute >= config.offsetMinute && this.spawnMinute < config.offsetMinute + config.penOpenMinutes) {
      // Bike arrives during pen window - can join traveling group immediately
      const spawnRelativeTime = (this.spawnMinute - config.offsetMinute) * 60
      releaseRelativeTime = spawnRelativeTime
    } else {
      // Late arrival - waits for next cycle (60 minutes later)
      const nextCycleStart = 60 * 60 // Next hour
      const lateArrivalOrder = Math.floor((this.spawnMinute - (config.offsetMinute + config.penOpenMinutes)) / 4)
      releaseRelativeTime = nextCycleStart + (lateArrivalOrder * 12)
    }
    
    // Calculate tunnel transit time
    const tunnelWidthPixels = config.lanePixelWidth
    const tunnelLengthMiles = config.lengthMiles
    const pixelsPerMile = tunnelWidthPixels / tunnelLengthMiles
    
    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfwayPoint = tunnelWidthPixels / 2
    const downhillTime = (halfwayPoint / pixelsPerMile) / config.bikeDownhillSpeed * 3600 // Convert to seconds
    const uphillTime = (halfwayPoint / pixelsPerMile) / config.bikeUphillSpeed * 3600
    const totalTransitTime = downhillTime + uphillTime
    
    this.timePositions = [
      // In pen before release
      {
        time: releaseRelativeTime - 1,
        x: config.penRelativeX + (this.index % 5) * 20,
        y: config.penRelativeY + Math.floor(this.index / 5) * 15,
        state: 'pen',
        opacity: 1
      },
      // Start of tunnel
      {
        time: releaseRelativeTime,
        x: config.direction === 'east' ? 0 : tunnelWidthPixels, // Tunnel entrance
        y: config.lanePixelHeight / 2, // R lane center
        state: 'tunnel',
        opacity: 1
      },
      // End of tunnel
      {
        time: releaseRelativeTime + totalTransitTime,
        x: config.direction === 'east' ? tunnelWidthPixels : 0,
        y: config.lanePixelHeight / 2,
        state: 'exiting',
        opacity: 1
      },
      // Fully exited
      {
        time: releaseRelativeTime + totalTransitTime + 60, // 1 minute fade
        x: config.direction === 'east' ? tunnelWidthPixels + 100 : -100,
        y: config.lanePixelHeight / 2,
        state: 'exiting',
        opacity: 0
      }
    ]
  }
  
  getPosition(absoluteTime: number): { x: number, y: number, state: string, opacity: number } | null {
    const relativeTime = this.tunnel.getRelativeTime(absoluteTime)
    
    if (this.timePositions.length === 0) return null
    
    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relativeTime < first.time) {
      // For early bikes that haven't been released yet, check if they should be visible
      if (this.spawnMinute < this.tunnel.getConfig().offsetMinute && relativeTime >= 0) {
        // Early bike waiting in pen during pen open time
        return { ...first }
      }
      // Otherwise not visible yet
      return null
    }
    
    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]
      
      if (relativeTime >= current.time && relativeTime < next.time) {
        // Interpolate between current and next
        const t = (relativeTime - current.time) / (next.time - current.time)
        
        return {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
          state: current.state,
          opacity: current.opacity + (next.opacity - current.opacity) * t
        }
      }
    }
    
    // Check if we're past the last time position
    const last = this.timePositions[this.timePositions.length - 1]
    if (relativeTime >= last.time) {
      if (last.opacity <= 0) return null // Fully faded out
      return { ...last }
    }
    
    return null
  }
  
  getIndex(): number {
    return this.index
  }
  
  getSpawnMinute(): number {
    return this.spawnMinute
  }
}

export class TunnelCar {
  private tunnel: Tunnel
  private id: number
  private spawnMinute: number
  private lane: 'L' | 'R'
  private timePositions: TimePosition[] = []
  
  constructor(tunnel: Tunnel, id: number, spawnMinute: number, lane: 'L' | 'R') {
    this.tunnel = tunnel
    this.id = id
    this.spawnMinute = spawnMinute
    this.lane = lane
    this.calculateTimePositions()
  }
  
  private calculateTimePositions() {
    // Calculate the full trajectory for this car
    const config = this.tunnel.getConfig()
    
    // Calculate spawn relative time (handle negative values)
    let spawnRelativeMinute = this.spawnMinute - config.offsetMinute
    if (spawnRelativeMinute < 0) {
      spawnRelativeMinute += 60 // Wrap around hour
    }
    const spawnRelativeTime = spawnRelativeMinute * 60
    
    // Get phase at spawn time
    const phase = this.tunnel.getPhase(spawnRelativeTime)
    
    // Determine if this car needs to queue
    const needsToQueue = this.lane === 'R' && phase !== 'normal' && phase !== 'pace-car'
    
    let releaseRelativeTime: number
    let startX: number
    
    if (needsToQueue) {
      // Car queues during bike phases
      const queuePosition = Math.floor(spawnRelativeMinute)
      const paceCarStartTime = 10 * 60 // Pace car phase starts at relative minute 10
      
      releaseRelativeTime = Math.max(spawnRelativeTime, paceCarStartTime)
      startX = config.direction === 'east' ? 
        -50 - (queuePosition * 30) : // Eastbound queue on left
        config.lanePixelWidth + 50 + (queuePosition * 30) // Westbound queue on right
    } else {
      // Car flows normally
      releaseRelativeTime = spawnRelativeTime
      startX = config.direction === 'east' ? 0 : config.lanePixelWidth // Tunnel entrance
    }
    
    // Calculate tunnel transit time
    const tunnelWidthPixels = config.lanePixelWidth
    const tunnelLengthMiles = config.lengthMiles
    const speedMph = config.carSpeed
    const transitTimeSeconds = (tunnelLengthMiles / speedMph) * 3600
    
    // Lane Y position (L lane on bottom, R lane on top for eastbound)
    const laneY = this.lane === 'L' ? 
      config.lanePixelHeight + config.lanePixelHeight / 2 : 
      config.lanePixelHeight / 2
    
    if (needsToQueue) {
      // Car queues, then moves through tunnel
      this.timePositions = [
        // Queued position (from spawn until just before pace car)
        {
          time: spawnRelativeTime,
          x: startX,
          y: laneY,
          state: 'queued',
          opacity: 1
        },
        // At pace car time, jump to tunnel entrance
        {
          time: releaseRelativeTime,
          x: config.direction === 'east' ? 0 : tunnelWidthPixels,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelativeTime + transitTimeSeconds,
          x: config.direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelativeTime + transitTimeSeconds + 60,
          x: config.direction === 'east' ? tunnelWidthPixels + 100 : -100,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    } else {
      // Car flows normally
      this.timePositions = [
        // Start position
        {
          time: releaseRelativeTime,
          x: startX,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelativeTime + transitTimeSeconds,
          x: config.direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelativeTime + transitTimeSeconds + 60, // 1 minute fade
          x: config.direction === 'east' ? tunnelWidthPixels + 100 : -100,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    }
  }
  
  getPosition(absoluteTime: number): { x: number, y: number, state: string, opacity: number } | null {
    const relativeTime = this.tunnel.getRelativeTime(absoluteTime)
    
    if (this.timePositions.length === 0) return null
    
    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relativeTime < first.time) {
      // Car hasn't spawned yet
      return null
    }
    
    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]
      
      if (relativeTime >= current.time && relativeTime < next.time) {
        // Interpolate between current and next
        const t = (relativeTime - current.time) / (next.time - current.time)
        
        return {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
          state: current.state,
          opacity: current.opacity + (next.opacity - current.opacity) * t
        }
      }
    }
    
    // Check if we're past the last time position
    const last = this.timePositions[this.timePositions.length - 1]
    if (relativeTime >= last.time) {
      if (last.opacity <= 0) return null // Fully faded out
      return { ...last }
    }
    
    return null
  }
  
  getId(): number {
    return this.id
  }
  
  getSpawnMinute(): number {
    return this.spawnMinute
  }
  
  getLane(): 'L' | 'R' {
    return this.lane
  }
}