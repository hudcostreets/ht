import { Points, PartialPoints, Vehicle } from "./Vehicle"
import { XY } from "./XY"

export class Car extends Vehicle {
  get exitingMph(): number {
    return this.config.carExitingMph
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
    const { tunnel, lane, fadeDist, fadeMins, transitingMins, laneId } = this
    const { d, config } = tunnel
    const { period, laneHeightPx } = config
    let transitingMin: number
    let initPos: XY
    let points: Points = []

    // Check if this is an R lane car that needs to merge to L lane
    // Only merge if car arrives during blocked period (before pace car starts)
    const shouldMergeToL = laneId === 'R' && this.spawnMin < tunnel.config.paceStartMin

    if (shouldMergeToL) {
      // R lane car during blocked period - merge to L lane immediately
      // (Don't wait for pace car since we're merging, not queueing)

      // Start position - off screen before the R lane entrance
      const offScreenPos = {
        x: lane.entrance.x - fadeDist * d,
        y: lane.entrance.y
      }

      // First queue position in R lane (where car stops briefly)
      const rLaneQueuePos = {
        x: lane.entrance.x - tunnel.config.queuedCarWidthPx * d,
        y: lane.entrance.y
      }

      // L lane entrance position
      const lLaneEntrance = {
        x: lane.entrance.x,
        y: lane.entrance.y - laneHeightPx * d  // L lane is one lane height away
      }

      // Merge timing: slot R cars between L cars
      // L cars spawn at 0.5, 1.5, 2.5... R cars spawn at 0, 1, 2...
      // R car needs to arrive at L entrance exactly 1.0 minute after spawn
      // to be centered between L cars (e.g., R:2 spawns at :47, arrives at :48)
      const fadeInTime = 0.2  // Time to fade in from off-screen
      const mergeTime = 0.5   // Time to complete the merge maneuver
      const targetTransitTime = 1.0  // When we want to start transiting (centered between L cars)
      const waitTime = targetTransitTime - fadeInTime - mergeTime  // 1.0 - 0.2 - 0.5 = 0.3

      transitingMin = targetTransitTime  // When car actually enters L lane and starts transiting

      // Animation points for merging - start from off-screen
      // Note: Car appears at its spawn minute, waits, then merges to L lane
      const arrivalMin = 0  // Car arrives at its spawn minute
      const fadeCompleteMin = arrivalMin + fadeInTime
      const waitCompleteMin = fadeCompleteMin + waitTime  // Wait to align with L car gap
      const mergeCompleteMin = waitCompleteMin + mergeTime  // Complete merge

      points.push({ min: arrivalMin, val: { ...offScreenPos, state: 'origin', opacity: 0 } })
      points.push({ min: fadeCompleteMin, val: { ...rLaneQueuePos, state: 'queued', opacity: 1 } })
      points.push({ min: waitCompleteMin, val: { ...rLaneQueuePos, state: 'queued', opacity: 1 } })  // Still queued while waiting
      points.push({ min: mergeCompleteMin, val: { ...lLaneEntrance, state: 'transiting', opacity: 1 } })

      // After merging, use L lane exit
      const lLaneExit = {
        x: tunnel.l.exit.x,
        y: tunnel.l.exit.y
      }

      const exitingMin = transitingMin + transitingMins
      const fadedMin = exitingMin + fadeMins
      const fadeDest = { x: lLaneExit.x + fadeDist * d, y: lLaneExit.y }

      return [
        ...points,
        { min: exitingMin, val: { ...lLaneExit, state: 'exiting', opacity: 1 } },
        { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 } },
        { min: fadedMin + 1, val: { ...offScreenPos, state: 'origin', opacity: 0 } },
        { min: period - 1, val: { ...offScreenPos, state: 'origin', opacity: 0 } },
      ] as PartialPoints

    } else {
      // Car flows normally (no queueing needed)
      transitingMin = 0
      initPos = { ...lane.entrance }
    }

    if (!shouldMergeToL) {
      const origin = { ...initPos || lane.entrance }
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

    return points as PartialPoints
  }
}
