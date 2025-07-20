import { Bike } from "./Bike"
import { Car } from "./Car"
import { Lane } from "./Lane"
import { pos } from "./Pos"

export type Direction = 'east' | 'west'

export interface TunnelConfig {
  direction: Direction
  offsetMinute: number
  lengthMiles: number
  carSpeed: number
  bikeUphillSpeed: number
  bikeDownhillSpeed: number
  penOpenMinutes: number
  bikesPerMinute: number
  carsPerMinute: number
  bikesReleasedPerMin: number
  paceCarStartTime: number

  // Layout
  laneWidthPx: number
  laneHeightPx: number
  penRelativeX: number   // Relative to R lane start
  penRelativeY: number   // Relative to R lane start
  penWidthPx: number
  penHeightPx: number
  exitFadeDistance: number  // Distance to travel while fading out after tunnel exit
}

// export type Phase = 'cars' | 'pen-open' | 'pen-closed' | 'sweep' | 'pace-car'

export type State = 'origin' | 'pen' | 'staging' | 'tunnel' | 'exiting' | 'done'

export interface TimePos {
  time: number
  x: number
  y: number
  state: State
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
  
  constructor(config: TunnelConfig) {
    this.config = config
    const { bikesPerMinute, carsPerMinute, laneWidthPx, laneHeightPx, direction } = config
    this.dir = direction
    this.d = direction === 'east' ? 1 : -1
    this.nbikes = 60 * bikesPerMinute

    // Create lanes
    const exitFadeDistance = config.exitFadeDistance * this.d
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
    this.ncars = 60 * carsPerMinute
    for (let i = 0; i < this.ncars; i++) {
      this.cars.push(new Car(this, 60 * (i + .5) / this.ncars, 'L'))
      this.cars.push(new Car(this, 60 * i / this.ncars, 'R'))
    }

    // const { penOpenMinutes } = config
    // const phases = [
    //   { start: 0, phase: 'bikes-enter' },
    //   { start: penOpenMinutes, phase: 'clearing' },
    //   { start: 5, phase: 'sweep' },
    //   { start: 10, phase: 'pace-car' },
    //   { start: 15, phase: 'cars' }
    // ]
  }
  
  // Convert absolute time to tunnel-relative time
  relMins(absMins: number): number {
    const relMins = absMins - Math.floor(absMins / 60) * 60
    
    // Shift time so that our offset minute becomes "minute 0"
    const shiftedMins = relMins - this.config.offsetMinute
    
    // Handle negative wrap-around (e.g. if we're at :10 and offset is :15)
    return (shiftedMins < 0) ? shiftedMins + 60 : shiftedMins
  }
  
  // Convert tunnel-relative time back to absolute
  absMins(relMins: number, hourBaseMins: number): number {
    const hourInMins = Math.floor(hourBaseMins / 60) * 60
    const absMins = hourInMins + relMins + this.config.offsetMinute
    
    // Handle overflow
    return (absMins >= hourInMins + 60) ? absMins - 60 : absMins
  }
  
  // Get phase at relative time (0 = pen opens)
  getPhase(relMins: number): 'normal' | 'bikes-enter' | 'clearing' | 'sweep' | 'pace-car' {
    const minute = Math.floor(relMins)
    
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
}
