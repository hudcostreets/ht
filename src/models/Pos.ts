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

// export class Pos {
//   public x: number
//   public y: number
//
//   // Constructor should accept { x: number, y: number }, two numbers, or [ number, number ]
//   constructor(x: number | { x: number, y: number } | [number, number], y?: number) {
//     if (typeof x === 'object') {
//       this.x = x.x
//       this.y = x.y
//     } else if (Array.isArray(x)) {
//       this.x = x[0]
//       this.y = x[1]
//     } else {
//       this.x = x
//       this.y = y ?? 0
//     }
//   }
//
//   // Add a Pos to this one
//   add(other: Pos): Pos {
//     return new Pos(this.x + other.x, this.y + other.y);
//   }
//
//   addX(x: number): Pos {
//     return new Pos(this.x + x, this.y);
//   }
//
//   addY(y: number): Pos {
//     return new Pos(this.x, this.y + y);
//   }
// }
