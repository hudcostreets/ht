import {type TimePos, Tunnel} from "./Tunnel"
import {Lane, LaneId} from "./Lane"

export class Car {
  public tunnel: Tunnel
  public id: number
  public spawnMinute: number
  public laneId: LaneId
  public lane: Lane
  public timePositions: TimePos[] = []

  constructor(tunnel: Tunnel, id: number, spawnMinute: number, laneId: LaneId) {
    this.tunnel = tunnel
    this.id = id
    this.spawnMinute = spawnMinute
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    const lane = this.lane

    // Calculate the full trajectory for this car
    const { paceCarStartTime, offsetMinute, direction, laneWidthPx, laneHeightPx, lengthMiles, carSpeed, exitFadeDistance, } = tunnel.config

    // Calculate spawn relative time (handle negative values)
    let spawnReltime = this.spawnMinute - offsetMinute
    if (spawnReltime < 0) {
      spawnReltime += 60 // Wrap around hour
    }

    // Get phase at spawn time
    const phase = this.tunnel.getPhase(spawnReltime)

    // Determine if this car needs to queue
    const needsToQueue = this.laneId === 'R' && phase !== 'normal' && phase !== 'pace-car'

    let releaseRelTime: number
    let startX: number

    if (needsToQueue) {
      // Car queues during bike phases
      const queuePosition = Math.floor(spawnReltime)

      releaseRelTime = Math.max(spawnReltime, paceCarStartTime)
      startX = direction === 'east' ?
        -50 - (queuePosition * 30) : // Eastbound queue on left
        laneWidthPx + 50 + (queuePosition * 30) // Westbound queue on right
    } else {
      // Car flows normally
      releaseRelTime = spawnReltime
      startX = direction === 'east' ? 0 : laneWidthPx // Tunnel entrance
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = laneWidthPx
    const tunnelLengthMiles = lengthMiles
    const speedMph = carSpeed
    const transitTimeSeconds = (tunnelLengthMiles / speedMph) * 3600

    // Lane Y position based on direction
    const laneY = direction === 'east' ?
      (this.laneId === 'L' ? laneHeightPx / 2 : laneHeightPx + laneHeightPx / 2) : // Eastbound: L top, R bottom
      (this.laneId === 'R' ? laneHeightPx / 2 : laneHeightPx + laneHeightPx / 2)   // Westbound: R top, L bottom

    // Time for cars to move from queue to tunnel entrance (2 seconds)
    const queueToTunnelTransitionTime = 2

    if (needsToQueue) {
      // Car queues, then moves through tunnel
      this.timePositions = [
        // Queued position (from spawn until just before pace car)
        {
          time: spawnReltime,
          x: startX,
          y: laneY,
          state: 'pen',
          opacity: 1
        },
        // Start moving from queue to tunnel
        {
          time: releaseRelTime - queueToTunnelTransitionTime,
          x: startX,
          y: laneY,
          state: 'pen',
          opacity: 1
        },
        // Arrive at tunnel entrance
        {
          time: releaseRelTime,
          x: direction === 'east' ? 0 : tunnelWidthPixels,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelTime + transitTimeSeconds,
          x: direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelTime + transitTimeSeconds + 60,
          x: direction === 'east' ? tunnelWidthPixels + exitFadeDistance : -exitFadeDistance,
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
          time: releaseRelTime,
          ...lane.entrance,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelTime + transitTimeSeconds,
          x: direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelTime + transitTimeSeconds + 60, // 1 minute fade
          x: direction === 'east' ? tunnelWidthPixels + exitFadeDistance : -exitFadeDistance,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    }
  }

  getPos(abstime: number): { x: number, y: number, state: string, opacity: number } | null {
    const reltime = this.tunnel.reltime(abstime)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (reltime < first.time) {
      // Car hasn't spawned yet
      return null
    }

    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]

      if (reltime >= current.time && reltime < next.time) {
        // Interpolate between current and next
        const t = (reltime - current.time) / (next.time - current.time)

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
    if (reltime >= last.time) {
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
