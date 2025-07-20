import { Lane, LaneId } from "./Lane"
import { type TimePos, Tunnel } from "./Tunnel"

export class Car {
  public tunnel: Tunnel
  public id: number
  public spawnMinute: number
  public laneId: LaneId
  public lane: Lane
  public timePositions: TimePos[] = []

  constructor(tunnel: Tunnel, spawnMin: number, laneId: LaneId) {
    this.tunnel = tunnel
    this.id = spawnMin
    this.spawnMinute = spawnMin
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    const lane = this.lane

    // Calculate the full trajectory for this car
    const { paceCarStartTime, offsetMinute, direction, laneWidthPx, laneHeightPx, lengthMiles, carSpeed, exitFadeDistance, } = tunnel.config

    // Calculate spawn relative time (handle negative values)
    let spawnRelMins = this.spawnMinute - offsetMinute
    if (spawnRelMins < 0) {
      spawnRelMins += 60 // Wrap around hour
    }

    // Get phase at spawn time
    const phase = this.tunnel.getPhase(spawnRelMins)

    // Determine if this car needs to queue
    const needsToQueue = this.laneId === 'R' && phase !== 'normal' && phase !== 'pace-car'

    let releaseRelMins: number
    let startX: number

    if (needsToQueue) {
      // Car queues during bike phases
      const queuePosition = Math.floor(spawnRelMins)

      releaseRelMins = Math.max(spawnRelMins, paceCarStartTime)
      startX = direction === 'east' ?
        -50 - (queuePosition * 30) : // Eastbound queue on left
        laneWidthPx + 50 + (queuePosition * 30) // Westbound queue on right
    } else {
      // Car flows normally
      releaseRelMins = spawnRelMins
      startX = direction === 'east' ? 0 : laneWidthPx // Tunnel entrance
    }

    // Calculate tunnel transit time in minutes
    const transitMins = lengthMiles / carSpeed * 60

    // Lane Y position based on direction
    const laneY = direction === 'east' ?
      (this.laneId === 'L' ? laneHeightPx / 2 : laneHeightPx + laneHeightPx / 2) : // Eastbound: L top, R bottom
      (this.laneId === 'R' ? laneHeightPx / 2 : laneHeightPx + laneHeightPx / 2)   // Westbound: R top, L bottom

    // Time for cars to move from queue to tunnel entrance
    const queueToTunnelTransitionMins = 2/60

    if (needsToQueue) {
      // Car queues, then moves through tunnel
      this.timePositions = [
        // Queued position (from spawn until just before pace car)
        {
          time: spawnRelMins,
          x: startX,
          y: laneY,
          state: 'pen',
          opacity: 1
        },
        // Start moving from queue to tunnel
        {
          time: releaseRelMins - queueToTunnelTransitionMins,
          x: startX,
          y: laneY,
          state: 'pen',
          opacity: 1
        },
        // Arrive at tunnel entrance
        {
          time: releaseRelMins,
          x: direction === 'east' ? 0 : laneWidthPx,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelMins + transitMins,
          x: direction === 'east' ? laneWidthPx : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelMins + transitMins + 1,
          x: direction === 'east' ? laneWidthPx + exitFadeDistance : -exitFadeDistance,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    } else {
      // Car flows normally
      this.timePositions = [
        // Start position
        {
          time: releaseRelMins,
          ...lane.entrance,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelMins + transitMins,
          x: direction === 'east' ? laneWidthPx : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelMins + transitMins + 1,
          x: direction === 'east' ? laneWidthPx + exitFadeDistance : -exitFadeDistance,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    }
  }

  getPos(absMins: number): { x: number, y: number, state: string, opacity: number } | null {
    const relMins = this.tunnel.relMins(absMins)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relMins < first.time) {
      // Car hasn't spawned yet
      return null
    }

    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]

      if (relMins >= current.time && relMins < next.time) {
        // Interpolate between current and next
        const t = (relMins - current.time) / (next.time - current.time)

        return {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
          state: current.state,
          opacity: current.opacity + (next.opacity - current.opacity) * t
        }
      }
    }

    // Check if we're past the last time position
    const last = this.timePositions[this.timePositions.length - 1]
    if (relMins >= last.time) {
      if (last.opacity <= 0) return null // Fully faded out
      return { ...last }
    }

    return null
  }

  getId(): number {
    return this.id
  }

  getSpawnMinute(): number {
    return this.spawnMinute
  }

  getLane(): 'L' | 'R' {
    return this.laneId
  }
}
