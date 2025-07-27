import { Field } from "./TimeVal"

export type XY = {
  x: number
  y: number
}

export function xy(x: number | { x: number, y: number } | [number, number], y?: number): XY {
  if (typeof x === 'object' && ('x' in x)) {
    return { x: x.x, y: x.y }
  } else if (Array.isArray(x)) {
    return { x: x[0], y: x[1] }
  } else if (y === undefined) {
    throw new Error('Pos requires either an object with x and y, an array of two numbers, or two separate numbers')
  } else {
    return { x, y }
  }
}

export const field: Field<XY> = {
  add: (l: XY, r: XY): XY => ({ x: l.x + r.x, y: l.y + r.y }),
  sub: (l: XY, r: XY): XY => ({ x: l.x - r.x, y: l.y - r.y }),
  mul: (l: XY, r: number): XY => ({ x: l.x * r, y: l.y * r }),
}
