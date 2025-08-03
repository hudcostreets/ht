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

    // Sweep does a round trip:
    // Minute 0-4: Staging at west exit (from previous cycle)
    // Minute 5: Start eastbound from staging
    // Minute 5-15: Transit eastbound (10 mins)
    // Minute 15-20: Staging at east exit
    // Minute 20: Start westbound from staging
    // Minute 20-30: Transit westbound (10 mins)
    // Minute 30-35: Staging at west exit
    // Minute 35: Start eastbound from staging
    // Minute 35-45: Transit eastbound (10 mins)
    // Minute 45-50: Staging at east exit
    // Minute 50: Start westbound from staging
    // Minute 50-60: Transit westbound (10 mins)

    // Staging at west exit (minutes 0-4)
    points.push({
      min: 0,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 4,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // First eastbound leg (minutes 5-15)
    points.push({
      min: 5,
      val: { x: 0, y: this.eastbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 15,
      val: { x: laneWidthPx, y: this.eastbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    // Staging at east exit
    points.push({
      min: 16,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 19,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // First westbound leg (minutes 20-30)
    points.push({
      min: 20,
      val: { x: laneWidthPx, y: this.westbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 30,
      val: { x: 0, y: this.westbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    // Staging at west exit
    points.push({
      min: 31,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 34,
      val: { x: -this.stagingOffset, y: this.westbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Second eastbound leg (minutes 35-45)
    points.push({
      min: 35,
      val: { x: 0, y: this.eastbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 45,
      val: { x: laneWidthPx, y: this.eastbound.r.exit.y, state: 'exiting', opacity: 1 }
    })

    // Staging at east exit
    points.push({
      min: 46,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })
    points.push({
      min: 49,
      val: { x: laneWidthPx + this.stagingOffset, y: this.eastbound.r.exit.y, state: 'origin', opacity: 1 }
    })

    // Second westbound leg (minutes 50-60)
    points.push({
      min: 50,
      val: { x: laneWidthPx, y: this.westbound.r.entrance.y, state: 'transiting', opacity: 1 }
    })
    points.push({
      min: 60,
      val: { x: 0, y: this.westbound.r.exit.y, state: 'exiting', opacity: 1 }
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
    if (relMins >= 5 && relMins < 20) {
      this.currentTunnel = this.eastbound
    } else if (relMins >= 20 && relMins < 35) {
      this.currentTunnel = this.westbound
    } else if (relMins >= 35 && relMins < 50) {
      this.currentTunnel = this.eastbound
    } else if (relMins >= 50 || relMins < 5) {
      this.currentTunnel = this.westbound
    }

    return pos
  }
}
