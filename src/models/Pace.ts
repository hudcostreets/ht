import { TimeVal, TimePoint, Num } from './TimeVal'
import { Direction } from "./Tunnel"
import type { Tunnels } from './Tunnels'

export type PaceState = 'staging' | 'tunnel' | 'exiting'

export interface PacePosition {
  x: number
  y: number
  state: PaceState
  opacity: number
  direction: Direction
}

export class Pace {
  private xPos: TimeVal<number>
  private yPos: TimeVal<number>
  private state: TimeVal<number> // 0=staging, 1=tunnel, 2=exiting
  private direction: TimeVal<number> // 0=east, 1=west
  
  constructor(tunnels: Tunnels) {
    const { eastbound: e, paceConfig } = tunnels
    const { stagingOffset } = paceConfig
    const { laneWidthPx, laneHeightPx, period } = e.config
    
    // Define time points for x position throughout the cycle
    const xPoints: TimePoint<number>[] = [
      // Start at westbound staging
      { min: 0, val: laneWidthPx + stagingOffset },
      { min: 4, val: laneWidthPx + stagingOffset },
      // Lead westbound cars (starts at :25)
      { min: 25, val: laneWidthPx },
      { min: 30, val: 0 },
      // Travel to eastbound staging
      { min: 34, val: -stagingOffset },
      // Lead eastbound cars (starts at :55)
      { min: 55, val: 0 },
      { min: period - 1, val: laneWidthPx * 0.8 }, // Most of the way through tunnel
    ]
    
    // Y position changes based on direction
    const yPoints: TimePoint<number>[] = [
      // Westbound R lane (top)
      { min: 0, val: laneHeightPx * 0.5 },
      { min: 30, val: laneHeightPx * 0.5 },
      // Transition to eastbound R lane (bottom)
      { min: 34, val: laneHeightPx * 1.5 },
      { min: period - 1, val: laneHeightPx * 1.5 },
    ]
    
    // State: 0=staging, 1=tunnel, 2=exiting
    const statePoints: TimePoint<number>[] = [
      { min: 0, val: 0 }, // staging
      { min: 24.99, val: 0 }, // staging
      { min: 25, val: 1 }, // tunnel
      { min: 29.99, val: 1 }, // tunnel
      { min: 30, val: 2 }, // exiting
      { min: 33.99, val: 2 }, // exiting
      { min: 34, val: 0 }, // staging
      { min: 54.99, val: 0 }, // staging
      { min: 55, val: 1 }, // tunnel
      { min: period - 1, val: 1 }, // still in tunnel
    ]
    
    // Direction: 0=east, 1=west
    const directionPoints: TimePoint<number>[] = [
      { min: 0, val: 1 }, // west
      { min: 30, val: 1 },
      { min: 34, val: 0 }, // east
      { min: period - 1, val: 0 }, // east
    ]
    
    this.xPos = new TimeVal(xPoints, Num, period)
    this.yPos = new TimeVal(yPoints, Num, period)
    this.state = new TimeVal(statePoints, Num, period)
    this.direction = new TimeVal(directionPoints, Num, period)
  }
  
  getPosition(relMins: number): PacePosition | null {
    const x = this.xPos.at(relMins)
    const y = this.yPos.at(relMins)
    const stateNum = Math.round(this.state.at(relMins))
    const dirNum = Math.round(this.direction.at(relMins))
    
    const states: PaceState[] = ['staging', 'tunnel', 'exiting']
    const directions: (Direction)[] = ['east', 'west']
    
    return {
      x,
      y,
      state: states[stateNum],
      opacity: 1,
      direction: directions[dirNum]
    }
  }
}
