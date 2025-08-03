import { TimePoint } from "./TimeVal"
import { Tunnel } from "./Tunnel"
import { Pos } from "./types"
import { Points, Vehicle } from "./Vehicle"

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
  public currentTunnel?: Tunnel

  constructor({ eb, wb, mph, stagingOffset }: GlobalSweepProps) {
    super({
      tunnel: eb,
      laneId: 'R',
      idx: 0,
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

  get _points(): Points {
    const { eb, wb, transitingMins, } = this
    const { officialResetMins, sweepStartMin, } = eb.config
    const points: TimePoint<Pos>[] = []

    const westStaging = { x: wb.r.entrance.x + this.stagingOffset, y: wb.r.entrance.y }
    const eastStaging = { x: eb.r.entrance.x - this.stagingOffset, y: eb.r.entrance.y }

    const eTransitingMin = eb.offset + sweepStartMin
    points.push({ min: eTransitingMin - 1, val: { ...eastStaging, state: 'dequeueing', opacity: 1 } })
    points.push({ min: eTransitingMin, val: { ...eb.r.entrance, state: 'transiting', opacity: 1 } })
    const eExitingMin = eTransitingMin + transitingMins
    points.push({ min: eExitingMin, val: { ...eb.r.exit, state: 'exiting', opacity: 1 } })

    const wStageMin = eExitingMin + officialResetMins
    points.push({ min: wStageMin, val: { ...westStaging, state: 'origin', opacity: 1 } })
    const wTransitingMin = wb.offset + sweepStartMin
    points.push({ min: wTransitingMin - 1, val: { ...westStaging, state: 'dequeueing', opacity: 1 } })
    points.push({ min: wTransitingMin, val: { ...westStaging, state: 'transiting', opacity: 1 } })
    const wExitingMin = wTransitingMin + transitingMins
    points.push({ min: wExitingMin, val: { ...wb.r.exit, state: 'exiting', opacity: 1 } })
    const eStageMin = wExitingMin + officialResetMins
    points.push({ min: eStageMin, val: { ...eastStaging, state: 'origin', opacity: 1 } })

    return points
  }

  getPos(absMins: number): Pos {
    return this.pos.at(absMins)
  }
}
