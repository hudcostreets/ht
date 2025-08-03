import { TimeVal, TimePoint, Num } from './TimeVal'
import { Direction } from "./types"
import type { Tunnels } from './Tunnels'

export interface ColorRectangle {
  direction: Direction
  color: 'green' | 'red'
  x: number
  width: number
  y: number
  height: number
}

export class ColorRectangles {
  // East green marker position (0 to laneWidth during bike phases)
  private eastGreenEnd: TimeVal<number>
  // West green marker position (laneWidth to 0 during bike phases)
  private westGreenStart: TimeVal<number>

  private laneWidth: number
  private laneHeight: number

  constructor(tunnels: Tunnels) {
    const { eb: e } = tunnels
    const { laneWidthPx, laneHeightPx, period } = e.config
    this.laneWidth = laneWidthPx
    this.laneHeight = laneHeightPx

    // East green rectangle grows from 0 to full width during bike phases
    // It represents the area where bikes are allowed
    const eastGreenPoints: TimePoint<number>[] = [
      // Before bikes enter, no green
      { min: 0, val: 0 },
      { min: 44, val: 0 },
      // During bikes-enter (45-47), green grows
      { min: 45, val: 0 },
      { min: 48, val: laneWidthPx },
      // During clearing and sweep, green covers full tunnel
      { min: 50, val: laneWidthPx },
      { min: 55, val: laneWidthPx },
      // Reset for pace car
      { min: 56, val: 0 },
      { min: period - 1, val: 0 },
    ]

    // West green rectangle shrinks from full width to 0 during bike phases
    const westGreenPoints: TimePoint<number>[] = [
      // Before bikes enter, no green
      { min: 0, val: laneWidthPx },
      { min: 14, val: laneWidthPx },
      // During bikes-enter (15-17), green shrinks
      { min: 15, val: laneWidthPx },
      { min: 18, val: 0 },
      // During clearing and sweep, green covers full tunnel
      { min: 20, val: 0 },
      { min: 25, val: 0 },
      // Reset for pace car
      { min: 26, val: laneWidthPx },
      { min: period - 1, val: laneWidthPx },
    ]

    this.eastGreenEnd = new TimeVal(eastGreenPoints, Num, period)
    this.westGreenStart = new TimeVal(westGreenPoints, Num, period)
  }

  getRectangles(relMins: number): ColorRectangle[] {
    const rectangles: ColorRectangle[] = []

    // Eastbound rectangles
    const eastGreenEndX = this.eastGreenEnd.at(relMins)
    if (eastGreenEndX > 0) {
      // Green rectangle (bikes allowed)
      rectangles.push({
        direction: 'east',
        color: 'green',
        x: 0,
        width: eastGreenEndX,
        y: this.laneHeight, // R lane for eastbound (bottom)
        height: this.laneHeight
      })

      // Red rectangle (bikes not allowed yet)
      if (eastGreenEndX < this.laneWidth) {
        rectangles.push({
          direction: 'east',
          color: 'red',
          x: eastGreenEndX,
          width: this.laneWidth - eastGreenEndX,
          y: this.laneHeight, // R lane for eastbound (bottom)
          height: this.laneHeight
        })
      }
    }

    // Westbound rectangles
    const westGreenStartX = this.westGreenStart.at(relMins)
    if (westGreenStartX < this.laneWidth) {
      // Green rectangle (bikes allowed)
      rectangles.push({
        direction: 'west',
        color: 'green',
        x: westGreenStartX,
        width: this.laneWidth - westGreenStartX,
        y: 0, // R lane for westbound (top)
        height: this.laneHeight
      })

      // Red rectangle (bikes not allowed yet)
      if (westGreenStartX > 0) {
        rectangles.push({
          direction: 'west',
          color: 'red',
          x: 0,
          width: westGreenStartX,
          y: 0, // R lane for westbound (top)
          height: this.laneHeight
        })
      }
    }

    return rectangles
  }
}
