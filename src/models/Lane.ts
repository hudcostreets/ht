import type { XY } from './XY.ts'

export type LaneId = 'L' | 'R'

export type Props = {
  id: LaneId
  entrance: XY
  exit: XY
}

export class Lane {
  public id: LaneId
  public entrance: XY
  public exit: XY

  constructor({ id, entrance, exit, }: Props) {
    this.id = id
    this.entrance = entrance
    this.exit = exit
  }
}
