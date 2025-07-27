import { Pos } from "./Tunnel"
import { TimePoint } from "./TimeVal"
import { Vehicle } from "./Vehicle"
import { XY } from "./XY"

export class Bike extends Vehicle {
  get fadeMph(): number {
    return this.config.bikeFlatMph
  }

  points(): TimePoint<Pos>[] {
    // Calculate the full trajectory for this bike
    const { tunnel, config, spawnQueue, lane, fadeDist, } = this
    const { d } = tunnel
    const { period, laneWidthPx, lengthMi, bikeDownMph, bikeUpMph, fadeMins, } = config
    const pxPerMile = laneWidthPx / lengthMi

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfWPx = laneWidthPx / 2
    const halfway = { ...tunnel.r.entrance }
    halfway.x += halfWPx * d
    const downMins = (halfWPx / pxPerMile) / bikeDownMph * 60
    const upMins = (halfWPx / pxPerMile) / bikeUpMph * 60

    let transitingMin: number
    let initPos: XY
    let points: TimePoint<Pos>[] = []
    if (spawnQueue) {
      // Car needs to queue
      const { offset, minsBeforeDequeueing, minsDequeueing } = spawnQueue
      initPos = {
        x: lane.entrance.x - offset.x * d,
        y: lane.entrance.y - offset.y * d,
      }
      transitingMin = (minsBeforeDequeueing + minsDequeueing) % period
      if (minsBeforeDequeueing > 0 ) {
        points.push({ min: 0, val: { ...initPos, state: 'queued', opacity: 1 }, })
        points.push({ min: minsBeforeDequeueing, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      } else {
        points.push({ min: 0, val: { ...initPos, state: 'dequeueing', opacity: 1 }, })
      }
    } else {
      transitingMin = 0
      // Car flows normally (no queueing)
      initPos = lane.entrance
    }
    const origin = { ...initPos }
    initPos.x -= fadeDist * d
    const halfwayMin = (transitingMin + downMins) % period
    const exitingMin = (halfwayMin + upMins) % period
    const fadedMin = (exitingMin + fadeMins) % period
    const fadeDest = { x: lane.exit.x + fadeDist * d, y: lane.exit.y }
    points = [
      ...points,
      { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1 }, },
      { min: halfwayMin, val: { ...halfway, state: 'transiting', opacity: 1 }, },
      { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 }, },
      { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 }, },
      { min: fadedMin + 1, val: { ...origin, state: 'origin', opacity: 0 }, },
      { min: period - 1, val: { ...origin, state: 'origin', opacity: 0 }, },
    ]
    points.sort((a, b) => a.min - b.min)
    return points
  }
}
