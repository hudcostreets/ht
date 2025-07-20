import { Tunnel } from './Tunnel'
import type { TunnelConfig } from './Tunnel'

export interface TunnelsConfig {
  eastbound: TunnelConfig
  westbound: TunnelConfig
  // Global vehicles
  sweepConfig: {
    speed: number
    stagingOffset: number
  }
  paceConfig: {
    speed: number
    stagingOffset: number
  }
}

export interface GlobalVehiclePosition {
  x: number
  y: number
  state: 'staging' | 'tunnel' | 'exiting'
  opacity: number
  direction: 'east' | 'west'  // Current movement direction
}

export class Tunnels {
  private eastbound: Tunnel
  private westbound: Tunnel
  private sweepConfig: { speed: number, stagingOffset: number }
  private paceConfig: { speed: number, stagingOffset: number }
  
  constructor(config: TunnelsConfig) {
    this.eastbound = new Tunnel(config.eastbound)
    this.westbound = new Tunnel(config.westbound)
    this.sweepConfig = config.sweepConfig
    this.paceConfig = config.paceConfig
  }
  
  // Get all vehicles for rendering
  getAllVehicles(absoluteTime: number): Array<{
    id: string
    type: 'bike' | 'car' | 'sweep' | 'pace'
    position: { x: number, y: number, state: string, opacity: number }
    direction: 'east' | 'west'
    metadata: any
  }> {
    const vehicles: Array<{
      id: string
      type: 'bike' | 'car' | 'sweep' | 'pace'
      position: { x: number, y: number, state: string, opacity: number }
      direction: 'east' | 'west'
      metadata: any
    }> = []
    
    // Eastbound vehicles
    this.eastbound.getBikes().forEach(bike => {
      const position = bike.getPosition(absoluteTime)
      if (position) {
        vehicles.push({
          id: `bike-e-${bike.getIndex()}`,
          type: 'bike',
          position,
          direction: 'east',
          metadata: { spawnMinute: bike.getSpawnMinute(), index: bike.getIndex() }
        })
      }
    })
    
    this.eastbound.getCars().forEach(car => {
      const position = car.getPosition(absoluteTime)
      if (position) {
        vehicles.push({
          id: `car-e-${car.getLane()}-${car.getId()}`,
          type: 'car',
          position,
          direction: 'east',
          metadata: { spawnMinute: car.getSpawnMinute(), lane: car.getLane() }
        })
      }
    })
    
    // Westbound vehicles
    this.westbound.getBikes().forEach(bike => {
      const position = bike.getPosition(absoluteTime)
      if (position) {
        vehicles.push({
          id: `bike-w-${bike.getIndex()}`,
          type: 'bike',
          position,
          direction: 'west',
          metadata: { spawnMinute: bike.getSpawnMinute(), index: bike.getIndex() }
        })
      }
    })
    
    this.westbound.getCars().forEach(car => {
      const position = car.getPosition(absoluteTime)
      if (position) {
        vehicles.push({
          id: `car-w-${car.getLane()}-${car.getId()}`,
          type: 'car',
          position,
          direction: 'west',
          metadata: { spawnMinute: car.getSpawnMinute(), lane: car.getLane() }
        })
      }
    })
    
    // Global vehicles (sweep and pace)
    const sweepPosition = this.getSweepPosition(absoluteTime)
    if (sweepPosition) {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepPosition,
        direction: sweepPosition.direction,
        metadata: {}
      })
    }
    
    const pacePosition = this.getPacePosition(absoluteTime)
    if (pacePosition) {
      vehicles.push({
        id: 'pace',
        type: 'pace',
        position: pacePosition,
        direction: pacePosition.direction,
        metadata: {}
      })
    }
    
    return vehicles
  }
  
  private getSweepPosition(absoluteTime: number): GlobalVehiclePosition | null {
    // Sweep follows this pattern:
    // - Starts at eastbound staging at :35 (facing east)
    // - Sweeps through tunnel eastbound during sweep phase (:50-:55)
    // - Ends at westbound staging at :05 (facing west)
    // - Sweeps through tunnel westbound during sweep phase (:20-:25)
    // - Back to eastbound staging at :35
    
    const minuteInHour = Math.floor(absoluteTime / 60) % 60
    const secondInMinute = absoluteTime % 60
    
    const eastConfig = this.eastbound.getConfig()
    const westConfig = this.westbound.getConfig()
    const tunnelWidth = eastConfig.lanePixelWidth
    
    // Determine current sweep state based on minute
    if (minuteInHour >= 35 && minuteInHour < 50) {
      // At eastbound staging (facing east, preparing for eastbound sweep)
      return {
        x: -this.sweepConfig.stagingOffset,
        y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
        state: 'staging',
        opacity: 1,
        direction: 'east'
      }
    } else if (minuteInHour >= 50 && minuteInHour < 55) {
      // Sweeping eastbound tunnel
      const totalSweepSeconds = (minuteInHour - 50) * 60 + secondInMinute
      const transitionTime = 5 // 5 seconds to move from staging to tunnel entrance
      
      if (totalSweepSeconds < transitionTime) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalSweepSeconds / transitionTime
        return {
          x: -this.sweepConfig.stagingOffset * (1 - transitionProgress),
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // Sweeping through tunnel
        const sweepProgress = (totalSweepSeconds - transitionTime) / (5 * 60 - transitionTime)
        return {
          x: sweepProgress * tunnelWidth,
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'tunnel',
          opacity: 1,
          direction: 'east'
        }
      }
    } else if (minuteInHour >= 55 || minuteInHour < 5) {
      // Traveling to westbound staging
      const transitionMinute = minuteInHour >= 55 ? minuteInHour - 55 : minuteInHour + 5
      const transitionProgress = (transitionMinute * 60 + secondInMinute) / (10 * 60)
      
      if (transitionProgress >= 1) {
        // At westbound staging
        return {
          x: tunnelWidth + this.sweepConfig.stagingOffset,
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // In transition
        return {
          x: tunnelWidth + (this.sweepConfig.stagingOffset * transitionProgress),
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'exiting',
          opacity: 1,
          direction: 'east'
        }
      }
    } else if (minuteInHour >= 5 && minuteInHour < 20) {
      // At westbound staging (facing west, preparing for westbound sweep)
      return {
        x: tunnelWidth + this.sweepConfig.stagingOffset,
        y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
        state: 'staging',
        opacity: 1,
        direction: 'west'
      }
    } else if (minuteInHour >= 20 && minuteInHour < 25) {
      // Sweeping westbound tunnel
      const totalSweepSeconds = (minuteInHour - 20) * 60 + secondInMinute
      const transitionTime = 5 // 5 seconds to move from staging to tunnel entrance
      
      if (totalSweepSeconds < transitionTime) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalSweepSeconds / transitionTime
        return {
          x: tunnelWidth + this.sweepConfig.stagingOffset * (1 - transitionProgress),
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // Sweeping through tunnel
        const sweepProgress = (totalSweepSeconds - transitionTime) / (5 * 60 - transitionTime)
        return {
          x: tunnelWidth - (sweepProgress * tunnelWidth),
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'tunnel',
          opacity: 1,
          direction: 'west'
        }
      }
    } else {
      // minuteInHour >= 25 && minuteInHour < 35
      // Traveling back to eastbound staging
      const transitionMinute = minuteInHour - 25
      const transitionProgress = (transitionMinute * 60 + secondInMinute) / (10 * 60)
      
      if (transitionProgress >= 1) {
        // Back at eastbound staging
        return {
          x: -this.sweepConfig.stagingOffset,
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // In transition
        return {
          x: -this.sweepConfig.stagingOffset * transitionProgress,
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'exiting',
          opacity: 1,
          direction: 'west'
        }
      }
    }
  }
  
  private getPacePosition(absoluteTime: number): GlobalVehiclePosition | null {
    // Pace follows this pattern:
    // - Starts at westbound staging at :04 (facing west)
    // - Leads cars through tunnel westbound during pace-car phase (:25-:30)
    // - Ends at eastbound staging at :34 (facing east)
    // - Leads cars through tunnel eastbound during pace-car phase (:55-:00)
    // - Back to westbound staging at :04
    
    const minuteInHour = Math.floor(absoluteTime / 60) % 60
    const secondInMinute = absoluteTime % 60
    
    const eastConfig = this.eastbound.getConfig()
    const westConfig = this.westbound.getConfig()
    const tunnelWidth = eastConfig.lanePixelWidth
    
    // Determine current pace state based on minute
    if (minuteInHour >= 4 && minuteInHour < 25) {
      // At westbound staging (facing west, preparing for westbound pace)
      return {
        x: tunnelWidth + this.paceConfig.stagingOffset,
        y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
        state: 'staging',
        opacity: 1,
        direction: 'west'
      }
    } else if (minuteInHour >= 25 && minuteInHour < 30) {
      // Leading cars through westbound tunnel
      const totalPaceSeconds = (minuteInHour - 25) * 60 + secondInMinute
      const transitionTime = 5 // 5 seconds to move from staging to tunnel entrance
      
      if (totalPaceSeconds < transitionTime) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalPaceSeconds / transitionTime
        return {
          x: tunnelWidth + this.paceConfig.stagingOffset * (1 - transitionProgress),
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // Leading through tunnel
        const paceProgress = (totalPaceSeconds - transitionTime) / (5 * 60 - transitionTime)
        return {
          x: tunnelWidth - (paceProgress * tunnelWidth),
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'tunnel',
          opacity: 1,
          direction: 'west'
        }
      }
    } else if (minuteInHour >= 30 && minuteInHour < 34) {
      // Traveling to eastbound staging
      const transitionMinute = minuteInHour - 30
      const transitionProgress = (transitionMinute * 60 + secondInMinute) / (4 * 60)
      
      if (transitionProgress >= 1) {
        // At eastbound staging
        return {
          x: -this.paceConfig.stagingOffset,
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // In transition
        return {
          x: -this.paceConfig.stagingOffset * transitionProgress,
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'exiting',
          opacity: 1,
          direction: 'west'
        }
      }
    } else if (minuteInHour >= 34 && minuteInHour < 55) {
      // At eastbound staging (facing east, preparing for eastbound pace)
      return {
        x: -this.paceConfig.stagingOffset,
        y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
        state: 'staging',
        opacity: 1,
        direction: 'east'
      }
    } else if (minuteInHour >= 55 || minuteInHour < 0) {
      // Leading cars through eastbound tunnel
      const paceMinute = minuteInHour >= 55 ? minuteInHour - 55 : 60 + minuteInHour
      const totalPaceSeconds = paceMinute * 60 + secondInMinute
      const transitionTime = 5 // 5 seconds to move from staging to tunnel entrance
      
      if (totalPaceSeconds < transitionTime) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalPaceSeconds / transitionTime
        return {
          x: -this.paceConfig.stagingOffset * (1 - transitionProgress),
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // Leading through tunnel
        const paceProgress = (totalPaceSeconds - transitionTime) / (5 * 60 - transitionTime)
        return {
          x: paceProgress * tunnelWidth,
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'tunnel',
          opacity: 1,
          direction: 'east'
        }
      }
    } else {
      // minuteInHour >= 0 && minuteInHour < 4
      // Traveling back to westbound staging
      const transitionMinute = minuteInHour
      const transitionProgress = (transitionMinute * 60 + secondInMinute) / (4 * 60)
      
      if (transitionProgress >= 1) {
        // Back at westbound staging
        return {
          x: tunnelWidth + this.paceConfig.stagingOffset,
          y: westConfig.lanePixelHeight / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // In transition
        return {
          x: tunnelWidth + (this.paceConfig.stagingOffset * transitionProgress),
          y: eastConfig.lanePixelHeight + eastConfig.lanePixelHeight / 2, // R lane (bottom) for eastbound
          state: 'exiting',
          opacity: 1,
          direction: 'east'
        }
      }
    }
  }
  
  getEastbound(): Tunnel {
    return this.eastbound
  }
  
  getWestbound(): Tunnel {
    return this.westbound
  }
  
  // Get current phase for each direction
  getPhases(absoluteTime: number): { east: string, west: string } {
    const eastRelativeTime = this.eastbound.getRelativeTime(absoluteTime)
    const westRelativeTime = this.westbound.getRelativeTime(absoluteTime)
    
    return {
      east: this.eastbound.getPhase(eastRelativeTime),
      west: this.westbound.getPhase(westRelativeTime)
    }
  }
  
  // Get color rectangles for rendering
  getColorRectangles(absoluteTime: number): Array<{
    direction: 'east' | 'west'
    color: 'green' | 'red'
    x: number
    width: number
    y: number
    height: number
  }> {
    const rectangles: Array<{
      direction: 'east' | 'west'
      color: 'green' | 'red'
      x: number
      width: number
      y: number
      height: number
    }> = []
    
    const eastConfig = this.eastbound.getConfig()
    const westConfig = this.westbound.getConfig()
    const tunnelWidth = eastConfig.lanePixelWidth
    const laneHeight = eastConfig.lanePixelHeight
    
    // Get phases
    const phases = this.getPhases(absoluteTime)
    
    // Eastbound rectangles
    if (phases.east === 'bikes-enter' || phases.east === 'clearing' || phases.east === 'sweep') {
      // Calculate how far the green zone has progressed
      const eastRelativeTime = this.eastbound.getRelativeTime(absoluteTime)
      const minuteInPhase = Math.floor(eastRelativeTime / 60)
      
      if (minuteInPhase < 5) { // During bikes-enter, clearing, and sweep
        const progress = (eastRelativeTime % (5 * 60)) / (5 * 60)
        rectangles.push({
          direction: 'east',
          color: 'green',
          x: 0,
          width: progress * tunnelWidth,
          y: laneHeight,  // R lane for eastbound (bottom lane)
          height: laneHeight
        })
        rectangles.push({
          direction: 'east',
          color: 'red',
          x: progress * tunnelWidth,
          width: (1 - progress) * tunnelWidth,
          y: laneHeight,  // R lane for eastbound (bottom lane)
          height: laneHeight
        })
      }
    }
    
    // Westbound rectangles
    if (phases.west === 'bikes-enter' || phases.west === 'clearing' || phases.west === 'sweep') {
      // Calculate how far the green zone has progressed
      const westRelativeTime = this.westbound.getRelativeTime(absoluteTime)
      const minuteInPhase = Math.floor(westRelativeTime / 60)
      
      if (minuteInPhase < 5) { // During bikes-enter, clearing, and sweep
        const progress = (westRelativeTime % (5 * 60)) / (5 * 60)
        rectangles.push({
          direction: 'west',
          color: 'green',
          x: tunnelWidth - (progress * tunnelWidth),
          width: progress * tunnelWidth,
          y: 0,  // R lane for westbound (top lane)
          height: laneHeight
        })
        rectangles.push({
          direction: 'west',
          color: 'red',
          x: 0,
          width: tunnelWidth - (progress * tunnelWidth),
          y: 0,  // R lane for westbound (top lane)
          height: laneHeight
        })
      }
    }
    
    return rectangles
  }
}