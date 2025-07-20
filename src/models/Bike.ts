import { type TimePos, Tunnel } from "./Tunnel"

export class Bike {
  public tunnel: Tunnel
  public index: number
  public spawnMin: number
  public timePositions: TimePos[] = []

  constructor(tunnel: Tunnel, index: number, spawnMinute: number) {
    this.tunnel = tunnel
    this.index = index
    this.spawnMin = spawnMinute

    // Calculate the full trajectory for this bike
    const { penOpenMinutes, offsetMinute, laneWidthPx, bikesReleasedPerMin, lengthMiles, bikeDownhillSpeed, bikeUphillSpeed, penRelativeX, penRelativeY } = this.tunnel.config

    // Determine when this bike should be released from pen
    let releaseRelMins: number

    if (this.spawnMin < offsetMinute) {
      // Early bike - released at pen opening (relative time 0)
      releaseRelMins = this.index / bikesReleasedPerMin
    } else if (this.spawnMin >= offsetMinute && this.spawnMin < offsetMinute + penOpenMinutes) {
      // Bike arrives during pen window - can join traveling group immediately
      releaseRelMins = this.spawnMin - offsetMinute
    } else {
      // Late arrival - waits for next cycle (60 minutes later)
      const nextCycleStart = 60 // Next hour
      const lateArrivalOrder = Math.floor((this.spawnMin - (offsetMinute + penOpenMinutes)) / 4)
      releaseRelMins = nextCycleStart + (lateArrivalOrder * 12)
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = laneWidthPx
    const pixelsPerMile = tunnelWidthPixels / lengthMiles

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfwayPoint = tunnelWidthPixels / 2
    const downhillMins = (halfwayPoint / pixelsPerMile) / bikeDownhillSpeed * 60
    const uphillMins = (halfwayPoint / pixelsPerMile) / bikeUphillSpeed * 60
    const totalTransitMins = downhillMins + uphillMins

    const penPos = {
      x: penRelativeX + (this.index % bikesReleasedPerMin) * 20,
      y: penRelativeY + Math.floor(this.index / bikesReleasedPerMin) * 15
    }
    const originPos = {
      x: penPos.x + 100,
      y: penPos.y,
    }

    this.timePositions = [
      // Spawn in pen
      {
        time: 0,
        ...penPos,
        state: 'pen',
        opacity: 1
      },
      // In pen before release
      {
        time: releaseRelMins - 1,
        ...penPos,
        state: 'pen',
        opacity: 1
      },
      // Arrive at tunnel entrance
      {
        time: releaseRelMins,
        ...tunnel.r.entrance,
        state: 'tunnel',
        opacity: 1
      },
      {
        time: releaseRelMins + totalTransitMins,
        ...tunnel.r.exit,
        state: 'exiting',
        opacity: 1
      },
      {
        time: releaseRelMins + totalTransitMins + 1,
        ...tunnel.r.dest,
        state: 'done',
        opacity: 0
      },
      {
        time: releaseRelMins + totalTransitMins + 2,
        ...originPos,
        state: 'origin',
        opacity: 0
      },
      {
        time: 59,
        ...originPos,
        state: 'origin',
        opacity: 0
      },
    ]
  }

  getPos(absMins: number): { x: number, y: number, state: string, opacity: number } | null {
    const relMins = this.tunnel.relMins(absMins)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relMins < first.time) {
      // For early bikes that haven't been released yet, check if they should be visible
      if (this.spawnMin < this.tunnel.config.offsetMinute && relMins >= 0) {
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
}
