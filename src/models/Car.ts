import { Lane, LaneId } from "./Lane"
import {field, Pos, Tunnel} from "./Tunnel"
import { TimeVal } from "./TimeVal"

export type SpawnQueue = {
  offsetPx: number // Offset in px from the start of the tunnel
  minsBeforeDequeueStart: number // Minutes before dequeueing starts
}

export type Props = {
  tunnel: Tunnel
  laneId: LaneId
  spawnMin: number
  spawnQueue?: SpawnQueue
}

export class Car {
  public tunnel: Tunnel
  public laneId: LaneId
  public lane: Lane
  public id: number
  public spawnMin: number
  public spawnQueue?: SpawnQueue
  public pos: TimeVal<Pos>

  constructor({ tunnel, laneId, spawnMin, spawnQueue }: Props) {
    this.tunnel = tunnel
    this.id = spawnMin
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    const lane = this.lane
    const { d } = tunnel

    const { laneWidthPx, lengthMi, carMph, fadeDistance, period, } = tunnel.config
    const tunnelMins = (lengthMi / carMph) * 60 // Convert hours to minutes
    if (spawnQueue) {
      // Car needs to queue
      const { offsetPx, minsBeforeDequeueStart } = spawnQueue
      const queueX = lane.entrance.x - offsetPx * d
      const y = lane.entrance.y
      const origin = { x: queueX - fadeDistance * d, y }
      
      const pxPerMin = laneWidthPx / tunnelMins
      const transitingMin = minsBeforeDequeueStart + (offsetPx / pxPerMin)
      const exitingMin = transitingMin + tunnelMins
      
      this.pos = new TimeVal<Pos>(
        [
          { min: 0, val: { x: queueX, y, state: 'queued', opacity: 1 }, },
          { min: minsBeforeDequeueStart, val: { x: queueX, y, state: 'dequeueing', opacity: 1 }, },
          { min: transitingMin, val: { ...lane.entrance, state: 'transiting', opacity: 1 }, },
          { min: exitingMin, val: { ...lane.exit, state: 'exiting', opacity: 1 }, },
          { min: exitingMin + 1, val: { ...lane.dest, state: 'done', opacity: 0 }, },
          { min: exitingMin + 2, val: { ...origin, state: 'origin', opacity: 0 }, },
          { min: tunnel.config.period - 1, val: { ...origin, state: 'origin', opacity: 0 }, },
        ],
        field, period,
      )
    } else {
      // Car flows normally (no queueing)
      const x = lane.entrance.x
      const y = lane.entrance.y
      const origin = { x: x - fadeDistance * d, y }
      
      this.pos = new TimeVal<Pos>(
        [
          { min: 0, val: { ...lane.entrance, state: 'transiting', opacity: 1 }, },
          { min: tunnelMins, val: { ...lane.exit, state: 'exiting', opacity: 1 }, },
          { min: tunnelMins + 1, val: { ...lane.dest, state: 'done', opacity: 0 }, },
          { min: tunnelMins + 2, val: { ...origin, state: 'origin', opacity: 0 }, },
          { min: period - 1, val: { ...origin, state: 'origin', opacity: 0 }, },
        ],
        field, period,
      )
    }
  }

  getPos(absMins: number): Pos | null {
    const relMins = this.tunnel.relMins(absMins)
    
    // Offset by spawn time - car's minute 0 corresponds to its spawnMin in tunnel time
    // TimeVal expects time relative to the car's lifecycle, not tunnel time
    const carTime = (relMins - this.spawnMin + this.tunnel.config.period) % this.tunnel.config.period
    
    return this.pos.at(carTime)
  }

}
