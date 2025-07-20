
export type TimePoint<T> = {
  min: number // Minutes from the start of the simulation
  val: T // The value at this time point
}

export type Field<T> = {
  add: (l: T, r: T) => T
  sub: (l: T, r: T) => T
  mul: (l: T, r: number) => T
}

export const Num: Field<number> = {
  add: (l, r) => l + r,
  sub: (l, r) => l - r,
  mul: (l, r) => l * r,
}

export type Interp<T> = (start: TimePoint<T>, end: TimePoint<T>, mins: number) => T

export class TimeVal<T> {
  public points: TimePoint<T>[]
  public field: Field<T>

  constructor(
    points: TimePoint<T>[],
    field: Field<T>,
  ) {
    this.points = points
    this.field = field
    if (!points.length) {
      throw new Error("TimeVal must have at least one point")
    }
    // Verify points are sorted by `mins` strictly ascending
    for (let i = 1; i < points.length; i++) {
      if (points[i].min <= points[i - 1].min) {
        throw new Error(`TimeVal points must be strictly ascending by mins. Found: ${points[i - 1].min} and ${points[i].min}`)
      }
    }
  }

  interpolate(
    start: TimePoint<T>,
    end: TimePoint<T>,
    mins: number,
  ): T {
    const { field: { add, sub, mul } } = this
    const totalMins = end.min - start.min
    if (totalMins <= 0) {
      throw new Error("End time must be greater than start time")
    }
    const ratio = (mins - start.min) / totalMins
    return add(
      start.val,
      mul(sub(end.val, start.val), ratio)
    )
  }

  // Get the value at a specific minute
  at(mins: number): T {
    const { points } = this
    let endIdx = points.findIndex(p => mins <= p.min)
    if (endIdx < 0) endIdx = 0
    const end = points[endIdx]
    if (end.min === mins) {
      return end.val
    }
    let startIdx = endIdx - 1
    if (startIdx < 0) startIdx = points.length - 1
    const start = points[startIdx]
    return this.interpolate(start, end, mins)
  }
}
