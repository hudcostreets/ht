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
    const { spawnMin } = this
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

    if (spawnMin > 0) {
      points.push({ min: 0, val: origin })
    }

    // Start transiting (pace car enters from the left)
    points.push({
      min: spawnMin,
      val: { x: 0, y: this.lane.entrance.y, state: 'transiting', opacity: 1 }
    })

    // Reach end of tunnel
    const exitMin = spawnMin + transitMins
    points.push({
      min: exitMin,
      val: { x: laneWidthPx, y: this.lane.exit.y, state: 'exiting', opacity: 1 }
    })

    // For pace car, instead of fading, it transitions to the other tunnel
    // This will be handled by Tunnels class by updating the tunnel reference

    // Reset to origin at end of period
    if (exitMin + 1 < period) {
      points.push({ min: exitMin + 1, val: origin })
      points.push({ min: period - 1, val: origin })
    }

    return points
  }
}
