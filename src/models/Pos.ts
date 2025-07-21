import { Field } from "./TimeVal.ts"

export type Pos = {
  x: number
  y: number
}

export function pos(x: number | { x: number, y: number } | [number, number], y?: number): Pos {
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

export const field: Field<Pos> = {
  add: (l: Pos, r: Pos): Pos => ({ x: l.x + r.x, y: l.y + r.y }),
  sub: (l: Pos, r: Pos): Pos => ({ x: l.x - r.x, y: l.y - r.y }),
  mul: (l: Pos, r: number): Pos => ({ x: l.x * r, y: l.y * r }),
}
