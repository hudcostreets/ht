import { Bike } from "./Bike"
import { Car } from "./Car"
import { Lane } from "./Lane"
import { Start, Interp, Num, TimePoint, TimeVal } from "./TimeVal"
import { VehicleI } from "./Tunnels.ts"
import { Direction } from "./types"
import { XY, xy } from "./XY"
const { floor, max, } = Math

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
  sweepStartMin: number
  paceStartMin: number
  officialResetMins: number

  // Layout
  laneWidthPx: number
  laneHeightPx: number
  tunnelYOffset: number  // Y offset for this tunnel in the visualization
  penOffset: XY  // Relative to R Lane entrance
  penWidthPx: number
  penHeightPx: number
  fadeMins: number
  queuedCarWidthPx: number
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
    const {
      bikesPerMin, bikesReleasedPerMin,
      carsPerMin, carsReleasedPerMin,
      laneWidthPx, laneHeightPx,
      direction,
      paceStartMin, penCloseMin,
      queuedCarWidthPx,
      period,
    } = config
    this.dir = direction
    this.d = direction === 'east' ? 1 : -1
    this.nbikes = period * bikesPerMin
    const { nbikes, d } = this

    // Create lanes
    const start = direction === 'east' ? 0 : laneWidthPx
    const end = direction === 'east' ? laneWidthPx : 0
    const { tunnelYOffset } = config
    // Lane positions relative to tunnel model (0-based)
    const lLaneY = laneHeightPx * (1 - d * .5)
    const rLaneY = laneHeightPx * (1 + d * .5)
    this.l = new Lane({
      id: 'L',
      entrance: xy(start, lLaneY),
      exit: xy(end, lLaneY),
    })
    this.r = new Lane({
      id: 'R',
      entrance: xy(start, rLaneY),
      exit: xy(end, rLaneY),
    })

    if ((period - penCloseMin) * carsReleasedPerMin < carsPerMin * period) {
      throw new Error(`${period - penCloseMin}mins x ${carsReleasedPerMin} cars/min = ${(period - penCloseMin) * carsReleasedPerMin} cars/period, but ${period}mins x ${carsPerMin} cars/min = ${period * carsPerMin} cars`)
    }

    // Create cars
    const lcars: Car[] = []
    const rcars: Car[] = []
    this.cars = { l: lcars, r: rcars }
    this.ncars = period * carsPerMin
    const { ncars } = this
    for (let idx = 0; idx < ncars; idx++) {
      lcars.push(new Car({ tunnel: this, laneId: 'L', idx, spawnMin: period * (idx + .5) / ncars, })) // Stagger L cars by half a phase
      rcars.push(new Car({ tunnel: this, laneId: 'R', idx, spawnMin: period *  idx       / ncars, }))
    }

    // Populate rcars' spawnQueue elems
    // Instead of checking phase at spawn time, check if tunnel is blocked when car arrives
    let queueLen = 0
    let prvSpawnMin = 0
    // console.log(`${rcars.length} rcars`)
    for (const rcar of rcars) {
      // Tunnel is blocked from minute 0 (bikes enter) until pace car starts at minute 10
      const { spawnMin } = rcar
      const queueOpenMin = paceStartMin
      if (spawnMin > queueOpenMin) {
        const elapsed = spawnMin - max(queueOpenMin, prvSpawnMin)
        const carsElapsed = elapsed * carsReleasedPerMin
        queueLen = max(queueLen - carsElapsed, 0)
      }
      // Handle period wrapping - if car arrives in blocked period of this or next cycle
      if (spawnMin < queueOpenMin || queueLen > 0) {
        // Car needs to queue
        const minsBeforeDequeueing = max(queueOpenMin - spawnMin, 0)
        queueLen++
        const queueOffsetX = queueLen * queuedCarWidthPx
        const minsDequeueing = queueLen / carsReleasedPerMin
        rcar.spawnQueue = {
          offset: { x: queueOffsetX, y: 0 },
          minsBeforeDequeueing,
          minsDequeueing,
        }
      }
      // if (rcar.tunnel.dir === 'east') {
      //   console.log(`Car ${rcar.idx} (${spawnMin}):`, rcar.points(), `queueLen: ${queueLen}, queueOffsetX: ${rcar.spawnQueue?.offset?.x}, minsBeforeDequeueing: ${rcar.spawnQueue?.minsBeforeDequeueing}, minsDequeueing: ${rcar.spawnQueue?.minsDequeueing}`)
      // }
      prvSpawnMin = spawnMin
      // else: Car flows normally, leave spawnQueue undefined
    }

    // Calculate bike queueing
    if (penCloseMin * bikesReleasedPerMin < bikesPerMin * period) {
      throw new Error(`${penCloseMin}mins x ${bikesReleasedPerMin} bikes/min = ${penCloseMin * bikesReleasedPerMin} bikes/period, but ${period}mins x ${bikesPerMin} bikes/min = ${period * bikesPerMin} bikes`)
    }

    // Create bikes
    const bikes0 = []
    const bikes1 = []
    for (let idx = 0; idx < nbikes; idx++) {
      const spawnMin = period * idx / nbikes
      const bike = new Bike({ tunnel: this, laneId: 'R', idx, spawnMin })
      if (spawnMin >= penCloseMin) {
        bikes1.push(bike)
      } else {
        bikes0.push(bike)
      }
    }

    const interp: Interp<number> = ({ start, min }) => (start.val - (min - start.min) * bikesPerMin)
    queueLen = bikes1.length
    const bikeQueueLenPts: TimePoint<number>[] = []
    prvSpawnMin = 0
    for (const bike of bikes0) {
      const { spawnMin } = bike
      const elapsed = spawnMin - prvSpawnMin
      queueLen = queueLen - elapsed * bikesReleasedPerMin + 1
      if (queueLen <= 0) {
        // Queue is cleared. This bike doesn't need to queue, nor do the remainders from `bikes0` (that arrive while the pen is open)
        bikeQueueLenPts.push({ min: spawnMin, val: 0, interp })
        break
      } else {
        bikeQueueLenPts.push({ min: spawnMin, val: queueLen, interp })
      }
      prvSpawnMin = spawnMin
    }
    const firstBikeMin = bikes1[0].spawnMin
    if (penCloseMin < firstBikeMin) {
      bikeQueueLenPts.push({ min: penCloseMin, val: 0, interp: Start })
    }
    bikes1.forEach(({ spawnMin }, idx) => {
      bikeQueueLenPts.push({ min: spawnMin, val: idx + 1, interp: Start })
    })
    const bikeQueueLen = new TimeVal(bikeQueueLenPts, Num, period)
    const bikesPerRow = bikesReleasedPerMin
    const bikes = [ ...bikes0, ...bikes1 ]
    for (const bike of bikes) {
      const { spawnMin } = bike
      const queueLen = bikeQueueLen.at(spawnMin)
      // console.log("bike:", spawnMin, penCloseMin)
      if (queueLen > 0) {
        // Bike needs to queue
        const idx = queueLen - 1
        const row = floor(idx / bikesPerRow)
        const col = idx % bikesPerRow
        const offset = { x: col * 20, y: row * 15, }
        const minsBeforeDequeueing = spawnMin >= penCloseMin ? (period - spawnMin) : 0
        bike.spawnQueue = {
          offset,
          minsBeforeDequeueing,
          minsDequeueing: queueLen / bikesReleasedPerMin,
        }
      }
    }
    this.bikes = []
    for (const bike of bikes) {
      const split = bike.split()
      // for (const b of split) {
      //   const { idx, spawnQueue, spawnMin, } = b
      //   console.log(`bike ${idx} (${spawnMin}):`, b.points(), spawnQueue)
      // }
      this.bikes.push(...split)
    }
  }

  public get allCars(): Car[] {
    return [ ...this.cars.l, ...this.cars.r ]
  }

  public allVehicles(absMins: number): VehicleI[] {
    const { bikes, allCars, dir, } = this
    return [
      ...bikes.map(
        bike => {
          const { idx, spawnMin, } = bike
          return ({
            id: `bike-${dir[0]}-${idx}`,
            type: 'bike',
            pos: bike.getPos(absMins),
            dir,
            metadata: { spawnMin, idx }
          }) as VehicleI
        }
      ),
      ...allCars.map(
        car => {
          const { laneId, idx, spawnMin, } = car
          return ({
            id: `car-${dir[0]}-${laneId}-${idx}`,
            type: 'car',
            pos: car.getPos(absMins),
            dir,
            metadata: { spawnMin, idx, laneId }
          }) as VehicleI
        }
      ),
    ]
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
    const minute = floor(relMins)

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
