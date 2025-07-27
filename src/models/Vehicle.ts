import {TimePoint, TimeVal} from "./TimeVal.ts";
import {field, Pos, SpawnQueue, Tunnel, TunnelConfig} from "./Tunnel.ts";
import {Lane, LaneId} from "./Lane.ts";

export type Props = {
  tunnel: Tunnel
  laneId: LaneId
  idx: number
  spawnMin: number
  spawnQueue?: SpawnQueue
}

export abstract class Vehicle {
  protected _pos?: TimeVal<Pos>
  public tunnel: Tunnel
  public laneId: LaneId
  public lane: Lane
  public idx: number
  public spawnMin: number
  public spawnQueue?: SpawnQueue

  constructor({ tunnel, laneId, idx, spawnMin, spawnQueue }: Props) {
    this.tunnel = tunnel
    this.idx = idx
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue
  }

  abstract points(): TimePoint<Pos>[]

  abstract get fadeMph(): number

  get config(): TunnelConfig {
    return this.tunnel.config
  }

  get period(): number {
    return this.config.period;
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
    return this._pos;
  }

  getPos(absMins: number): Pos {
    const relMins = this.tunnel.relMins(absMins)

    // Offset by spawn time - car's minute 0 corresponds to its spawnMin in tunnel time
    // TimeVal expects time relative to the car's lifecycle, not tunnel time
    const vehTime = (relMins - this.spawnMin + this.period) % this.period

    return this.pos.at(vehTime)
  }
}
