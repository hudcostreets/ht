import { TimePoint } from "./TimeVal"
import { Tunnel } from "./Tunnel"
import { Pos } from "./types"
import { Points, Vehicle } from "./Vehicle"

export type Props = {
  eb: Tunnel
  wb: Tunnel
  mph: number
  stagingOffset: number
}

export class Pace extends Vehicle {
  public eb: Tunnel
  public wb: Tunnel
  public mph: number
  public stagingOffset: number
  public currentTunnel?: Tunnel

  constructor({ eb, wb, mph, stagingOffset }: Props) {
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
    const { eb, wb, transitingMins, period, } = this
    const { officialResetMins, paceStartMin, } = eb.config
    let points: TimePoint<Pos>[] = []

    // Staging positions use the lane entrance coordinates (which now include y-offset)
    const westStaging = { x: wb.r.entrance.x + this.stagingOffset, y: wb.r.entrance.y }
    const eastStaging = { x: eb.r.entrance.x - this.stagingOffset, y: eb.r.entrance.y }

    const eTransitingMin = eb.offset + paceStartMin
    points.push({ min: eTransitingMin - 1, val: { ...eastStaging, state: 'dequeueing', opacity: 1 } })
    points.push({ min: eTransitingMin, val: { ...eb.r.entrance, state: 'transiting', opacity: 1 } })
    const eExitingMin = eTransitingMin + transitingMins
    points.push({ min: eExitingMin, val: { ...eb.r.exit, state: 'exiting', opacity: 1 } })
    const wStageMin = eExitingMin + officialResetMins
    points.push({ min: wStageMin, val: { ...westStaging, state: 'queued', opacity: 1 } })

    const wTransitingMin = wb.offset + paceStartMin
    points.push({ min: wTransitingMin - 1, val: { ...westStaging, state: 'dequeueing', opacity: 1 } })
    points.push({ min: wTransitingMin, val: { ...wb.r.entrance, state: 'transiting', opacity: 1 } })
    const wExitingMin = wTransitingMin + transitingMins
    points.push({ min: wExitingMin, val: { ...wb.r.exit, state: 'exiting', opacity: 1 } })
    const eStageMin = wExitingMin + officialResetMins
    points.push({ min: eStageMin, val: { ...eastStaging, state: 'queued', opacity: 1 } })

    points = points.map(({ min, val }) => ({ min: min % period, val }))
    points.sort((a, b) => a.min - b.min)
    return points
  }

  getPos(absMins: number): Pos {
    const pos = this.pos.at(absMins)

    // Update currentTunnel based on the schedule
    const relMins = absMins % this.period
    const { eb, wb } = this
    const eTransitingMin = eb.offset + eb.config.paceStartMin
    const wTransitingMin = wb.offset + wb.config.paceStartMin

    // Determine which tunnel pace is associated with
    if (relMins >= wTransitingMin && relMins <= wTransitingMin + this.transitingMins) {
      this.currentTunnel = wb
    } else if (relMins >= eTransitingMin || relMins < wTransitingMin) {
      this.currentTunnel = eb
    } else {
      // During transitions between tunnels (after west exit, before east entrance)
      this.currentTunnel = eb
    }

    return pos
  }
}
