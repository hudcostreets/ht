import { Lane, LaneId } from "./Lane"
import { type TimePos as TimePos0, Tunnel } from "./Tunnel"

export type State = 'origin' | 'queued' | 'dequeueing' | 'transiting' | 'exiting' | 'done'
export type TimePos = TimePos0<State>

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
  public timePositions: TimePos[] = []

  constructor({ tunnel, laneId, spawnMin, spawnQueue }: Props) {
    this.tunnel = tunnel
    this.id = spawnMin
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue
    this.laneId = laneId
    this.lane = laneId === 'L' ? tunnel.l : tunnel.r
    const lane = this.lane
    const { d } = tunnel

    const { laneWidthPx, lengthMi, carMph, fadeDistance, } = tunnel.config
    const tunnelMins = lengthMi / carMph * 60
    const { offsetPx = 0, minsBeforeDequeueStart = 0 } = spawnQueue ?? {}
    const x = lane.entrance.x - offsetPx * d
    const y = lane.entrance.y
    const origin = { x: x - fadeDistance * d, y, }
    const queuePos: TimePos[] =
      minsBeforeDequeueStart
        ? [{ mins: 0, x, y, state: 'queued', opacity: 1, }]
        : []

    const dequeuePos: TimePos[] =
      offsetPx
        ? [{ mins: minsBeforeDequeueStart, x, y, state: 'dequeueing', opacity: 1, }]
        : []

    const pxPerMin = laneWidthPx / tunnelMins
    const transitingMin = offsetPx / pxPerMin
    const exitingMin = transitingMin + tunnelMins

    this.timePositions = [
      ...queuePos,
      ...dequeuePos,
      { mins: transitingMin    , ...lane.entrance, state: 'transiting', opacity: 1, },
      { mins:    exitingMin    , ...lane.exit    , state:    'exiting', opacity: 1, },
      { mins:    exitingMin + 1, ...lane.dest    , state:       'done', opacity: 0, },
      { mins:    exitingMin + 2, ...origin       , state:     'origin', opacity: 0, },
      { mins: tunnel.config.period - 1, ...origin       , state:     'origin', opacity: 0, },
    ]
  }

  getPos(absMins: number): { x: number, y: number, state: string, opacity: number } | null {
    const relMins = this.tunnel.relMins(absMins)

    if (this.timePositions.length === 0) return null

    // Check if we're before the first time position
    const first = this.timePositions[0]
    if (relMins < first.mins) {
      // Car hasn't spawned yet
      return null
    }

    // Find the appropriate time segment
    for (let i = 0; i < this.timePositions.length - 1; i++) {
      const current = this.timePositions[i]
      const next = this.timePositions[i + 1]

      if (relMins >= current.mins && relMins < next.mins) {
        // Interpolate between current and next
        const t = (relMins - current.mins) / (next.mins - current.mins)

        return {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
          state: current.state,
          opacity: current.opacity + (next.opacity - current.opacity) * t
        }
      }
    }

    // Check if we're past the last time position
    const last = this.timePositions[this.timePositions.length - 1]
    if (relMins >= last.mins) {
      if (last.opacity <= 0) return null // Fully faded out
      return { ...last }
    }

    return null
  }
}
