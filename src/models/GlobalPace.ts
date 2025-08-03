import { TimePoint, TimeVal } from "./TimeVal"
import { Tunnel } from "./Tunnel"
import { Pos, field } from "./types"

export type GlobalPaceProps = {
  eastbound: Tunnel
  westbound: Tunnel
  paceMph: number
  stagingOffset: number
}

export class GlobalPace {
  private eastbound: Tunnel
  private westbound: Tunnel
  private paceMph: number
  private stagingOffset: number
  private _pos?: TimeVal<Pos>
  public currentTunnel?: Tunnel

  constructor({ eastbound, westbound, paceMph, stagingOffset }: GlobalPaceProps) {
    this.eastbound = eastbound
    this.westbound = westbound
    this.paceMph = paceMph
    this.stagingOffset = stagingOffset
  }

  get period(): number {
    return this.eastbound.config.period
  }

  get pxPerMin(): number {
    const { lengthMi, laneWidthPx } = this.eastbound.config
    return (this.paceMph / lengthMi) * laneWidthPx / 60
  }

  points(): TimePoint<Pos>[] {
    const { laneWidthPx } = this.eastbound.config
    const pxPerMin = this.pxPerMin
    const _transitMins = laneWidthPx / pxPerMin // 5 minutes at 24mph
    const points: TimePoint<Pos>[] = []

    // Pace schedule (leads cars after bikes):
    // Minute 0-24: Staging at east exit (from previous eastbound run)
    // Minute 25: Start westbound
    // Minute 25-30: Transit westbound (5 mins)
    // Minute 30-54: Staging at west exit
    // Minute 55: Start eastbound (leads cars after bikes)
    // Minute 55-60: Transit eastbound (5 mins)

    // Staging at east exit (minutes 0-24)
    points.push({
      min: 0,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 24,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Westbound leg (minutes 25-30)
    points.push({
      min: 25,
      val: { x: laneWidthPx, y: this.westbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 30,
      val: { x: 0, y: this.westbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    // Staging at west exit (minutes 31-54)
    points.push({
      min: 31,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 54,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Eastbound leg (minutes 55-60)
    points.push({
      min: 55,
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
    if (relMins >= 25 && relMins < 31) {
      this.currentTunnel = this.westbound
    } else if (relMins >= 55 || relMins < 25) {
      this.currentTunnel = this.eastbound
    }

    return pos
  }
}
