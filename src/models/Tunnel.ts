import { Bike } from "./Bike"
import { Car } from "./Car"
import { LAYOUT } from "./Constants"
import { Lane } from "./Lane"
import { Start, Interp, Num, TimePoint, TimeVal, Field } from "./TimeVal"
import { VehicleI } from "./Tunnels.ts"
import { Direction } from "./types"
import { XY, xy } from "./XY"
const { floor, } = Math

export type ColorZones = [number, number, number] | null

export type Pen = XY & {
  w: number
  h: number
  rows: number
  cols: number
}

export interface TunnelConfig {
  direction: Direction
  offsetMin: number
  lengthMi: number
  period: number
  carMph: number
  carExitingMph: number
  bikeUpMph: number
  bikeDownMph: number
  bikeExitingMph: number
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
  y: number  // Y offset for this tunnel in the visualization
  pen: Pen  // Relative to R Lane entrance
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
  public colorZones: TimeVal<ColorZones>
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
      penCloseMin,
      period,
    } = config
    this.dir = direction
    this.d = direction === 'east' ? 1 : -1
    this.nbikes = period * bikesPerMin
    const { nbikes, d } = this

    // Create lanes with absolute positions (including tunnel's y-offset)
    const start = direction === 'east' ? 0 : laneWidthPx
    const end = direction === 'east' ? laneWidthPx : 0
    // Lane positions include tunnel's y-offset for absolute positioning
    const lLaneY = laneHeightPx * (1 - d / 2) + config.y
    const rLaneY = laneHeightPx * (1 + d / 2) + config.y
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
      lcars.push(new Car({ tunnel: this, laneId: 'L', id: idx.toString(), spawnMin: period * (idx + .5) / ncars, })) // Stagger L cars by half a phase
      rcars.push(new Car({ tunnel: this, laneId: 'R', id: idx.toString(), spawnMin: period *  idx       / ncars, }))
    }

    // R lane cars arriving during blocked period (0 to paceStartMin) will merge to L lane
    // This is now handled in Car.ts based on spawn time
    // We no longer need to set spawnQueue for R lane cars

    // Calculate bike queueing
    let queueLen = 0
    let prvSpawnMin = 0
    if (penCloseMin * bikesReleasedPerMin < bikesPerMin * period) {
      throw new Error(`${penCloseMin}mins x ${bikesReleasedPerMin} bikes/min = ${penCloseMin * bikesReleasedPerMin} bikes/period, but ${period}mins x ${bikesPerMin} bikes/min = ${period * bikesPerMin} bikes`)
    }

    // Create bikes
    const bikes0 = []
    const bikes1 = []
    for (let idx = 0; idx < nbikes; idx++) {
      const spawnMin = period * idx / nbikes
      const bike = new Bike({ tunnel: this, laneId: 'R', id: idx.toString(), spawnMin })
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
    if (bikes1.length > 0) {
      const firstBikeMin = bikes1[0].spawnMin
      if (penCloseMin < firstBikeMin) {
        bikeQueueLenPts.push({ min: penCloseMin, val: 0, interp: Start })
      }
    } else if (penCloseMin > 0) {
      bikeQueueLenPts.push({ min: penCloseMin, val: 0, interp: Start })
    }
    bikes1.forEach(({ spawnMin }, idx) => {
      bikeQueueLenPts.push({ min: spawnMin, val: idx + 1, interp: Start })
    })
    // Ensure we have at least one point for TimeVal
    if (bikeQueueLenPts.length === 0) {
      bikeQueueLenPts.push({ min: 0, val: 0, interp: Start })
    }
    const bikeQueueLen = new TimeVal(bikeQueueLenPts, Num, period)
    const bikesPerRow = LAYOUT.BIKES_PER_ROW
    const bikes = [ ...bikes0, ...bikes1 ]
    for (const bike of bikes) {
      const { spawnMin } = bike
      const queueLen = bikeQueueLen.at(spawnMin)
      // console.log("bike:", spawnMin, penCloseMin)
      if (queueLen > 0) {
        // Bike needs to queue
        const idx = queueLen - 1
        // Use pen's configured rows/cols if available, otherwise fall back to default
        const penCols = config.pen.cols || bikesPerRow
        const penRows = config.pen.rows || Math.ceil(nbikes / penCols)
        let row = floor(idx / penCols)
        const col = idx % penCols

        // For W/b, fill from bottom up (nearest to tunnel entrance)
        if (direction === 'west') {
          row = penRows - 1 - row
        }

        const offset = { x: col * LAYOUT.BIKE_SPACING_X, y: row * LAYOUT.BIKE_SPACING_Y, }
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
      this.bikes.push(...split)
    }

    // Initialize color zones
    this.colorZones = this.initColorZones()
  }

  public get allCars(): Car[] {
    return [ ...this.cars.l, ...this.cars.r ]
  }

  public allVehicles(absMins: number): VehicleI[] {
    const { bikes, allCars, dir, } = this
    return [
      ...bikes.map(
        bike => {
          const { id, spawnMin, } = bike
          return ({
            id: `bike-${dir[0]}-${id}`,
            type: 'bike',
            pos: bike.getPos(absMins),
            dir,
            metadata: { spawnMin, id }
          }) as VehicleI
        }
      ),
      ...allCars.map(
        car => {
          const { laneId, id, spawnMin, } = car
          return ({
            id: `car-${dir[0]}-${laneId}-${id}`,
            type: 'car',
            pos: car.getPos(absMins),
            dir,
            metadata: { spawnMin, id, laneId }
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

  public getColorRectangles(absMins: number): Array<{
    color: 'green' | 'red'
    x: number
    width: number
    y: number
    height: number
  }> {
    const relMins = this.relMins(absMins)
    const zones = this.colorZones.at(relMins)

    if (!zones) return []

    const [greenStart, greenEnd, redEnd] = zones
    const rectangles = []

    // Green rectangle (bikes allowed)
    if (greenEnd > greenStart) {
      rectangles.push({
        color: 'green' as const,
        x: greenStart,
        width: greenEnd - greenStart,
        y: 0, // Relative to R lane
        height: this.config.laneHeightPx
      })
    }

    // Red rectangle (DMZ between bikes and cars)
    // Red can be either before green (pace behind sweep) or after green
    if (redEnd < greenStart) {
      // Red is before green (E/b: pace at entrance, sweep in tunnel)
      rectangles.push({
        color: 'red' as const,
        x: redEnd,
        width: greenStart - redEnd,
        y: 0, // Relative to R lane
        height: this.config.laneHeightPx
      })
    } else if (redEnd > greenEnd) {
      // Red is after green (W/b: sweep in tunnel, pace at entrance)
      rectangles.push({
        color: 'red' as const,
        x: greenEnd,
        width: redEnd - greenEnd,
        y: 0, // Relative to R lane
        height: this.config.laneHeightPx
      })
    }

    return rectangles
  }

  private initColorZones(): TimeVal<ColorZones> {
    const {
      period, laneWidthPx, lengthMi,
      carMph,
      sweepStartMin, paceStartMin,
      penCloseMin
    } = this.config
    const { d } = this

    // Calculate transit times
    const sweepTransitMins = 10  // From Sweep.ts: takes 10 mins to cross tunnel
    const paceTransitMins = 5    // From Pace.ts: takes 5 mins to cross tunnel
    const carTransitMins = (lengthMi / carMph) * 60

    // Calculate pixels per minute for each vehicle
    const sweepPxPerMin = laneWidthPx / sweepTransitMins
    const pacePxPerMin = laneWidthPx / paceTransitMins
    const carPxPerMin = laneWidthPx / carTransitMins

    // Direction-agnostic entrance position
    const entrance = d > 0 ? 0 : laneWidthPx

    // Helper to calculate position along tunnel
    const posAt = (minutesFromEntrance: number, pxPerMin: number): number => {
      const distance = minutesFromEntrance * pxPerMin
      return d > 0 ? entrance + distance : entrance - distance
    }

    const points: TimePoint<ColorZones>[] = []

    // Phase 1: Bike lane opens (0 to penCloseMin)
    // Green zone (bike lane) grows at car speed from entrance
    points.push({ min: 0, val: [entrance, entrance, entrance] })

    // Green grows at car speed until pen closes
    for (let min = 1; min <= penCloseMin; min++) {
      const greenEnd = posAt(min, carPxPerMin)
      if (d > 0) {
        // Eastbound: green grows from left
        points.push({ min, val: [0, greenEnd, greenEnd] })
      } else {
        // Westbound: green grows from right
        points.push({ min, val: [greenEnd, laneWidthPx, laneWidthPx] })
      }
    }

    // Continue green growth if needed (but stop before sweep phase)
    if (penCloseMin < carTransitMins && penCloseMin < sweepStartMin) {
      // Green continues to grow until sweep starts or it reaches exit
      const greenEndMin = Math.min(carTransitMins, sweepStartMin - 1)
      for (let min = penCloseMin + 1; min <= greenEndMin; min++) {
        const greenEnd = posAt(min, carPxPerMin)
        if (d > 0) {
          points.push({ min, val: [0, greenEnd, greenEnd] })
        } else {
          points.push({ min, val: [greenEnd, laneWidthPx, laneWidthPx] })
        }
      }
      // If green reached full tunnel before sweep
      if (greenEndMin >= carTransitMins) {
        if (d > 0) {
          points.push({ min: carTransitMins, val: [0, laneWidthPx, laneWidthPx] })
        } else {
          points.push({ min: carTransitMins, val: [0, laneWidthPx, laneWidthPx] })
        }
      }
    }

    // Phase 2: Sweep phase - green shrinks as sweep clears bikes
    // Red zone appears between entrance and sweep (DMZ)
    for (let min = 0; min <= sweepTransitMins; min++) {
      const relMin = sweepStartMin + min
      const sweepPos = posAt(min, sweepPxPerMin)

      if (d > 0) {
        // Eastbound: green = [sweepPos, exit], red = [entrance, sweepPos]
        // Red zone is from entrance (0) to sweepPos, so redEnd = 0
        points.push({ min: relMin, val: [sweepPos, laneWidthPx, 0] })
      } else {
        // Westbound: green = [entrance, sweepPos], red = [sweepPos, exit]
        // Red zone is from sweepPos to exit (800), so redEnd = 800
        points.push({ min: relMin, val: [0, sweepPos, laneWidthPx] })
      }
    }

    // Phase 3: Pace car phase - red zone now between pace and sweep
    // Handle overlap when both vehicles are in tunnel
    const paceEndMin = paceStartMin + paceTransitMins

    for (let relMin = paceStartMin; relMin <= paceEndMin; relMin++) {
      // Skip if we already have a point for this minute from sweep phase
      if (relMin <= sweepStartMin + sweepTransitMins) {
        const existingPoint = points.find(p => p.min === relMin)
        if (existingPoint) {
          // Update existing point with pace position
          const paceMin = relMin - paceStartMin
          const sweepMin = relMin - sweepStartMin
          const pacePos = posAt(paceMin, pacePxPerMin)
          const sweepPos = posAt(sweepMin, sweepPxPerMin)

          if (d > 0) {
            // Eastbound: green = [sweepPos, exit], red = [pacePos, sweepPos]
            // If pace just entered at entrance (0), red zone is [0, sweepPos]
            existingPoint.val = [sweepPos, laneWidthPx, pacePos < sweepPos ? pacePos : sweepPos]
          } else {
            // Westbound: green = [entrance, sweepPos], red = [sweepPos, pacePos]
            // If pace just entered at entrance (800), red zone is [sweepPos, 800]
            existingPoint.val = [0, sweepPos, pacePos > sweepPos ? pacePos : sweepPos]
          }
          continue
        }
      }

      // Pace car only (sweep has exited)
      const paceMin = relMin - paceStartMin
      const pacePos = posAt(paceMin, pacePxPerMin)

      if (d > 0) {
        // Eastbound: no green (bikes cleared), red = [pacePos, exit]
        points.push({ min: relMin, val: [laneWidthPx, laneWidthPx, pacePos] })
      } else {
        // Westbound: no green (bikes cleared), red = [entrance, pacePos]
        points.push({ min: relMin, val: [0, 0, pacePos] })
      }
    }

    // Clear zones after pace car exits
    const clearMin = paceStartMin + paceTransitMins + 1
    points.push({ min: clearMin, val: null })

    // Rest of period: no colored zones
    points.push({ min: period - 1, val: null })

    // Custom field for color zones with proper interpolation
    const ColorZonesField: Field<ColorZones> = {
      add: (l, r) => {
        if (!l || !r) return l || r
        return [l[0] + r[0], l[1] + r[1], l[2] + r[2]]
      },
      sub: (l, r) => {
        if (!l || !r) return l
        return [l[0] - r[0], l[1] - r[1], l[2] - r[2]]
      },
      mul: (l, s) => {
        if (!l) return null
        return [l[0] * s, l[1] * s, l[2] * s]
      },
    }
    return new TimeVal(points, ColorZonesField, period)
  }
}
