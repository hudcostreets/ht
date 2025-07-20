import { type TimePos as TimePos0, Tunnel } from "./Tunnel"

export type State = 'origin' | 'queue' | 'dequeueing' | 'tunnel' | 'exiting' | 'done'
export type TimePos = TimePos0<State>

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
    const { penCloseMin, offsetMin, laneWidthPx, bikesReleasedPerMin, lengthMi, bikeDownMph, bikeUpMph, penRelativeX, penRelativeY } = this.tunnel.config

    // Determine when this bike should be released from pen
    let releaseRelMins: number

    if (this.spawnMin < offsetMin) {
      // Early bike - released at pen opening (relative time 0)
      releaseRelMins = this.index / bikesReleasedPerMin
    } else if (this.spawnMin >= offsetMin && this.spawnMin < offsetMin + penCloseMin) {
      // Bike arrives during pen window - can join traveling group immediately
      releaseRelMins = this.spawnMin - offsetMin
    } else {
      // Late arrival - waits for next cycle (60 minutes later)
      const nextCycleStart = 60 // Next hour
      const lateArrivalOrder = Math.floor((this.spawnMin - (offsetMin + penCloseMin)) / 4)
      releaseRelMins = nextCycleStart + (lateArrivalOrder * 12)
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = laneWidthPx
    const pixelsPerMile = tunnelWidthPixels / lengthMi

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfwayPoint = tunnelWidthPixels / 2
    const downMins = (halfwayPoint / pixelsPerMile) / bikeDownMph * 60
    const upMins = (halfwayPoint / pixelsPerMile) / bikeUpMph * 60
    const totalTransitMins = downMins + upMins

    const penPos = {
      x: penRelativeX + (this.index % bikesReleasedPerMin) * 20,
      y: penRelativeY + Math.floor(this.index / bikesReleasedPerMin) * 15
    }
    const origin = {
      x: penPos.x - 100 * this.tunnel.d,
      y: penPos.y,
    }

    this.timePositions = [
      // Spawn in pen
      {
        mins: 0,
        ...penPos,
        state: 'queue',
        opacity: 1
      },
      // In pen before release
      {
        mins: releaseRelMins - 1,
        ...penPos,
        state: 'dequeueing',
        opacity: 1
      },
      // Arrive at tunnel entrance
      {
        mins: releaseRelMins,
        ...tunnel.r.entrance,
        state: 'tunnel',
        opacity: 1
      },
      {
        mins: releaseRelMins + totalTransitMins,
        ...tunnel.r.exit,
        state: 'exiting',
        opacity: 1
      },
      {
        mins: releaseRelMins + totalTransitMins + 1,
        ...tunnel.r.dest,
        state: 'done',
        opacity: 0
      },
      {
        mins: releaseRelMins + totalTransitMins + 2,
        ...origin,
        state: 'origin',
        opacity: 0
      },
      {
        mins: 59,
        ...origin,
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
    if (relMins < first.mins) {
      // For early bikes that haven't been released yet, check if they should be visible
      if (this.spawnMin < this.tunnel.config.offsetMin && relMins >= 0) {
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

      if (relMins >= current.mins && relMins < next.mins) {
        // Interpolate between current and next
        const t = (relMins - current.mins) / (next.mins - current.mins)

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
    if (relMins >= last.mins) {
      if (last.opacity <= 0) return null // Fully faded out
      return { ...last }
    }

    return null
  }
}
