import { ColorRectangles } from './ColorRectangles'
import { PaceVehicle } from './PaceVehicle'
import { SweepVehicle } from './SweepVehicle'
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
  private sweepEast: SweepVehicle
  private sweepWest: SweepVehicle
  private paceEast: PaceVehicle
  private paceWest: PaceVehicle
  private colorRects: ColorRectangles

  constructor(config: TunnelsConfig) {
    this.eastbound = new Tunnel(config.eastbound)
    this.westbound = new Tunnel(config.westbound)
    this.sweepConfig = config.sweepConfig
    this.paceConfig = config.paceConfig
    // Create sweep vehicles for each direction
    // Eastbound sweep starts at minute 50
    this.sweepEast = new SweepVehicle({
      tunnel: this.eastbound,
      laneId: 'R',
      idx: 0,
      spawnMin: 50,
      sweepMph: config.sweepConfig.speed
    })

    // Westbound sweep starts at minute 20
    this.sweepWest = new SweepVehicle({
      tunnel: this.westbound,
      laneId: 'R',
      idx: 0,
      spawnMin: 20,
      sweepMph: config.sweepConfig.speed
    })

    // Create pace vehicles for each direction
    // Eastbound pace starts at minute 55 (10 mins after pen opens)
    this.paceEast = new PaceVehicle({
      tunnel: this.eastbound,
      laneId: 'R',
      idx: 0,
      spawnMin: 55,
      paceMph: config.paceConfig.speed
    })

    // Westbound pace starts at minute 25 (10 mins after pen opens)
    this.paceWest = new PaceVehicle({
      tunnel: this.westbound,
      laneId: 'R',
      idx: 0,
      spawnMin: 25,
      paceMph: config.paceConfig.speed
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
    // Get positions for both sweep vehicles
    const sweepEastPos = this.sweepEast.getPos(absMins)
    const sweepWestPos = this.sweepWest.getPos(absMins)

    // Determine which sweep vehicle is active based on states
    // If east sweep is exiting, switch to west sweep
    if (sweepEastPos.state === 'transiting' || sweepEastPos.state === 'exiting') {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepEastPos,
        direction: 'east',
        metadata: {}
      })
    } else if (sweepWestPos.state === 'transiting' || sweepWestPos.state === 'exiting') {
      vehicles.push({
        id: 'sweep',
        type: 'sweep',
        position: sweepWestPos,
        direction: 'west',
        metadata: {}
      })
    }

    // Get positions for both pace vehicles
    const paceEastPos = this.paceEast.getPos(absMins)
    const paceWestPos = this.paceWest.getPos(absMins)

    // Determine which pace vehicle is active based on states
    if (paceEastPos.state === 'transiting' || paceEastPos.state === 'exiting') {
      vehicles.push({
        id: 'pace',
        type: 'pace',
        position: paceEastPos,
        direction: 'east',
        metadata: {}
      })
    } else if (paceWestPos.state === 'transiting' || paceWestPos.state === 'exiting') {
      vehicles.push({
        id: 'pace',
        type: 'pace',
        position: paceWestPos,
        direction: 'west',
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
