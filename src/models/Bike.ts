import { Start, TimePoint } from "./TimeVal"
import { Pos } from "./types"
import { Vehicle } from "./Vehicle"
import { XY } from "./XY"

export class Bike extends Vehicle {
  get exitMph(): number {
    return this.config.bikeFlatMph
  }

  get transitingMin(): number {
    const { spawnQueue } = this
    if (spawnQueue) {
      return spawnQueue.minsBeforeDequeueing + spawnQueue.minsDequeueing
    }
    return 0
  }

  get initPos(): XY {
    const { lane, spawnQueue, config, tunnel } = this
    const { pen } = config
    const { d } = tunnel
    if (spawnQueue) {
      // Car needs to queue
      const { offset } = spawnQueue
      return {
        x: lane.entrance.x + (pen.x - offset.x) * d,
        y: lane.entrance.y + (pen.y - offset.y) * d,
      }
    } else {
      // No queueing
      return lane.entrance
    }
  }

  get origin(): XY {
    const { initPos, fadeDist, tunnel } = this
    const { d } = tunnel
    return {
      x: initPos.x - fadeDist * d,
      y: initPos.y,
    }
  }

  get pxPerMile(): number {
    const { laneWidthPx, lengthMi } = this.config
    return laneWidthPx / lengthMi
  }

  get downMph(): number {
    const { bikeDownMph } = this.config
    return bikeDownMph
  }

  get upMph(): number {
    const { bikeUpMph } = this.config
    return bikeUpMph
  }

  get halfWPx(): number {
    const { laneWidthPx } = this.config
    return laneWidthPx / 2
  }

  get downMins(): number {
    const { halfWPx, pxPerMile, downMph } = this
    return (halfWPx / pxPerMile) / downMph * 60
  }

  get upMins(): number {
    const { halfWPx, pxPerMile, upMph } = this
    return (halfWPx / pxPerMile) / upMph * 60
  }

  get halfway(): XY {
    const { tunnel, halfWPx } = this
    const { d } = tunnel
    return {
      x: tunnel.r.entrance.x + halfWPx * d,
      y: tunnel.r.entrance.y,
    }
  }

  get fadeDest(): XY {
    const { lane, fadeDist, tunnel } = this
    const { d } = tunnel
    return {
      x: lane.exit.x + fadeDist * d,
      y: lane.exit.y,
    }
  }

  get halfwayMin(): number {
    const { transitingMin, downMins } = this
    return transitingMin + downMins
  }

  get exitingMin(): number {
    const { halfwayMin, upMins } = this
    return halfwayMin + upMins
  }

  get fadedMin(): number {
    const { exitingMin, config } = this
    const { fadeMins } = config
    return exitingMin + fadeMins
  }

  get resetMin(): number {
    const { fadedMin } = this
    return fadedMin + 1
  }

  get respawnMin(): number {
    const { period } = this.config
    return period - 1 // Respawn at the end of the period
  }

  get downhill(): TimePoint<Pos> {
    const { lane, transitingMin } = this
    return { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1, }, }
  }

  get uphill(): TimePoint<Pos> {
    const { halfway, halfwayMin } = this
    return { min: halfwayMin, val: { ...halfway, state: 'transiting', opacity: 1 }, }
  }

  get exiting(): TimePoint<Pos> {
    const { lane, exitingMin } = this
    return { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 }, }
  }

  get faded(): TimePoint<Pos> {
    const { fadedMin, fadeDest } = this
    return { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 }, }
  }

  get reset(): TimePoint<Pos> {
    const { origin, resetMin } = this
    return { min: resetMin, val: { ...origin, state: 'origin', opacity: 0 }, }
  }

  get respawn(): TimePoint<Pos> {
    const { origin, respawnMin } = this
    return { min: respawnMin, val: { ...origin, state: 'origin', opacity: 0 }, }
  }

  get _points(): TimePoint<Pos>[] {
    // Calculate the full trajectory for this bike
    const { spawnQueue, initPos, downhill, uphill, exiting, faded, reset, respawn, } = this

    let points: TimePoint<Pos>[] = []
    if (spawnQueue) {
      // Car needs to queue
      const { minsBeforeDequeueing } = spawnQueue
      if (minsBeforeDequeueing > 0 ) {
        points.push({ min: 0, val: { ...initPos, state: 'queued', opacity: 1 }, })
        points.push({ min: minsBeforeDequeueing, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      } else {
        points.push({ min: 0, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      }
    }
    points = [
      ...points,
      downhill,
      uphill,
      exiting,
      faded,
      reset,
      respawn,
    ]
    points.sort((a, b) => a.min - b.min)
    return points
  }

  split(): [ Bike ] | [ Bike, Bike ] {
    let { spawnQueue, period, resetMin, idx, } = this
    if (resetMin < period) {
      return [this]
    }
    resetMin -= period
    const { minsBeforeDequeueing } = spawnQueue || {}
    if (minsBeforeDequeueing === undefined || resetMin >= minsBeforeDequeueing) {
      throw new Error(`Bike ${this.idx}: resetMin ${resetMin} >= ${minsBeforeDequeueing}`)
    }
    const splitAt = resetMin + 1
    const points = this.points()
    // console.log(`Bike ${idx}: splitting at ${splitAt} (resetMin: ${resetMin}, period: ${period})`, points)
    if (points.length !== 8) {
      throw new Error(`Bike ${this.idx}: Expected 8 points, got ${points.length}: ${JSON.stringify(points)}`)
    }
    const { downhill, uphill, exiting, faded, reset, respawn, } = this
    const [ queued, dequeueing, ] = points
    const bikePts1 = [
      { ...queued, interp: Start, },
      { ...reset, min: splitAt, },
      respawn
    ]
    const bikePts2 = [
      queued,
      ...[
        dequeueing,
        downhill,
        uphill,
        exiting,
        faded,
        reset,
      ].map(({ min, ...rest }) => ({ min: min - splitAt, ...rest }))
    ]
    const { laneId, spawnMin, tunnel, } = this
    const bike1 = new Bike({ tunnel, laneId, idx: idx + .1, spawnMin, points: bikePts1, })
    const bike2 = new Bike({ tunnel, laneId, idx: idx + .2, spawnMin: spawnMin + splitAt, points: bikePts2, })
    return [ bike1, bike2 ]
  }
}
