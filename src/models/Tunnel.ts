import { Bike } from "./Bike"
import { Car } from "./Car"
import { Lane } from "./Lane"
import { pos } from "./Pos"

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

// export type Phase = 'cars' | 'pen-open' | 'pen-closed' | 'sweep' | 'pace-car'

export interface TimePos<S extends String> {
  mins: number
  x: number
  y: number
  state: S
  opacity: number
}

export class Tunnel {
  public config: TunnelConfig
  public dir: Direction
  public d: number
  public bikes: Bike[] = []
  public nbikes: number
  public cars: Car[] = []
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
    this.nbikes = 60 * bikesPerMin

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
    for (let i = 0; i < this.nbikes; i++) {
      const spawn = 60 * i / this.nbikes
      this.bikes.push(new Bike(this, spawn, spawn))
    }

    // Create cars
    this.ncars = 60 * carsPerMin
    const rcars: Car[] = []
    for (let i = 0; i < this.ncars; i++) {
      this.cars.push(new Car({ tunnel: this, laneId: 'L', spawnMin: 60 * (i + .5) / this.ncars, }))
      const rcar = new Car({ tunnel: this, laneId: 'R', spawnMin: 60 * i / this.ncars, })
      rcars.push(rcar)
      this.cars.push(rcar)
    }

    // Compute nQueueCars{0,1} by iteratively dequeueing rcars, and enqueueing any that would have spawned during the time that took
    this.nQueueCars0 = 0
    this.nQueueCars1 = 0
    this.nQueueCars = 0
    const carPxPerMin = carMph * laneWidthPx / lengthMi * 60
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
    for (const rcar of rcars) {
      if (rcar.spawnMin < paceCarStartMin) {
        // Before pace car departs, all R lane cars queue
        rcar.spawnQueue = { offsetPx: 0, minsBeforeDequeueStart: 0 }
      } else {
        // After pace car departs, R lane cars dequeue immediately
        rcar.spawnQueue = { offsetPx: queuedCarWidthPx, minsBeforeDequeueStart: 0 }
      }
    }
  }

  public get offset(): number {
    return this.config.offsetMin
  }

  // Convert absolute time to tunnel-relative time
  relMins(absMins: number): number {
    const { offsetMin, period } = this.config

    // Shift time so that our offset minute becomes "minute 0"
    const shiftedMins = absMins - offsetMin
    
    // Handle negative wrap-around (e.g. if we're at :10 and offset is :15)
    return (shiftedMins < 0) ? shiftedMins + period : shiftedMins
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
