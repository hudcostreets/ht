import { TimeVal, TimePoint, Num } from './TimeVal'
import { LAYOUT } from './Constants'
import type { Tunnels } from './Tunnels'

export type SweepState = 'staging' | 'tunnel' | 'exiting'

export interface SweepPosition {
  x: number
  y: number
  state: SweepState
  opacity: number
  direction: 'east' | 'west'
}

export class Sweep {
  private xPos: TimeVal<number>
  private yPos: TimeVal<number>
  private state: TimeVal<number> // 0=staging, 1=tunnel, 2=exiting
  private direction: TimeVal<number> // 0=east, 1=west
  
  constructor(tunnels: Tunnels) {
    const { eastbound: e, westbound: w, sweepConfig } = tunnels
    const { stagingOffset } = sweepConfig
    const { laneWidthPx, laneHeightPx, period } = e.config
    
    // Define time points for x position throughout the cycle
    const xPoints: TimePoint<number>[] = [
      // Eastbound staging (start of hour)
      { min: 0, val: -stagingOffset },
      // Transition to westbound staging
      { min: 5, val: laneWidthPx + stagingOffset },
      // Westbound staging continues
      { min: 19, val: laneWidthPx + stagingOffset },
      // Sweep westbound
      { min: 20, val: laneWidthPx },
      { min: 25, val: 0 },
      // Transition to eastbound staging
      { min: 26, val: -stagingOffset },
      // Eastbound staging continues  
      { min: 49, val: -stagingOffset },
      // Sweep eastbound
      { min: 50, val: 0 },
      { min: 55, val: laneWidthPx },
      // Transition to westbound staging
      { min: 56, val: laneWidthPx + stagingOffset },
      { min: period - 1, val: laneWidthPx + stagingOffset },
    ]
    
    // Y position changes based on direction
    const yPoints: TimePoint<number>[] = [
      // Eastbound R lane (bottom)
      { min: 0, val: laneHeightPx * 1.5 },
      // Westbound R lane (top)
      { min: 5, val: laneHeightPx * 0.5 },
      { min: 25, val: laneHeightPx * 0.5 },
      // Back to eastbound R lane (bottom)
      { min: 26, val: laneHeightPx * 1.5 },
      { min: 55, val: laneHeightPx * 1.5 },
      // Back to westbound R lane (top)
      { min: 56, val: laneHeightPx * 0.5 },
      { min: period - 1, val: laneHeightPx * 0.5 },
    ]
    
    // State: 0=staging, 1=tunnel, 2=exiting
    const statePoints: TimePoint<number>[] = [
      { min: 0, val: 0 }, // staging
      { min: 19.99, val: 0 }, // staging
      { min: 20, val: 1 }, // tunnel (westbound)
      { min: 24.99, val: 1 }, // tunnel
      { min: 25, val: 2 }, // exiting
      { min: 25.99, val: 2 }, // exiting
      { min: 26, val: 0 }, // staging
      { min: 49.99, val: 0 }, // staging
      { min: 50, val: 1 }, // tunnel (eastbound)
      { min: 54.99, val: 1 }, // tunnel
      { min: 55, val: 2 }, // exiting
      { min: 55.99, val: 2 }, // exiting
      { min: 56, val: 0 }, // staging
      { min: period - 1, val: 0 },
    ]
    
    // Direction: 0=east, 1=west
    const directionPoints: TimePoint<number>[] = [
      { min: 0, val: 0 }, // east
      { min: 5, val: 1 }, // west
      { min: 25, val: 1 }, // west
      { min: 26, val: 0 }, // east
      { min: 55, val: 0 }, // east
      { min: 56, val: 1 }, // west
      { min: period - 1, val: 1 }, // west
    ]
    
    this.xPos = new TimeVal(xPoints, Num, period)
    this.yPos = new TimeVal(yPoints, Num, period)
    this.state = new TimeVal(statePoints, Num, period)
    this.direction = new TimeVal(directionPoints, Num, period)
  }
  
  getPosition(relMins: number): SweepPosition | null {
    const x = this.xPos.at(relMins)
    const y = this.yPos.at(relMins)
    const stateNum = Math.round(this.state.at(relMins))
    const dirNum = Math.round(this.direction.at(relMins))
    
    const states: SweepState[] = ['staging', 'tunnel', 'exiting']
    const directions: ('east' | 'west')[] = ['east', 'west']
    
    return {
      x,
      y,
      state: states[stateNum],
      opacity: 1,
      direction: directions[dirNum]
    }
  }
}