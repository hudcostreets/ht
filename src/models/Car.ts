import { Points, PartialPoints, Vehicle } from "./Vehicle"
import { XY } from "./XY"

export class Car extends Vehicle {
  get exitMph(): number {
    return this.mph
  }

  get mph(): number {
    return this.config.carMph
  }

  get transitingMins(): number {
    const { config, mph } = this
    const { lengthMi, } = config
    return (lengthMi / mph) * 60
  }

  get _points(): PartialPoints {
    const { tunnel, spawnQueue, lane, fadeDist, transitingMins, } = this
    const { d, config } = tunnel
    const { period, fadeMins, } = config
    let transitingMin: number
    let initPos: XY
    let points: Points = []
    if (spawnQueue) {
      // Car needs to queue
      const { offset, minsBeforeDequeueing, minsDequeueing } = spawnQueue
      initPos = {
        x: lane.entrance.x - offset.x * d,
        y: lane.entrance.y - offset.y * d,
      }
      transitingMin = minsBeforeDequeueing + minsDequeueing
      if (minsBeforeDequeueing > 0 ) {
        points.push({ min: 0, val: { ...initPos, state: 'queued', opacity: 1 }, })
        points.push({ min: minsBeforeDequeueing, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      } else {
        points.push({ min: 0, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      }
    } else {
      transitingMin = 0
      // Car flows normally (no queueing)
      initPos = { ...lane.entrance }
    }
    const origin = { ...initPos }
    origin.x -= fadeDist * d
    const exitingMin = transitingMin + transitingMins
    const fadedMin = exitingMin + fadeMins
    const fadeDest = { x: lane.exit.x + fadeDist * d, y: lane.exit.y }
    return [
      ...points,
      { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1 } },
      { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 } },
      { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 } },
      { min: fadedMin + 1, val: { ...origin, state: 'origin', opacity: 0 } },
      { min: period - 1, val: { ...origin, state: 'origin', opacity: 0 } },
    ] as PartialPoints
  }
}
