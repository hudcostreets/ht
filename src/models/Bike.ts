import {type TimePosition, Tunnel} from "./Tunnel.ts";

export class Bike {
  private tunnel: Tunnel
  private index: number
  private spawnMinute: number
  private timePositions: TimePosition[] = []

  constructor(tunnel: Tunnel, index: number, spawnMinute: number) {
    this.tunnel = tunnel
    this.index = index
    this.spawnMinute = spawnMinute
    this.calculateTimePositions()
  }

  private calculateTimePositions() {
    // Calculate the full trajectory for this bike
    const config = this.tunnel.getConfig()

    // Determine when this bike should be released from pen
    let releaseRelativeTime: number

    if (this.spawnMinute < config.offsetMinute) {
      // Early bike - released at pen opening (relative time 0)
      releaseRelativeTime = this.index * 12 // 5 bikes per minute = 12 seconds apart
    } else if (this.spawnMinute >= config.offsetMinute && this.spawnMinute < config.offsetMinute + config.penOpenMinutes) {
      // Bike arrives during pen window - can join traveling group immediately
      const spawnRelativeTime = (this.spawnMinute - config.offsetMinute) * 60
      releaseRelativeTime = spawnRelativeTime
    } else {
      // Late arrival - waits for next cycle (60 minutes later)
      const nextCycleStart = 60 * 60 // Next hour
      const lateArrivalOrder = Math.floor((this.spawnMinute - (config.offsetMinute + config.penOpenMinutes)) / 4)
      releaseRelativeTime = nextCycleStart + (lateArrivalOrder * 12)
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = config.lanePixelWidth
    const tunnelLengthMiles = config.lengthMiles
    const pixelsPerMile = tunnelWidthPixels / tunnelLengthMiles

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfwayPoint = tunnelWidthPixels / 2
    const downhillTime = (halfwayPoint / pixelsPerMile) / config.bikeDownhillSpeed * 3600 // Convert to seconds
    const uphillTime = (halfwayPoint / pixelsPerMile) / config.bikeUphillSpeed * 3600
    const totalTransitTime = downhillTime + uphillTime

    // Time to move from pen to tunnel entrance (3 seconds)
    const penToTunnelTransitionTime = 3

    this.timePositions = [
      // In pen before release
      {
        time: releaseRelativeTime - 1,
        x: config.penRelativeX + (this.index % 5) * 20,
        y: config.penRelativeY + Math.floor(this.index / 5) * 15,
        state: 'pen',
        opacity: 1
      },
      // Moving from pen to tunnel
      {
        time: releaseRelativeTime,
        x: config.penRelativeX + (this.index % 5) * 20,
        y: config.penRelativeY + Math.floor(this.index / 5) * 15,
        state: 'staging',
        opacity: 1
      },
      // Arrive at tunnel entrance
      {
        time: releaseRelativeTime + penToTunnelTransitionTime,
        x: config.direction === 'east' ? 0 : tunnelWidthPixels, // Tunnel entrance
        y: config.direction === 'east' ? 
          config.lanePixelHeight + config.lanePixelHeight / 2 : // Eastbound R lane (bottom)
          config.lanePixelHeight / 2, // Westbound R lane (top)
        state: 'tunnel',
        opacity: 1
      },
      // End of tunnel
      {
        time: releaseRelativeTime + penToTunnelTransitionTime + totalTransitTime,
        x: config.direction === 'east' ? tunnelWidthPixels : 0,
        y: config.direction === 'east' ? 
          config.lanePixelHeight + config.lanePixelHeight / 2 : // Eastbound R lane (bottom)
          config.lanePixelHeight / 2, // Westbound R lane (top)
        state: 'exiting',
        opacity: 1
      },
      // Fully exited
      {
        time: releaseRelativeTime + penToTunnelTransitionTime + totalTransitTime + 60, // 1 minute fade
        x: config.direction === 'east' ? tunnelWidthPixels + config.exitFadeDistance : -config.exitFadeDistance,
        y: config.direction === 'east' ? 
          config.lanePixelHeight + config.lanePixelHeight / 2 : // Eastbound R lane (bottom)
          config.lanePixelHeight / 2, // Westbound R lane (top)
        state: 'exiting',
        opacity: 0
      }
    ]
  }

  getPosition(absoluteTime: number): { x: number, y: number, state: string, opacity: number } | null {
    const relativeTime = this.tunnel.getRelativeTime(absoluteTime)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relativeTime < first.time) {
      // For early bikes that haven't been released yet, check if they should be visible
      if (this.spawnMinute < this.tunnel.getConfig().offsetMinute && relativeTime >= 0) {
        // Early bike waiting in pen during pen open time
        return { ...first }
      }
      // Otherwise not visible yet
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

  getIndex(): number {
    return this.index
  }

  getSpawnMinute(): number {
    return this.spawnMinute
  }
}
