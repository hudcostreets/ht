import type { Pos } from './Pos'

export type LaneId = 'L' | 'R'

export type Props = {
  id: LaneId
  entrance: Pos
  exit: Pos
  exitFadeDistance: number
}

export class Lane {
  public id: LaneId
  public entrance: Pos
  public exit: Pos
  public dest: Pos

  constructor({ id, entrance, exit, exitFadeDistance, }: Props) {
    this.id = id
    this.entrance = entrance
    this.exit = exit
    this.dest = {
      x: exit.x + exitFadeDistance,
      y: exit.y,
    }
  }
}
