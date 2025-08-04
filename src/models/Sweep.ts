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

  get exitMph(): number {
    return this.mph
  }

  get transitingMins(): number {
    const { eb, mph, } = this
    const { lengthMi, } = eb.config
    return (lengthMi / mph) * 60
  }

  get _points(): PartialPoints {
    const { eb, wb, transitingMins } = this
    const { officialResetMins, sweepStartMin, } = eb.config
    let points: PartialPoints = []

    // Staging positions use the lane entrance coordinates (which now include y-offset)
    const eastStaging = { x: eb.r.entrance.x - this.stagingOffset, y: eb.r.entrance.y }
    const westStaging = { x: wb.r.entrance.x + this.stagingOffset, y: wb.r.entrance.y }

    const eTransitingMin = eb.offset + sweepStartMin
    // Starting point - need all values
    points.push({ min: eTransitingMin - 1, val: { ...eastStaging, state: 'dequeueing', opacity: 1, direction: 'east' } })
    // Only change what's different
    points.push({ min: eTransitingMin, val: { x: eb.r.entrance.x, state: 'transiting' } })
    const eExitingMin = eTransitingMin + transitingMins
    points.push({ min: eExitingMin, val: { x: eb.r.exit.x, state: 'exiting' } })
    const wStageMin = eExitingMin + officialResetMins
    points.push({ min: wStageMin, val: { ...westStaging, state: 'queued', direction: 'west' } })

    const wTransitingMin = wb.offset + sweepStartMin
    points.push({ min: wTransitingMin - 1, val: { state: 'dequeueing' } })
    points.push({ min: wTransitingMin, val: { x: wb.r.entrance.x, state: 'transiting' } })
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
