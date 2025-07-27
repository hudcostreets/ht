import { Bike } from "./Bike"
import {Car} from "./Car"
import { Lane } from "./Lane"
import {XY, xy} from "./XY.ts"
import {Field} from "./TimeVal"

export type Direction = 'east' | 'west'

export type SpawnQueue = {
  offset: XY
  minsBeforeDequeueing: number // Minutes before dequeueing starts
  minsDequeueing: number
}

export interface TunnelConfig {
  direction: Direction
  offsetMin: number
  lengthMi: number
  period: number
  carMph: number
  bikeUpMph: number
  bikeDownMph: number
  bikeFlatMph: number
  penCloseMin: number
  carsPerMin: number
  carsReleasedPerMin: number
  bikesPerMin: number
  bikesReleasedPerMin: number
  paceCarStartMin: number

  // Layout
  laneWidthPx: number
  laneHeightPx: number
  penRelativeX: number   // Relative to R lane start
  penRelativeY: number   // Relative to R lane start
  penWidthPx: number
  penHeightPx: number
  fadeMins: number
  queuedCarWidthPx: number
}

export type State = 'origin' | 'queued' | 'dequeueing' | 'transiting' | 'exiting' | 'done'
export type Pos = {
  x: number
  y: number
  state: State
  opacity: number
}

export const field: Field<Pos> = {
  add: (l: Pos, r: Pos): Pos => ({ x: l.x + r.x, y: l.y + r.y, state: l.state, opacity: l.opacity + r.opacity }),
  sub: (l: Pos, r: Pos): Pos => ({ x: l.x - r.x, y: l.y - r.y, state: l.state, opacity: l.opacity - r.opacity }),
  mul: (l: Pos, r: number): Pos => ({ x: l.x * r, y: l.y * r, state: l.state, opacity: l.opacity * r }),
}

export type Cars = {
  l: Car[]
  r: Car[]
}

export class Tunnel {
  public config: TunnelConfig
  public dir: Direction
  public d: number
  public bikes: Bike[]
  public nbikes: number
  public cars: Cars
  public ncars: number
  public l: Lane
  public r: Lane
  // public nQueueCars0: number  // Number of cars that queue on spawn before pace car departs
  // public nQueueCars1: number  // Number of cars that queue on spawn after pace car departs
  // public nQueueCars: number   // Number of cars that queue on spawn (total, before and after pace car)
  
