import { LAYOUT } from "./Constants"
import { Lane, LaneId } from "./Lane"
import { TimePoint, TimeVal } from "./TimeVal"
import { field, Pos, PartialPos, SpawnQueue } from "./types"
import type { Tunnel, TunnelConfig } from "./Tunnel"

export type Points = TimePoint<Pos>[]
export type PartialPoints = TimePoint<PartialPos>[]

export type Props = {
  tunnel: Tunnel
  laneId: LaneId
  id: string
  spawnMin: number
  spawnQueue?: SpawnQueue
  points?: Points
}

export abstract class Vehicle {
  protected _pos?: TimeVal<Pos>
  public tunnel: Tunnel
  public laneId: LaneId
  public lane: Lane
  public id: string
  public spawnMin: number
  public spawnQueue?: SpawnQueue
  protected __points?: Points
  protected _normalized?: boolean
  protected _lastViewportWidth?: number

  constructor({ tunnel, laneId, id, spawnMin, spawnQueue, points, }: Props) {
    this.tunnel = tunnel
    this.id = id
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue

    // Normalize points immediately if provided
    if (points) {
      const { period } = tunnel.config
      this.__points = points.map(({ min, val }) => ({
        min: ((min % period) + period) % period,
        val
      }))
      // Sort to ensure ascending order
      this.__points.sort((a, b) => a.min - b.min)
      this._normalized = true
    }
  }

  points(): Points {
    // Check if viewport has changed (affects fade distance)
    const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    if (this._lastViewportWidth !== undefined && this._lastViewportWidth !== currentWidth) {
      // Viewport changed, invalidate cache
      this._pos = undefined
      this._normalized = false
      this.__points = undefined
    }
    this._lastViewportWidth = currentWidth

    // Return cached points if already normalized
    if (this._normalized && this.__points) {
      return this.__points
    }

    // Get raw points from _points getter
    let rawPoints = this._points
    if (!rawPoints.length) {
      throw new Error(`Vehicle ${this.laneId}${this.id} has no points defined`)
    }

    // Fill in missing values from previous point
    const filledPoints: Points = []
    let prevPos: Pos | undefined

    for (const point of rawPoints) {
      const filledVal: Pos = {
        x: point.val.x ?? prevPos?.x ?? 0,
        y: point.val.y ?? prevPos?.y ?? 0,
        state: point.val.state ?? prevPos?.state ?? 'origin',
        opacity: point.val.opacity ?? prevPos?.opacity ?? 0,
        direction: point.val.direction ?? prevPos?.direction
      }
      filledPoints.push({ min: point.min, val: filledVal })
      prevPos = filledVal
    }

    // Normalize all minute values to be within [0, period)
    const { period } = this
    this.__points = filledPoints.map(({ min, val }) => ({
      min: ((min % period) + period) % period,
      val
    }))

    // Sort by minute to ensure ascending order
    this.__points.sort((a, b) => a.min - b.min)

    // Deduplicate points with the same time (keep the last one)
    const dedupedPoints: Points = []
    for (let i = 0; i < this.__points.length; i++) {
      if (i === this.__points.length - 1 || this.__points[i].min !== this.__points[i + 1].min) {
        dedupedPoints.push(this.__points[i])
      }
    }
    this.__points = dedupedPoints
    this._normalized = true

    // Validate strictly ascending order
    for (let i = 1; i < this.__points.length; i++) {
      if (this.__points[i].min <= this.__points[i - 1].min) {
        throw new Error(`Vehicle ${this.laneId}${this.id} points must be strictly ascending by mins. Found: ${this.__points[i - 1].min} and ${this.__points[i].min}`)
      }
    }

    return this.__points
  }

  abstract get _points(): PartialPoints

  /**
   * Speed while "exiting" tunnel (and fading out)
   */
  abstract get exitingMph(): number

  get config(): TunnelConfig {
    return this.tunnel.config
  }

  get period(): number {
    return this.config.period
  }

  get exitPxPerMin(): number {
    const { lengthMi, laneWidthPx } = this.config
    return (this.exitingMph / lengthMi) * laneWidthPx / 60
  }

  get fadeDist(): number {
    return LAYOUT.FADE_DISTANCE_PX
  }

  get fadeMins(): number {
    // Calculate fade time based on fade distance and exit speed
    return this.fadeDist / this.exitPxPerMin
  }

  get pos(): TimeVal<Pos> {
    // Check if viewport has changed by calling points() first
    // This will trigger cache invalidation if needed
    const points = this.points()

    if (this._pos === undefined) {
      this._pos = new TimeVal(points, field, this.period)
    }
    return this._pos
  }

  getPos(absMins: number): Pos {
    const relMins = this.tunnel.relMins(absMins)

    // Offset by spawn time - car's minute 0 corresponds to its spawnMin in tunnel time
    // TimeVal expects time relative to the car's lifecycle, not tunnel time
    const vehTime = (relMins - this.spawnMin + this.period) % this.period

    // Use the pos getter which will check for viewport changes
    return this.pos.at(vehTime)
  }
}
