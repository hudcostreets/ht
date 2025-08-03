import { TimePoint } from "./TimeVal"
import { Pos } from "./types"
import { Vehicle, Points, Props } from "./Vehicle"

export class PaceVehicle extends Vehicle {
  private paceMph: number

  constructor(props: Props & { paceMph: number }) {
    super(props)
    this.paceMph = props.paceMph
  }

  get fadeMph(): number {
    return this.paceMph
  }

  get _points(): Points {
    const { laneWidthPx, period } = this.config
    const pxPerMin = this.pxPerMin

    // Calculate transit time based on speed
    const transitMins = laneWidthPx / pxPerMin

    // For pace car, we need to handle the round trip without fading
    const points: TimePoint<Pos>[] = []

    // Origin state before spawning
    const origin: Pos = {
      x: -this.fadeDist,
      y: this.lane.entrance.y,
      state: 'origin',
      opacity: 0
    }

    // Start transiting directly at vehicle time 0
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

    // For pace car, instead of fading, it transitions to the other tunnel
    // This will be handled by Tunnels class by updating the tunnel reference

    // Reset to origin after exiting
    points.push({ min: exitMin + 1, val: origin })

    // Fill out the rest of the period
    if (exitMin + 1 < period) {
      points.push({ min: period - 1, val: origin })
    }

    return points
  }
}
