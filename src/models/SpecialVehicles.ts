import { Vehicle, LAYOUT, SPEEDS, getLaneY } from './Vehicle'
import type { VehiclePosition } from './Vehicle'

// Sweep Van class
export class SweepVan extends Vehicle {
  getPosition(time: number): VehiclePosition | null {
    const currentMin = Math.floor(time / 60) % 60
    const currentSec = time % 60
    
    // Calculate time needed to cross tunnel (10 minutes at 12mph)
    const transitMinutes = LAYOUT.TUNNEL_LENGTH_MILES / 12 * 60
    
    // Sweep schedule:
    // :50-:00 - East transit (10 min)
    // :00-:10 - Staging at west
    // :20-:30 - West transit (10 min)
    // :30-:50 - Staging at east
    
    let isActive = false
    let activeDirection: 'east' | 'west' = 'east'
    let phaseStartMin = 0
    
    if (currentMin >= 50 || currentMin < 10) {
      // East transit or just finished
      if (currentMin >= 50) {
        isActive = true
        activeDirection = 'east'
        phaseStartMin = 50
      } else {
        // Check if still in transit from previous hour
        const timeSinceStart = currentMin * 60 + currentSec
        if (timeSinceStart < transitMinutes * 60) {
          isActive = true
          activeDirection = 'east'
          phaseStartMin = -10 // Started 10 minutes "before" hour
        }
      }
    } else if (currentMin >= 20 && currentMin < 30) {
      isActive = true
      activeDirection = 'west'
      phaseStartMin = 20
    }
    
    if (!isActive) {
      // Vehicle is in staging area
      return this.getStagingPosition(currentMin)
    }
    
    // Vehicle is active - calculate position
    const phaseTime = ((currentMin - phaseStartMin + 60) % 60) * 60 + currentSec
    const distance = SPEEDS.SWEEP * phaseTime
    const tunnelClearDistance = LAYOUT.TUNNEL_WIDTH + 100
    
    if (activeDirection === 'east') {
      const x = LAYOUT.QUEUE_AREA_WIDTH + distance
      if (distance > tunnelClearDistance) {
        return this.getStagingPosition(currentMin)
      }
      return { x, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 }
    } else {
      const x = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance
      if (distance > tunnelClearDistance) {
        return this.getStagingPosition(currentMin)
      }
      return { x, y: getLaneY('west', 2), state: 'tunnel', opacity: 1 }
    }
  }
  
  private getStagingPosition(currentMin: number): VehiclePosition {
    const stagingOffset = 35
    
    if (currentMin >= 0 && currentMin < 20) {
      // Staging west after east transit
      return {
        x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
        y: getLaneY('west', 2) - stagingOffset,
        state: 'staging',
        opacity: 1
      }
    } else {
      // Staging east after west transit or waiting
      return {
        x: LAYOUT.QUEUE_AREA_WIDTH - 50,
        y: getLaneY('east', 2) + stagingOffset,
        state: 'staging',
        opacity: 1
      }
    }
  }
}

// Pace Car class
export class PaceCar extends Vehicle {
  getPosition(time: number): VehiclePosition | null {
    const currentMin = Math.floor(time / 60) % 60
    const currentSec = time % 60
    
    // Calculate time needed to cross tunnel (5 minutes at 24mph)
    const transitMinutes = LAYOUT.TUNNEL_LENGTH_MILES / 24 * 60
    
    // Pace schedule:
    // :55-:00 - East transit (5 min)
    // :00-:25 - Staging at west
    // :25-:30 - West transit (5 min)
    // :30-:55 - Staging at east
    
    let isActive = false
    let activeDirection: 'east' | 'west' = 'east'
    let phaseStartMin = 0
    
    if (currentMin >= 55 || currentMin < 10) {
      // East transit or just finished
      if (currentMin >= 55) {
        isActive = true
        activeDirection = 'east'
        phaseStartMin = 55
      } else {
        // Check if still in transit from previous hour
        const timeSinceStart = currentMin * 60 + currentSec
        if (timeSinceStart < transitMinutes * 60) {
          isActive = true
          activeDirection = 'east'
          phaseStartMin = -5
        }
      }
    } else if (currentMin >= 25 && currentMin < 30) {
      isActive = true
      activeDirection = 'west'
      phaseStartMin = 25
    }
    
    if (!isActive) {
      return this.getStagingPosition(currentMin)
    }
    
    // Vehicle is active - calculate position
    const phaseTime = ((currentMin - phaseStartMin + 60) % 60) * 60 + currentSec
    const distance = SPEEDS.PACE * phaseTime
    const tunnelClearDistance = LAYOUT.TUNNEL_WIDTH + 100
    
    if (activeDirection === 'east') {
      const x = LAYOUT.QUEUE_AREA_WIDTH + distance
      if (distance > tunnelClearDistance) {
        return this.getStagingPosition(currentMin)
      }
      return { x, y: getLaneY('east', 2), state: 'tunnel', opacity: 1 }
    } else {
      const x = LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - distance
      if (distance > tunnelClearDistance) {
        return this.getStagingPosition(currentMin)
      }
      return { x, y: getLaneY('west', 2), state: 'tunnel', opacity: 1 }
    }
  }
  
  private getStagingPosition(currentMin: number): VehiclePosition {
    const stagingOffset = 60
    
    if (currentMin >= 0 && currentMin < 25) {
      // Staging west after east transit
      return {
        x: LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 50,
        y: getLaneY('west', 2) - stagingOffset,
        state: 'staging',
        opacity: 1
      }
    } else {
      // Staging east after west transit or waiting
      return {
        x: LAYOUT.QUEUE_AREA_WIDTH - 50,
        y: getLaneY('east', 2) + stagingOffset,
        state: 'staging',
        opacity: 1
      }
    }
  }
}
