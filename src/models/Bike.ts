import {field, Pos, Tunnel} from "./Tunnel"
import {TimeVal} from "./TimeVal"

export class Bike {
  public tunnel: Tunnel
  public index: number
  public spawnMin: number
  public pos: TimeVal<Pos>

  constructor(tunnel: Tunnel, index: number, spawnMinute: number) {
    this.tunnel = tunnel
    this.index = index
    this.spawnMin = spawnMinute

    // Calculate the full trajectory for this bike
    const { penCloseMin, period, offsetMin, laneWidthPx, bikesReleasedPerMin, lengthMi, bikeDownMph, bikeUpMph, penRelativeX, penRelativeY } = this.tunnel.config

    // Determine when this bike should be released from pen
    let releaseRelMins: number

    if (this.spawnMin < offsetMin) {
      // Early bike - released at pen opening (relative time 0)
      releaseRelMins = this.index / bikesReleasedPerMin
    } else if (this.spawnMin >= offsetMin && this.spawnMin < offsetMin + penCloseMin) {
      // Bike arrives during pen window - can join traveling group immediately
      releaseRelMins = this.spawnMin - offsetMin
    } else {
      // Late arrival - waits for next cycle
      const lateArrivalOrder = Math.floor((this.spawnMin - (offsetMin + penCloseMin)) / 4)
      releaseRelMins = period + (lateArrivalOrder * 12)
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

    this.pos = new TimeVal(
      [
        { min: 0, val: { ...penPos, state: 'queued', opacity: 1, }, },
        { min: releaseRelMins - 1, val: { ...penPos, state: 'dequeueing', opacity: 1, }, },
        { min: releaseRelMins, val: { ...tunnel.r.entrance, state: 'transiting', opacity: 1, }, },
        { min: releaseRelMins + totalTransitMins, val: { ...tunnel.r.exit, state: 'exiting', opacity: 1, }, },
        { min: releaseRelMins + totalTransitMins + 1, val: { ...tunnel.r.dest, state: 'done', opacity: 0, }, },
        { min: releaseRelMins + totalTransitMins + 2, val: { ...origin, state: 'origin', opacity: 0, }, },
        { min: period - 1, val: { ...origin, state: 'origin', opacity: 0, }, },
      ],
      field, period,
    )
  }

  getPos(absMins: number): { x: number, y: number, state: string, opacity: number } {
    const relMins = this.tunnel.relMins(absMins)
    return this.pos.at(relMins)
  }
}