  constructor(config: TunnelConfig) {
    this.config = config
    const { bikesPerMin, carsPerMin, carsReleasedPerMin, laneWidthPx, laneHeightPx, direction, paceCarStartMin, carMph, lengthMi, queuedCarWidthPx, } = config
    this.dir = direction
    this.d = direction === 'east' ? 1 : -1
    this.nbikes = config.period * bikesPerMin
    const { nbikes, d } = this

    // Create lanes
    const start = direction === 'east' ? 0 : laneWidthPx
    const end = direction === 'east' ? laneWidthPx : 0
    this.l = new Lane({
      id: 'L',
      entrance: xy(start, laneHeightPx * (1 - d * .5)),
      exit: xy(end, laneHeightPx * (1 - d * .5)),
    })
    this.r = new Lane({
      id: 'R',
      entrance: xy(start, laneHeightPx * (1 + d * .5)),
      exit: xy(end, laneHeightPx * (1 + d * .5)),
    })

    // Create cars
    const lcars: Car[] = []
    const rcars: Car[] = []
    this.cars = { l: lcars, r: rcars }
    this.ncars = config.period * carsPerMin
    const { ncars } = this
    for (let idx = 0; idx < ncars; idx++) {
      lcars.push(new Car({ tunnel: this, laneId: 'L', idx, spawnMin: config.period * (idx + .5) / ncars, })) // Stagger L cars by half a phase
      rcars.push(new Car({ tunnel: this, laneId: 'R', idx, spawnMin: config.period *  idx       / ncars, }))
    }

    // Populate rcars' spawnQueue elems
    // Instead of checking phase at spawn time, check if tunnel is blocked when car arrives
    let queueLen = 0
    let prvSpawnMin = 0
    for (const rcar of rcars) {
      // Tunnel is blocked from minute 0 (bikes enter) until pace car starts at minute 10
      const { spawnMin } = rcar
      const elapsed = spawnMin - prvSpawnMin
      const carsElapsed = elapsed * carsReleasedPerMin
      queueLen = Math.max(queueLen - carsElapsed, 0)
      const queueOpenMin = paceCarStartMin
      // Handle period wrapping - if car arrives in blocked period of this or next cycle
      if (spawnMin < queueOpenMin || queueLen > 0) {
        // Car needs to queue
        const queueOffsetX = queueLen * queuedCarWidthPx
        const minsBeforeDequeueing = Math.max(queueOpenMin - spawnMin, 0)
        queueLen++
        const minsDequeueing = queueLen / carsReleasedPerMin
        rcar.spawnQueue = {
          offset: { x: queueOffsetX, y: 0 },
          minsBeforeDequeueing,
          minsDequeueing,
        }
      }
      prvSpawnMin = spawnMin
      // else: Car flows normally, leave spawnQueue undefined
    }

    // Calculate bike queueing
    let bikeQueueIdx = 0
    let currentReleaseMin = 0
    const bikesPerRow = config.bikesReleasedPerMin  // Bikes arranged in rows

    // Create bikes
    this.bikes = []
    for (let idx = 0; idx < nbikes; idx++) {
      const spawnMin = config.period * idx / nbikes
      let spawnQueue: SpawnQueue | undefined = undefined
      if (spawnMin >= 0 && spawnMin < config.penCloseMin) {
        // Bike arrives during pen window - flows immediately
        // No queue info needed
      } else {
        // Bike needs to queue
        const row = Math.floor(bikeQueueIdx / bikesPerRow)
        const col = bikeQueueIdx % bikesPerRow

        // Calculate when this bike will be released
        const transitingMin = currentReleaseMin + (bikeQueueIdx / config.bikesReleasedPerMin)

        spawnQueue = {
          offset: { x: col * 20, y: row * 15, },
          transitingMin,
        }

        bikeQueueIdx++
      }
      const bike = new Bike({ tunnel: this, laneId: 'R', idx, spawnMin, spawnQueue })
      this.bikes.push(bike)
    }

    for (const bike of this.bikes) {
      console.log("bike:", bike.spawnMin, config.penCloseMin)
      if (bike.spawnMin >= 0 && bike.spawnMin < config.penCloseMin) {
        // Bike arrives during pen window - flows immediately
        // No queue info needed
      } else {
        // Bike needs to queue
        const row = Math.floor(bikeQueueIdx / bikesPerRow)
        const col = bikeQueueIdx % bikesPerRow
        
        // Calculate when this bike will be released
        const transitingMin = currentReleaseMin + (bikeQueueIdx / config.bikesReleasedPerMin)
        
        bike.spawnQueue = {
          offset: { x: col * 20, y: row * 15, },
          transitingMin,
        }
        
        bikeQueueIdx++
      }
    }
  }

  public get allCars(): Car[] {
    return [ ...this.cars.l, ...this.cars.r ]
  }

  public get offset(): number {
    return this.config.offsetMin
  }

  // Convert absolute time to tunnel-relative time
  relMins(absMins: number): number {
    const { offsetMin, period } = this.config

    // Shift time so that our offset minute becomes "minute 0"
    const shiftedMins = absMins - offsetMin
    
    // Normalize to [0, period)
    let relMins = shiftedMins % period
    if (relMins < 0) relMins += period
    
    return relMins
  }

  // Get phase at relative time (0 = pen opens)
  getPhase(relMins: number): 'normal' | 'bikes-enter' | 'clearing' | 'sweep' | 'pace-car' {
    const minute = Math.floor(relMins)
    
    if (minute >= 0 && minute < this.config.penCloseMin) {
      return 'bikes-enter'
    } else if (minute >= this.config.penCloseMin && minute < 5) {
      return 'clearing'
    } else if (minute >= 5 && minute < 10) {
      return 'sweep'
    } else if (minute >= 10 && minute < 15) {
      return 'pace-car'
    } else {
      return 'normal'
    }
  }
}
