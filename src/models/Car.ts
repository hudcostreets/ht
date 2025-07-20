import {type TimePosition, Tunnel} from "./Tunnel.ts";

export class Car {
  private tunnel: Tunnel
  private id: number
  private spawnMinute: number
  private lane: 'L' | 'R'
  private timePositions: TimePosition[] = []

  constructor(tunnel: Tunnel, id: number, spawnMinute: number, lane: 'L' | 'R') {
    this.tunnel = tunnel
    this.id = id
    this.spawnMinute = spawnMinute
    this.lane = lane
    this.calculateTimePositions()
  }

  private calculateTimePositions() {
    // Calculate the full trajectory for this car
    const config = this.tunnel.getConfig()

    // Calculate spawn relative time (handle negative values)
    let spawnRelativeMins = this.spawnMinute - config.offsetMinute
    if (spawnRelativeMins < 0) {
      spawnRelativeMins += 60 // Wrap around hour
    }
    const spawnRelativeTime = spawnRelativeMins * 60

    // Get phase at spawn time
    const phase = this.tunnel.getPhase(spawnRelativeTime)

    // Determine if this car needs to queue
    const needsToQueue = this.lane === 'R' && phase !== 'normal' && phase !== 'pace-car'

    let releaseRelTime: number
    let startX: number

    if (needsToQueue) {
      // Car queues during bike phases
      const queuePosition = Math.floor(spawnRelativeMins)
      const paceCarStartTime = 10 * 60 // Pace car phase starts at relative minute 10

      releaseRelTime = Math.max(spawnRelativeTime, paceCarStartTime)
      startX = config.direction === 'east' ?
        -50 - (queuePosition * 30) : // Eastbound queue on left
        config.lanePixelWidth + 50 + (queuePosition * 30) // Westbound queue on right
    } else {
      // Car flows normally
      releaseRelTime = spawnRelativeTime
      startX = config.direction === 'east' ? 0 : config.lanePixelWidth // Tunnel entrance
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = config.lanePixelWidth
    const tunnelLengthMiles = config.lengthMiles
    const speedMph = config.carSpeed
    const transitTimeSeconds = (tunnelLengthMiles / speedMph) * 3600

    // Lane Y position based on direction
    const laneY = config.direction === 'east' ?
      (this.lane === 'L' ? config.lanePixelHeight / 2 : config.lanePixelHeight + config.lanePixelHeight / 2) : // Eastbound: L top, R bottom
      (this.lane === 'R' ? config.lanePixelHeight / 2 : config.lanePixelHeight + config.lanePixelHeight / 2)   // Westbound: R top, L bottom

    // Time for cars to move from queue to tunnel entrance (2 seconds)
    const queueToTunnelTransitionTime = 2

    if (needsToQueue) {
      // Car queues, then moves through tunnel
      this.timePositions = [
        // Queued position (from spawn until just before pace car)
        {
          time: spawnRelativeTime,
          x: startX,
          y: laneY,
          state: 'queued',
          opacity: 1
        },
        // Start moving from queue to tunnel
        {
          time: releaseRelTime - queueToTunnelTransitionTime,
          x: startX,
          y: laneY,
          state: 'queued',
          opacity: 1
        },
        // Arrive at tunnel entrance
        {
          time: releaseRelTime,
          x: config.direction === 'east' ? 0 : tunnelWidthPixels,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelTime + transitTimeSeconds,
          x: config.direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelTime + transitTimeSeconds + 60,
          x: config.direction === 'east' ? tunnelWidthPixels + config.exitFadeDistance : -config.exitFadeDistance,
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
          x: startX,
          y: laneY,
          state: 'tunnel',
          opacity: 1
        },
        // End of tunnel
        {
          time: releaseRelTime + transitTimeSeconds,
          x: config.direction === 'east' ? tunnelWidthPixels : 0,
          y: laneY,
          state: 'exiting',
          opacity: 1
        },
        // Fully exited
        {
          time: releaseRelTime + transitTimeSeconds + 60, // 1 minute fade
          x: config.direction === 'east' ? tunnelWidthPixels + config.exitFadeDistance : -config.exitFadeDistance,
          y: laneY,
          state: 'exiting',
          opacity: 0
        }
      ]
    }
  }

  getPosition(absoluteTime: number): { x: number, y: number, state: string, opacity: number } | null {
    const relativeTime = this.tunnel.getRelativeTime(absoluteTime)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relativeTime < first.time) {
      // Car hasn't spawned yet
      return null
    }

    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]

      if (relativeTime >= current.time && relativeTime < next.time) {
        // Interpolate between current and next
        const t = (relativeTime - current.time) / (next.time - current.time)

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
    if (relativeTime >= last.time) {
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
    return this.lane
  }
}
