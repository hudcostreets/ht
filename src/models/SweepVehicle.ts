import { TimePoint } from "./TimeVal"
import { Pos } from "./types"
import { Vehicle, Points, Props } from "./Vehicle"

export class SweepVehicle extends Vehicle {
  private sweepMph: number

  constructor(props: Props & { sweepMph: number }) {
    super(props)
    this.sweepMph = props.sweepMph
  }

  get fadeMph(): number {
    return this.sweepMph
  }

  get _points(): Points {
    const { laneWidthPx, period } = this.config
    const pxPerMin = this.pxPerMin

    // Calculate transit time based on speed
    const transitMins = laneWidthPx / pxPerMin

    // For sweep, we need to handle the one-way trip
    const points: TimePoint<Pos>[] = []

    // Origin state before spawning
    const _origin: Pos = {
      x: -this.fadeDist,
      y: this.lane.entrance.y,
      state: 'origin',
      opacity: 0
    }

    // Staging position (just outside tunnel)
    const _staging: Pos = {
      x: -35, // stagingOffset from config
      y: this.lane.entrance.y,
      state: 'origin',  // Use origin state for staging
      opacity: 1
    }

    // Vehicle starts directly at tunnel entrance (no staging in points)
    points.push({
      min: 0,
      val: { x: 0, y: this.lane.entrance.y, state: 'transiting', opacity: 1 }
    })

    // Reach end of tunnel after transitMins
    const exitMin = transitMins
    points.push({
      min: exitMin,
      val: { x: laneWidthPx, y: this.lane.exit.y, state: 'exiting', opacity: 1 }
    })

    // After exiting, move to staging position on the other side
    const exitStaging: Pos = {
      x: laneWidthPx + 35,
      y: this.lane.exit.y,
      state: 'origin',
      opacity: 1
    }

    if (exitMin + 1 < period) {
      points.push({ min: exitMin + 1, val: exitStaging })
      points.push({ min: period - 1, val: exitStaging })
    }

    return points
  }
}
