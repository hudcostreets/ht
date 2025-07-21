import { Tunnel } from './Tunnel'
import type { TunnelConfig } from './Tunnel'
import { Sweep } from './Sweep'
import { Pace } from './Pace'
import { ColorRectangles } from './ColorRectangles'

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

export type Vehicle<Metadata = any> = {
  id: string
  type: 'bike' | 'car' | 'sweep' | 'pace'
  position: { x: number, y: number, state: string, opacity: number }
  direction: 'east' | 'west'
  metadata: Metadata
}

export class Tunnels {
  public eastbound: Tunnel
  public westbound: Tunnel
  public sweepConfig: { speed: number, stagingOffset: number }
  public  paceConfig: { speed: number, stagingOffset: number }
  private sweep: Sweep
  private pace: Pace
  private colorRects: ColorRectangles
  
  constructor(config: TunnelsConfig) {
    this.eastbound = new Tunnel(config.eastbound)
    this.westbound = new Tunnel(config.westbound)
    this.sweepConfig = config.sweepConfig
    this.paceConfig = config.paceConfig
    this.sweep = new Sweep(this)
    this.pace = new Pace(this)
    this.colorRects = new ColorRectangles(this)
  }

  public get e(): Tunnel {
    return this.eastbound
  }

  public get w(): Tunnel {
    return this.westbound
  }

  // Get all vehicles for rendering
  getAllVehicles(absMins: number): Array<Vehicle> {
    const vehicles: Array<Vehicle> = []
    
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
    
    this.e.allCars.forEach(car => {
      const position = car.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `car-e-${car.laneId}-${car.id}`,
          type: 'car',
          position,
          direction: 'east',
          metadata: { spawnMinute: car.spawnMin, lane: car.laneId }
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
    
    this.w.allCars.forEach(car => {
      const position = car.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `car-w-${car.laneId}-${car.id}`,
          type: 'car',
          position,
          direction: 'west',
          metadata: { spawnMinute: car.spawnMin, lane: car.laneId }
        })
      }
    })
    
    // Global vehicles (sweep and pace)
    // Calculate relative minutes from absolute minutes
    const relMins = absMins % this.eastbound.config.period
    
    const sweepPosition = this.sweep.getPosition(relMins)
    if (sweepPosition) {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepPosition,
        direction: sweepPosition.direction,
        metadata: {}
      })
    }
    
    const pacePosition = this.pace.getPosition(relMins)
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
    // Calculate relative minutes from absolute minutes
    const relMins = absMins % this.eastbound.config.period
    return this.colorRects.getRectangles(relMins)
  }
}
