import { Field } from "./TimeVal"
import { XY } from "./XY"

export type Direction = 'east' | 'west'

export type SpawnQueue = {
  offset: XY
  minsBeforeDequeueing: number // Minutes before dequeueing starts
  minsDequeueing: number
}

export type State = 'origin' | 'queued' | 'dequeueing' | 'transiting' | 'exiting' | 'done'

export type Pos = {
  x: number
  y: number
  state: State
  opacity: number
}

export const field: Field<Pos> = {
  add: (l: Pos, r: Pos): Pos => ({ x: l.x + r.x, y: l.y + r.y, state: l.state, opacity: l.opacity + r.opacity }),
  sub: (l: Pos, r: Pos): Pos => ({ x: l.x - r.x, y: l.y - r.y, state: l.state, opacity: l.opacity - r.opacity }),
  mul: (l: Pos, r: number): Pos => ({ x: l.x * r, y: l.y * r, state: l.state, opacity: l.opacity * r }),
}
