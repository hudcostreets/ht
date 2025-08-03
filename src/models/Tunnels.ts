import { ColorRectangles } from './ColorRectangles'
import { GlobalPace } from './GlobalPace'
import { GlobalSweep } from './GlobalSweep'
import { Tunnel, type TunnelConfig } from './Tunnel'
import { Direction } from './types'

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
  direction: Direction
  metadata: Metadata
}

export class Tunnels {
  public eastbound: Tunnel
  public westbound: Tunnel
  public sweepConfig: { speed: number, stagingOffset: number }
  public  paceConfig: { speed: number, stagingOffset: number }
  public sweep: GlobalSweep
  public pace: GlobalPace
  private colorRects: ColorRectangles

  constructor(config: TunnelsConfig) {
    this.eastbound = new Tunnel(config.eastbound)
    this.westbound = new Tunnel(config.westbound)
    this.sweepConfig = config.sweepConfig
    this.paceConfig = config.paceConfig
    // Create global sweep vehicle that traverses both tunnels
    this.sweep = new GlobalSweep({
      eastbound: this.eastbound,
      westbound: this.westbound,
      sweepMph: config.sweepConfig.speed,
      stagingOffset: config.sweepConfig.stagingOffset
    })

    // Create global pace vehicle that traverses both tunnels
    this.pace = new GlobalPace({
      eastbound: this.eastbound,
      westbound: this.westbound,
      paceMph: config.paceConfig.speed,
      stagingOffset: config.paceConfig.stagingOffset
    })

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
          id: `bike-e-${bike.idx}`,
          type: 'bike',
          position,
          direction: 'east',
          metadata: { spawnMinute: bike.spawnMin, idx: bike.idx }
        })
      }
    })

    this.e.allCars.forEach(car => {
      const position = car.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `car-e-${car.laneId}-${car.idx}`,
          type: 'car',
          position,
          direction: 'east',
          metadata: { spawnMinute: car.spawnMin, lane: car.laneId, idx: car.idx, }
        })
      }
    })

    // Westbound vehicles
    this.w.bikes.forEach(bike => {
      const position = bike.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `bike-w-${bike.idx}`,
          type: 'bike',
          position,
          direction: 'west',
          metadata: { spawnMinute: bike.spawnMin, idx: bike.idx }
        })
      }
    })

    this.w.allCars.forEach(car => {
      const position = car.getPos(absMins)
      if (position) {
        vehicles.push({
          id: `car-w-${car.laneId}-${car.idx}`,
          type: 'car',
          position,
          direction: 'west',
          metadata: { spawnMinute: car.spawnMin, lane: car.laneId }
        })
      }
    })

    // Global vehicles (sweep and pace)
    const sweepPos = this.sweep.getPos(absMins)
    if (sweepPos.state === 'transiting' || sweepPos.state === 'exiting') {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepPos,
        direction: this.sweep.currentTunnel?.config.direction || 'east',
        metadata: {}
      })
    }

    const pacePos = this.pace.getPos(absMins)
    if (pacePos.state === 'transiting' || pacePos.state === 'exiting') {
      vehicles.push({
        id: 'pace',
        type: 'pace',
        position: pacePos,
        direction: this.pace.currentTunnel?.config.direction || 'east',
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
    direction: Direction
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
