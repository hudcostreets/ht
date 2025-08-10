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

      // Set up positions for fade-in animation
      const queueOffsetPx = tunnel.config.queuedCarWidthPx  // 30 pixels back from entrance

      // Calculate fade-in at slower approach speed (12 mph instead of 24 mph)
      const approachMph = 12  // Half of normal speed for cautious approach
      const approachPxPerMin = tunnel.config.laneWidthPx / ((tunnel.config.lengthMi / approachMph) * 60)  // ~80 px/min
      const fadeInDistPx = fadeDist + queueOffsetPx  // 130 pixels total to travel
      const fadeInTimeCalc = fadeInDistPx / approachPxPerMin  // ~1.625 minutes at 12mph

      // Start position - same distance but will take longer to traverse
      const offScreenPos = {
        x: lane.entrance.x - fadeInDistPx * d,
        y: lane.entrance.y
      }

      // Queue position in R lane (where car pauses briefly)
      const rLaneQueuePos = {
        x: lane.entrance.x - queueOffsetPx * d,
        y: lane.entrance.y
      }

      // L lane entrance position
      const lLaneEntrance = {
        x: lane.entrance.x,
        y: lane.entrance.y - laneHeightPx * d  // L lane is one lane height away
      }

      // Merge timing: slot R cars between L cars
      // L cars spawn at 0.5, 1.5, 2.5... and immediately start transiting
      // R cars spawn at 0, 1, 2... and need to slot in between
      // For R car :0 to be between L :59.5 and L :0.5, it needs to enter when
      // those L cars are properly spaced in the tunnel

      const fadeInTime = fadeInTimeCalc  // ~1.625 minutes at 12mph for 130 pixels
      const pauseTime = 0.25   // Pause at queue position for 0.25 minutes
      const mergeTime = 0.3    // Time to complete the merge maneuver

      // L cars spawn every minute, so to be centered between them,
      // R car should enter L lane 1.0 minute after its spawn
      // (halfway between when the L cars entered)
      const desiredTransitStart = 1.0  // Enter 1 minute after spawn to be centered

      // Total approach time
      const totalApproachTime = fadeInTime + pauseTime + mergeTime  // ~2.175 minutes

      // We need to start the approach earlier
      const spawnOffset = totalApproachTime - desiredTransitStart  // ~1.175 minutes earlier

      transitingMin = desiredTransitStart  // When car actually enters L lane

      // Animation points for merging
      const arrivalMin = -spawnOffset  // Start fading in before spawn minute
      const fadeCompleteMin = arrivalMin + fadeInTime  // Arrives at queue position
      const pauseCompleteMin = fadeCompleteMin + pauseTime  // Finishes pausing
      const mergeCompleteMin = pauseCompleteMin + mergeTime  // Completes merge to L entrance

      points.push({ min: arrivalMin, val: { ...offScreenPos, state: 'origin', opacity: 0 } })
      points.push({ min: fadeCompleteMin, val: { ...rLaneQueuePos, state: 'queued', opacity: 1 } })
      points.push({ min: pauseCompleteMin, val: { ...rLaneQueuePos, state: 'queued', opacity: 1 } })  // Hold at queue pos
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

    } else if (laneId === 'R' && this.spawnMin === tunnel.config.paceStartMin) {
      // Special case: R car :10 arrives exactly when pace car starts
      // It should queue briefly behind the pace car
      const queueTime = 0.5  // Queue for half a minute behind pace car
      transitingMin = queueTime  // Start transiting after brief queue

      // Queue position (slightly back from entrance)
      const queueOffsetPx = tunnel.config.queuedCarWidthPx
      const queuePos = {
        x: lane.entrance.x - queueOffsetPx * d,
        y: lane.entrance.y
      }

      // Animation: fade in, queue briefly, then proceed through tunnel
      const origin = { x: queuePos.x - fadeDist * d, y: queuePos.y }
      const fadeInDuration = fadeDist / (tunnel.config.laneWidthPx / ((tunnel.config.lengthMi / tunnel.config.carMph) * 60))

      points.push({ min: -fadeInDuration, val: { ...origin, state: 'origin', opacity: 0 } })
      points.push({ min: 0, val: { ...queuePos, state: 'queued', opacity: 1 } })
      points.push({ min: queueTime, val: { ...lane.entrance, state: 'transiting', opacity: 1 } })

      // Continue with normal transit through tunnel
      const exitingMin = transitingMin + transitingMins
      const fadedMin = exitingMin + fadeMins
      const fadeDest = { x: lane.exit.x + fadeDist * d, y: lane.exit.y }

      points.push({ min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 } })
      points.push({ min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 } })
      points.push({ min: fadedMin + 1, val: { ...origin, state: 'origin', opacity: 0 } })
      points.push({ min: period - 1, val: { ...origin, state: 'origin', opacity: 0 } })

      // Return early since we've handled the full cycle
      return points as PartialPoints
    } else {
      // Car flows normally (no queueing needed)
      transitingMin = 0
      initPos = { ...lane.entrance }
    }

    if (!shouldMergeToL && points.length === 0) {
      const origin = { ...initPos || lane.entrance }
      origin.x -= fadeDist * d
      const exitingMin = transitingMin + transitingMins
      const fadedMin = exitingMin + fadeMins
      const fadeDest = { x: lane.exit.x + fadeDist * d, y: lane.exit.y }

      // Calculate proper fade-in time based on actual car speed
      const carPxPerMin = tunnel.config.laneWidthPx / ((tunnel.config.lengthMi / tunnel.config.carMph) * 60)
      const fadeInDuration = fadeDist / carPxPerMin  // Should be ~0.625 minutes
      const fadeStartMin = (period - fadeInDuration) % period  // Start fading in this much before spawn

      return [
        ...points,
        { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1 } },
        { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 } },
        { min: fadedMin, val: { ...fadeDest, state: 'done', opacity: 0 } },
        { min: fadedMin + 1, val: { ...origin, state: 'origin', opacity: 0 } },
        { min: fadeStartMin, val: { ...origin, state: 'origin', opacity: 0 } },  // Explicit fade start point
      ] as PartialPoints
    }

    return points as PartialPoints
  }
}
