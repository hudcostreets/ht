
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
  public period?: number // Optional period for cyclic values

  constructor(
    points: TimePoint<T>[],
    field: Field<T>,
    period?: number
  ) {
    this.points = points
    this.field = field
    this.period = period
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
    const { points, period } = this
    
    // If periodic, normalize mins to be within [0, period)
    if (period !== undefined) {
      mins = mins % period
      if (mins < 0) mins += period
    }
    
    // Find the first point with min > mins
    let endIdx = points.findIndex(p => mins < p.min)
    
    if (endIdx < 0) {
      // mins is >= all points
      if (period !== undefined && points.length > 1) {
        // Wrap around: interpolate from last point to first point
        const start = points[points.length - 1]
        const end = { ...points[0], min: points[0].min + period }
        return this.interpolate(start, end, mins)
      } else {
        // Non-periodic: return last value
        return points[points.length - 1].val
      }
    }
    
    if (endIdx === 0) {
      // mins is before first point
      if (period !== undefined && points.length > 1) {
        // Wrap around: interpolate from last point to first point
        const start = { ...points[points.length - 1], min: points[points.length - 1].min - period }
        const end = points[0]
        return this.interpolate(start, end, mins)
      } else {
        // Non-periodic: return first value
        return points[0].val
      }
    }
    
    // Normal case: interpolate between adjacent points
    const start = points[endIdx - 1]
    const end = points[endIdx]
    return this.interpolate(start, end, mins)
  }
}
