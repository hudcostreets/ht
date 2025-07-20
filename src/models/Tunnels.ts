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
  public eastbound: Tunnel
  public westbound: Tunnel
  public sweepConfig: { speed: number, stagingOffset: number }
  public paceConfig: { speed: number, stagingOffset: number }
  
  constructor(config: TunnelsConfig) {
    this.eastbound = new Tunnel(config.eastbound)
    this.westbound = new Tunnel(config.westbound)
    this.sweepConfig = config.sweepConfig
    this.paceConfig = config.paceConfig
  }

  public get e(): Tunnel {
    return this.eastbound
  }

  public get w(): Tunnel {
    return this.westbound
  }

  // Get all vehicles for rendering
  getAllVehicles(absMins: number): Array<{
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
    this.e.bikes.forEach(bike => {
      const position = bike.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `bike-e-${bike.index}`,
          type: 'bike',
          position,
          direction: 'east',
          metadata: { spawnMinute: bike.spawnMin, index: bike.index }
        })
      }
    })
    
    this.e.cars.forEach(car => {
      const position = car.getPos(absMins)
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
    this.w.bikes.forEach(bike => {
      const position = bike.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `bike-w-${bike.index}`,
          type: 'bike',
          position,
          direction: 'west',
          metadata: { spawnMinute: bike.spawnMin, index: bike.index }
        })
      }
    })
    
    this.w.cars.forEach(car => {
      const position = car.getPos(absMins)
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
    const sweepPosition = this.getSweepPosition(absMins)
    if (sweepPosition) {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepPosition,
        direction: sweepPosition.direction,
        metadata: {}
      })
    }
    
    const pacePosition = this.getPacePosition(absMins)
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
  
  private getSweepPosition(absMins: number): GlobalVehiclePosition | null {
    // Sweep follows this pattern:
    // - Starts at eastbound staging at :35 (facing east)
    // - Sweeps through tunnel eastbound during sweep phase (:50-:55)
    // - Ends at westbound staging at :05 (facing west)
    // - Sweeps through tunnel westbound during sweep phase (:20-:25)
    // - Back to eastbound staging at :35
    
    const minuteInHour = Math.floor(absMins) % 60

    const eastConfig = this.e.config
    const westConfig = this.w.config
    const tunnelWidth = eastConfig.laneWidthPx
    
    // Determine current sweep state based on minute
    if (minuteInHour >= 35 && minuteInHour < 50) {
      // At eastbound staging (facing east, preparing for eastbound sweep)
      return {
        x: -this.sweepConfig.stagingOffset,
        y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
        state: 'staging',
        opacity: 1,
        direction: 'east'
      }
    } else if (minuteInHour >= 50 && minuteInHour < 55) {
      // Sweeping eastbound tunnel
      const totalSweepMinutes = (minuteInHour - 50)
      const transitionMins = 5
      
      if (totalSweepMinutes < transitionMins) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalSweepMinutes / transitionMins
        return {
          x: -this.sweepConfig.stagingOffset * (1 - transitionProgress),
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // Sweeping through tunnel
        const sweepProgress = (totalSweepMinutes - transitionMins) / (5 - transitionMins)
        return {
          x: sweepProgress * tunnelWidth,
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'tunnel',
          opacity: 1,
          direction: 'east'
        }
      }
    } else if (minuteInHour >= 55 || minuteInHour < 5) {
      // Traveling to westbound staging
      const transitionMinute = minuteInHour >= 55 ? minuteInHour - 55 : minuteInHour + 5
      const transitionProgress = transitionMinute / 10
      
      if (transitionProgress >= 1) {
        // At westbound staging
        return {
          x: tunnelWidth + this.sweepConfig.stagingOffset,
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // In transition
        return {
          x: tunnelWidth + (this.sweepConfig.stagingOffset * transitionProgress),
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'exiting',
          opacity: 1,
          direction: 'east'
        }
      }
    } else if (minuteInHour >= 5 && minuteInHour < 20) {
      // At westbound staging (facing west, preparing for westbound sweep)
      return {
        x: tunnelWidth + this.sweepConfig.stagingOffset,
        y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
        state: 'staging',
        opacity: 1,
        direction: 'west'
      }
    } else if (minuteInHour >= 20 && minuteInHour < 25) {
      // Sweeping westbound tunnel
      const totalSweepMinutes = minuteInHour - 20
      const transitionMins = 5
      
      if (totalSweepMinutes < transitionMins) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalSweepMinutes / transitionMins
        return {
          x: tunnelWidth + this.sweepConfig.stagingOffset * (1 - transitionProgress),
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // Sweeping through tunnel
        const sweepProgress = (totalSweepMinutes - transitionMins) / (5 - transitionMins)
        return {
          x: tunnelWidth - (sweepProgress * tunnelWidth),
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'tunnel',
          opacity: 1,
          direction: 'west'
        }
      }
    } else {
      // minuteInHour >= 25 && minuteInHour < 35
      // Traveling back to eastbound staging
      const transitionMinute = minuteInHour - 25
      const transitionProgress = transitionMinute / 10
      
      if (transitionProgress >= 1) {
        // Back at eastbound staging
        return {
          x: -this.sweepConfig.stagingOffset,
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // In transition
        return {
          x: -this.sweepConfig.stagingOffset * transitionProgress,
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'exiting',
          opacity: 1,
          direction: 'west'
        }
      }
    }
  }
  
  private getPacePosition(absMins: number): GlobalVehiclePosition | null {
    // Pace follows this pattern:
    // - Starts at westbound staging at :04 (facing west)
    // - Leads cars through tunnel westbound during pace-car phase (:25-:30)
    // - Ends at eastbound staging at :34 (facing east)
    // - Leads cars through tunnel eastbound during pace-car phase (:55-:00)
    // - Back to westbound staging at :04
    
    const minuteInHour = Math.floor(absMins) % 60

    const eastConfig = this.e.config
    const westConfig = this.w.config
    const tunnelWidth = eastConfig.laneWidthPx
    
    // Determine current pace state based on minute
    if (minuteInHour >= 4 && minuteInHour < 25) {
      // At westbound staging (facing west, preparing for westbound pace)
      return {
        x: tunnelWidth + this.paceConfig.stagingOffset,
        y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
        state: 'staging',
        opacity: 1,
        direction: 'west'
      }
    } else if (minuteInHour >= 25 && minuteInHour < 30) {
      // Leading cars through westbound tunnel
      const totalPaceMins = minuteInHour - 25
      const transitionMins = 5
      
      if (totalPaceMins < transitionMins) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = totalPaceMins / transitionMins
        return {
          x: tunnelWidth + this.paceConfig.stagingOffset * (1 - transitionProgress),
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // Leading through tunnel
        const paceProgress = (totalPaceMins - transitionMins) / (5 - transitionMins)
        return {
          x: tunnelWidth - (paceProgress * tunnelWidth),
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'tunnel',
          opacity: 1,
          direction: 'west'
        }
      }
    } else if (minuteInHour >= 30 && minuteInHour < 34) {
      // Traveling to eastbound staging
      const transitionMinute = minuteInHour - 30
      const transitionProgress = transitionMinute / 4
      
      if (transitionProgress >= 1) {
        // At eastbound staging
        return {
          x: -this.paceConfig.stagingOffset,
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // In transition
        return {
          x: -this.paceConfig.stagingOffset * transitionProgress,
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'exiting',
          opacity: 1,
          direction: 'west'
        }
      }
    } else if (minuteInHour >= 34 && minuteInHour < 55) {
      // At eastbound staging (facing east, preparing for eastbound pace)
      return {
        x: -this.paceConfig.stagingOffset,
        y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
        state: 'staging',
        opacity: 1,
        direction: 'east'
      }
    } else if (minuteInHour >= 55 || minuteInHour < 0) {
      // Leading cars through eastbound tunnel
      const paceMinute = minuteInHour >= 55 ? minuteInHour - 55 : 60 + minuteInHour
      const transitionMins = 5
      
      if (paceMinute < transitionMins) {
        // Transitioning from staging to tunnel entrance
        const transitionProgress = paceMinute / transitionMins
        return {
          x: -this.paceConfig.stagingOffset * (1 - transitionProgress),
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'staging',
          opacity: 1,
          direction: 'east'
        }
      } else {
        // Leading through tunnel
        const paceProgress = (paceMinute - transitionMins) / (5 - transitionMins)
        return {
          x: paceProgress * tunnelWidth,
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'tunnel',
          opacity: 1,
          direction: 'east'
        }
      }
    } else {
      // minuteInHour >= 0 && minuteInHour < 4
      // Traveling back to westbound staging
      const transitionProgress = minuteInHour / 4
      
      if (transitionProgress >= 1) {
        // Back at westbound staging
        return {
          x: tunnelWidth + this.paceConfig.stagingOffset,
          y: westConfig.laneHeightPx / 2, // R lane (top) for westbound
          state: 'staging',
          opacity: 1,
          direction: 'west'
        }
      } else {
        // In transition
        return {
          x: tunnelWidth + (this.paceConfig.stagingOffset * transitionProgress),
          y: eastConfig.laneHeightPx + eastConfig.laneHeightPx / 2, // R lane (bottom) for eastbound
          state: 'exiting',
          opacity: 1,
          direction: 'east'
        }
      }
    }
  }

  // Get current phase for each direction
  getPhases(absMins: number): { east: string, west: string } {
    const eastRelativeTime = this.e.relMins(absMins)
    const westRelativeTime = this.w.relMins(absMins)
    
    return {
      east: this.e.getPhase(eastRelativeTime),
      west: this.w.getPhase(westRelativeTime)
    }
  }
  
  // Get color rectangles for rendering
  getColorRectangles(absMins: number): Array<{
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
    
    const eastConfig = this.e.config
    const westConfig = this.w.config
    const tunnelWidth = eastConfig.laneWidthPx
    const laneHeight = eastConfig.laneHeightPx
    
    // Get phases
    const phases = this.getPhases(absMins)
    
    // Eastbound rectangles
    if (phases.east === 'bikes-enter' || phases.east === 'clearing' || phases.east === 'sweep') {
      // Calculate how far the green zone has progressed
      const eastRelMins = this.e.relMins(absMins)
      const minuteInPhase = Math.floor(eastRelMins)
      
      if (minuteInPhase < 5) { // During bikes-enter, clearing, and sweep
        const progress = (eastRelMins % 5) / 5
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
      const westRelMins = this.w.relMins(absMins)
      const minuteInPhase = Math.floor(westRelMins)
      
      if (minuteInPhase < 5) { // During bikes-enter, clearing, and sweep
        const progress = (westRelMins % 5) / 5
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
