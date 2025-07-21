import { Bike } from "./Bike"
import { Car } from "./Car"
import { Lane } from "./Lane"
import { pos } from "./Pos"
import {Field} from "./TimeVal.ts";

export type Direction = 'east' | 'west'

export interface TunnelConfig {
  direction: Direction
  offsetMin: number
  lengthMi: number
  period: number
  carMph: number
  bikeUpMph: number
  bikeDownMph: number
  penCloseMin: number
  bikesPerMin: number
  carsPerMin: number
  bikesReleasedPerMin: number
  paceCarStartMin: number

  // Layout
  laneWidthPx: number
  laneHeightPx: number
  penRelativeX: number   // Relative to R lane start
  penRelativeY: number   // Relative to R lane start
  penWidthPx: number
  penHeightPx: number
  fadeDistance: number  // Distance to travel while fading out after tunnel exit
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
  public nQueueCars0: number  // Number of cars that queue on spawn before pace car departs
  public nQueueCars1: number  // Number of cars that queue on spawn after pace car departs
  public nQueueCars: number   // Number of cars that queue on spawn (total, before and after pace car)
  
  constructor(config: TunnelConfig) {
    this.config = config
    const { bikesPerMin, carsPerMin, laneWidthPx, laneHeightPx, direction, paceCarStartMin, carMph, lengthMi, queuedCarWidthPx, } = config
    this.dir = direction
    this.d = direction === 'east' ? 1 : -1
    this.nbikes = config.period * bikesPerMin

    // Create lanes
    const exitFadeDistance = config.fadeDistance * this.d
    const start = direction === 'east' ? 0 : laneWidthPx
    const end = direction === 'east' ? laneWidthPx : 0
    this.l = new Lane({
      id: 'L',
      entrance: pos(start, laneHeightPx * (1 - this.d * .5)),
      exit: pos(end, laneHeightPx * (1 - this.d * .5)),
      exitFadeDistance,
    })
    this.r = new Lane({
      id: 'R',
      entrance: pos(start, laneHeightPx * (1 + this.d * .5)),
      exit: pos(end, laneHeightPx * (1 + this.d * .5)),
      exitFadeDistance,
    })

    // Create bikes
    this.bikes = []
    for (let i = 0; i < this.nbikes; i++) {
      const spawn = config.period * i / this.nbikes
      this.bikes.push(new Bike(this, i, spawn))
    }

    // Create cars
    const lcars: Car[] = []
    const rcars: Car[] = []
    this.cars = { l: lcars, r: rcars }
    this.ncars = config.period * carsPerMin
    for (let i = 0; i < this.ncars; i++) {
      lcars.push(new Car({ tunnel: this, laneId: 'L', spawnMin: config.period * (i + .5) / this.ncars, })) // Stagger L cars by half a phase
      rcars.push(new Car({ tunnel: this, laneId: 'R', spawnMin: config.period *  i       / this.ncars, }))
    }

    // Compute nQueueCars{0,1} by iteratively dequeueing rcars, and enqueueing any that would have spawned during the time that took
    this.nQueueCars0 = 0
    this.nQueueCars1 = 0
    this.nQueueCars = 0
    const carPxPerMin = carMph * laneWidthPx / lengthMi / 60 // Convert from mph to px/min
    let dequeueEndMin = paceCarStartMin
    let carIdx = 0
    let nQueueCars = 0
    let carQueueStartIdx = 0
    while (carIdx < rcars.length) {
      const rcar = rcars[carIdx]

      // If the car spawns before the dequeue end, it is queued
      if (rcar.spawnMin < dequeueEndMin) {
        // If this is the first car in the queue, set nQueueCars0
        if (carQueueStartIdx === 0) {
          this.nQueueCars0++
        } else {
          this.nQueueCars1++
        }
        nQueueCars++
        carIdx++
      } else {
        // If there are no cars to dequeue, just move to the next car
        if (nQueueCars === 0) {
          carIdx++
          continue
        }
        
        // Dequeue cars until we reach the next spawn time
        const queueEndPx = nQueueCars * queuedCarWidthPx
        dequeueEndMin += queueEndPx / carPxPerMin

        // Update nQueueCars and reset for next iteration
        this.nQueueCars += nQueueCars
        nQueueCars = 0
        carQueueStartIdx = carIdx
      }
    }

    // Populate rcars' spawnQueue elems
    // Instead of checking phase at spawn time, check if tunnel is blocked when car arrives
    let queueIdx = 0
    for (const rcar of rcars) {
      // Tunnel is blocked from minute 0 (bikes enter) until pace car starts at minute 10
      const tunnelBlockedStart = 0
      const tunnelBlockedEnd = paceCarStartMin
      
      // Check if this car would arrive during blocked period
      const arrivalMin = rcar.spawnMin
      
      // Handle period wrapping - if car arrives in blocked period of this or next cycle
      let needsQueue = false
      if (arrivalMin >= tunnelBlockedStart && arrivalMin < tunnelBlockedEnd) {
        needsQueue = true
      }
      
      if (needsQueue) {
        // Car needs to queue
        const queueOffset = queueIdx * queuedCarWidthPx
        const dequeueStartMin = tunnelBlockedEnd - arrivalMin
        rcar.spawnQueue = { 
          offsetPx: queueOffset, 
          minsBeforeDequeueStart: dequeueStartMin > 0 ? dequeueStartMin : 0 
        }
        queueIdx++
      }
      // else: Car flows normally, leave spawnQueue undefined
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
