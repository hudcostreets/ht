import { TimePoint, TimeVal } from "./TimeVal"
import { Tunnel } from "./Tunnel"
import { Pos, field } from "./types"

export type GlobalSweepProps = {
  eastbound: Tunnel
  westbound: Tunnel
  sweepMph: number
  stagingOffset: number
}

export class GlobalSweep {
  private eastbound: Tunnel
  private westbound: Tunnel
  private sweepMph: number
  private stagingOffset: number
  private _pos?: TimeVal<Pos>
  public currentTunnel?: Tunnel

  constructor({ eastbound, westbound, sweepMph, stagingOffset }: GlobalSweepProps) {
    this.eastbound = eastbound
    this.westbound = westbound
    this.sweepMph = sweepMph
    this.stagingOffset = stagingOffset
  }

  get period(): number {
    return this.eastbound.config.period
  }

  get pxPerMin(): number {
    const { lengthMi, laneWidthPx } = this.eastbound.config
    return (this.sweepMph / lengthMi) * laneWidthPx / 60
  }

  points(): TimePoint<Pos>[] {
    const { laneWidthPx } = this.eastbound.config
    const pxPerMin = this.pxPerMin
    const _transitMins = laneWidthPx / pxPerMin // 10 minutes at 12mph
    const points: TimePoint<Pos>[] = []

    // Sweep schedule (follows bikes):
    // Minute 0-19: Staging at east exit (from previous eastbound run)
    // Minute 20: Start westbound
    // Minute 20-30: Transit westbound (10 mins)
    // Minute 30-49: Staging at west exit
    // Minute 50: Start eastbound (following E/b bikes that entered at :45)
    // Minute 50-60: Transit eastbound (10 mins)

    // Staging at east exit (minutes 0-19)
    points.push({
      min: 0,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 19,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Westbound leg (minutes 20-30)
    points.push({
      min: 20,
      val: { x: laneWidthPx, y: this.westbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 30,
      val: { x: 0, y: this.westbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    // Staging at west exit (minutes 31-49)
    points.push({
      min: 31,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 49,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Eastbound leg (minutes 50-60)
    points.push({
      min: 50,
      val: { x: 0, y: this.eastbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 60,
      val: { x: laneWidthPx, y: this.eastbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    return points
  }

  get pos(): TimeVal<Pos> {
    if (this._pos === undefined) {
      this._pos = new TimeVal(this.points(), field, this.period)
    }
    return this._pos
  }

  getPos(absMins: number): Pos {
    const relMins = absMins % this.period
    const pos = this.pos.at(relMins)

    // Update current tunnel based on position
    if (relMins >= 20 && relMins < 31) {
      this.currentTunnel = this.westbound
    } else if (relMins >= 50 || relMins < 20) {
      this.currentTunnel = this.eastbound
    }

    return pos
  }
}
