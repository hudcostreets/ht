import { Lane, LaneId } from "./Lane.ts"
import { TimePoint, TimeVal } from "./TimeVal.ts"
import { field, Pos, SpawnQueue, Tunnel, TunnelConfig } from "./Tunnel.ts"

export type Points = TimePoint<Pos>[]

export type Props = {
  tunnel: Tunnel
  laneId: LaneId
  idx: number
  spawnMin: number
  spawnQueue?: SpawnQueue
  points?: Points
}

export abstract class Vehicle {
  protected _pos?: TimeVal<Pos>
  public tunnel: Tunnel
  public laneId: LaneId
  public lane: Lane
  public idx: number
  public spawnMin: number
  public spawnQueue?: SpawnQueue
  protected __points?: Points

  constructor({ tunnel, laneId, idx, spawnMin, spawnQueue, points, }: Props) {
    this.tunnel = tunnel
    this.idx = idx
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue
    this.__points = points
  }

  points(): Points {
    if (this.__points === undefined) {
      this.__points = this._points
      if (!this.__points.length) {
        throw new Error(`Vehicle ${this.laneId}${this.idx} has no points defined`)
      }
      // Ensure points are sorted by `mins` strictly ascending
      for (let i = 1; i < this.__points.length; i++) {
        if (this.__points[i].min <= this.__points[i - 1].min) {
          throw new Error(`Vehicle ${this.laneId}${this.idx} points must be strictly ascending by mins. Found: ${this.__points[i - 1].min} and ${this.__points[i].min}`)
        }
      }
    }
    return this.__points
  }

  abstract get _points(): Points

  abstract get fadeMph(): number

  get config(): TunnelConfig {
    return this.tunnel.config
  }

  get period(): number {
    return this.config.period
  }

  get pxPerMin(): number {
    const { lengthMi, laneWidthPx } = this.config
    return (this.fadeMph / lengthMi) * laneWidthPx / 60
  }

  get fadeDist(): number {
    const { fadeMins } = this.config
    return this.pxPerMin * fadeMins
  }

  get pos(): TimeVal<Pos> {
    if (this._pos === undefined) {
      this._pos = new TimeVal(this.points(), field, this.period)
    }
    return this._pos
  }

  getPos(absMins: number): Pos {
    const relMins = this.tunnel.relMins(absMins)

    // Offset by spawn time - car's minute 0 corresponds to its spawnMin in tunnel time
    // TimeVal expects time relative to the car's lifecycle, not tunnel time
    const vehTime = (relMins - this.spawnMin + this.period) % this.period

    return this.pos.at(vehTime)
  }
}
