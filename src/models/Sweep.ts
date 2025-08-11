import { LAYOUT } from "./Constants"
import { Tunnel } from "./Tunnel"
import { Pos } from "./types"
import { PartialPoints, Vehicle } from "./Vehicle"

export type GlobalSweepProps = {
  eb: Tunnel
  wb: Tunnel
  mph: number
  stagingOffset: number
}

export class Sweep extends Vehicle {
  public eb: Tunnel
  public wb: Tunnel
  public mph: number
  public stagingOffset: number
  private _lastViewportWidth?: number

  constructor({ eb, wb, mph, stagingOffset }: GlobalSweepProps) {
    super({
      tunnel: eb,
      laneId: 'R',
      id: 'sweep',
      spawnMin: 0
    })
    this.eb = eb
    this.wb = wb
    this.mph = mph
    this.stagingOffset = stagingOffset
  }

  get exitingMph(): number {
    return this.mph
  }

  get transitingMins(): number {
    const { eb, mph, } = this
    const { lengthMi, } = eb.config
    return (lengthMi / mph) * 60
  }

  get _points(): PartialPoints {
    // Check if viewport changed and invalidate cache if needed
    const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    if (this._lastViewportWidth !== undefined && this._lastViewportWidth !== currentWidth) {
      // Viewport changed, invalidate cached points
      this._pos = undefined
      this._normalized = false
      this.__points = undefined
    }
    this._lastViewportWidth = currentWidth

    const { eb, wb, transitingMins } = this
    const { officialResetMins, sweepStartMin, } = eb.config
    let points: PartialPoints = []

    // Staging positions use the lane entrance coordinates (which now include y-offset)
    // Add vertical offset to keep vehicles out of the way of traffic
    const verticalOffset = LAYOUT.STAGING_VERTICAL_OFFSET
    // Use dynamic staging offset that responds to viewport
    const dynamicOffset = LAYOUT.SWEEP_STAGING_OFFSET
    const eastStaging = {
      x: eb.r.entrance.x - dynamicOffset,
      y: eb.r.entrance.y + verticalOffset  // Below E/b lane
    }
    const westStaging = {
      x: wb.r.entrance.x + dynamicOffset,
      y: wb.r.entrance.y - verticalOffset  // Above W/b lane
    }

    const eTransitingMin = eb.offset + sweepStartMin
    // Starting point - need all values
    points.push({ min: eTransitingMin - 1, val: { ...eastStaging, state: 'dequeueing', opacity: 1, direction: 'east' } })
    // Move to entrance position (both x and y)
    points.push({ min: eTransitingMin, val: { x: eb.r.entrance.x, y: eb.r.entrance.y, state: 'transiting' } })
    const eExitingMin = eTransitingMin + transitingMins
    points.push({ min: eExitingMin, val: { x: eb.r.exit.x, state: 'exiting' } })
    const wStageMin = eExitingMin + officialResetMins
    points.push({ min: wStageMin, val: { ...westStaging, state: 'queued', direction: 'west' } })

    const wTransitingMin = wb.offset + sweepStartMin
    points.push({ min: wTransitingMin - 1, val: { state: 'dequeueing' } })
    points.push({ min: wTransitingMin, val: { x: wb.r.entrance.x, y: wb.r.entrance.y, state: 'transiting' } })
    const wExitingMin = wTransitingMin + transitingMins
    points.push({ min: wExitingMin, val: { x: wb.r.exit.x, state: 'exiting' } })
    const eStageMin = wExitingMin + officialResetMins
    points.push({ min: eStageMin, val: { ...eastStaging, state: 'queued', direction: 'east' } })

    // No need to manually sort - normalizePoints in Vehicle will handle it
    return points
  }

  getPos(absMins: number): Pos {
    return this.pos.at(absMins)
  }
}
