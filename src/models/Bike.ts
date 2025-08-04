import { TimePoint } from "./TimeVal"
import { PartialPos } from "./types"
import { PartialPoints, Points, Vehicle } from "./Vehicle"
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

  get downhill(): TimePoint<PartialPos> {
    const { lane, transitingMin } = this
    return { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1, }, }
  }

  get uphill(): TimePoint<PartialPos> {
    const { halfway, halfwayMin } = this
    return { min: halfwayMin, val: { ...halfway, state: 'transiting', opacity: 1 }, }
  }

  get exiting(): TimePoint<PartialPos> {
    const { lane, exitingMin } = this
    return { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 }, }
  }

  get faded(): TimePoint<PartialPos> {
    const { fadedMin, fadeDest } = this
    return { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 }, }
  }

  get reset(): TimePoint<PartialPos> {
    const { origin, resetMin } = this
    return { min: resetMin, val: { ...origin, state: 'origin', opacity: 0 }, }
  }

  get respawn(): TimePoint<PartialPos> {
    const { origin, respawnMin } = this
    return { min: respawnMin, val: { ...origin, state: 'origin', opacity: 0 }, }
  }

  get _points(): PartialPoints {
    // If points were provided in constructor (split bike), return them as PartialPoints
    if (this.__points) {
      // Convert Points to PartialPoints
      return this.__points.map(({ min, val }) => ({ min, val: { ...val } }))
    }

    // Calculate the full trajectory for this bike
    const { spawnQueue, initPos, downhill, uphill, exiting, faded, reset, respawn, } = this

    let points: PartialPoints = []
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
    const { spawnQueue, period, resetMin, idx } = this

    // Only split if the bike's journey extends beyond the period
    if (resetMin < period) {
      return [this]
    }

    // Calculate how much into the next period the bike extends
    const overflowMin = resetMin - period
    const splitMin = overflowMin + 1

    // For bike that needs splitting, we create two bikes:
    // 1. A "stub" bike that exists at the end of the period
    // 2. The main bike that does the actual journey in the next period

    // Bike 1: Just sits at origin for the end of the period
    const bike1Points: Points = [
      { min: 0, val: { x: this.origin.x, y: this.origin.y, state: 'origin', opacity: 0 } },
      { min: period - 1, val: { x: this.origin.x, y: this.origin.y, state: 'origin', opacity: 0 } }
    ]

    // Bike 2: The actual journey
    // We need to build the points fresh without relying on this.points()
    // because that would normalize them
    const bike2Points: Points = []

    if (spawnQueue) {
      // Start queued
      bike2Points.push({
        min: 0,
        val: { ...this.initPos, state: 'queued', opacity: 1 }
      })

      // Adjust dequeueing time
      const adjustedDequeueing = spawnQueue.minsBeforeDequeueing - splitMin
      if (adjustedDequeueing > 0) {
        bike2Points.push({
          min: adjustedDequeueing,
          val: { ...this.initPos, state: 'dequeueing', opacity: 1 }
        })
      }
    }

    // Add the journey points, adjusting times by splitMin
    bike2Points.push({
      min: this.transitingMin - splitMin,
      val: { ...this.lane.entrance, state: 'transiting', opacity: 1 }
    })
    bike2Points.push({
      min: this.halfwayMin - splitMin,
      val: { ...this.halfway, state: 'transiting', opacity: 1 }
    })
    bike2Points.push({
      min: this.exitingMin - splitMin,
      val: { ...this.lane.exit, state: 'exiting', opacity: 1 }
    })
    const adjustedFadedMin = this.fadedMin - splitMin
    bike2Points.push({
      min: adjustedFadedMin,
      val: { ...this.fadeDest, state: 'done', opacity: 0 }
    })

    // Reset happens 1 minute after fading
    bike2Points.push({
      min: adjustedFadedMin + 1,
      val: { ...this.origin, state: 'origin', opacity: 0 }
    })

    // Add respawn point at end of period (accounting for spawnMin adjustment)
    const adjustedRespawnMin = (this.respawnMin - splitMin + period) % period
    bike2Points.push({
      min: adjustedRespawnMin,
      val: { ...this.origin, state: 'origin', opacity: 0 }
    })

    const { laneId, spawnMin, tunnel } = this
    const bike1 = new Bike({ tunnel, laneId, idx: idx + .1, spawnMin, points: bike1Points })
    const bike2 = new Bike({ tunnel, laneId, idx: idx + .2, spawnMin: spawnMin + splitMin, points: bike2Points })

    return [bike1, bike2]
  }
}
