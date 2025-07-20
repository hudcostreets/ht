import {Car} from "./Car"
import {Bike} from "./Bike"

export interface TunnelConfig {
  direction: 'east' | 'west'
  offsetMinute: number  // When pen opens (:45 for E, :15 for W)
  lengthMiles: number   // 2 miles
  carSpeed: number      // mph
  bikeUphillSpeed: number
  bikeDownhillSpeed: number
  penOpenMinutes: number // 3 minutes
  bikesPerMinute: number // 0.25
  carsPerMinute: number  // 1
  
  // Layout
  lanePixelWidth: number
  lanePixelHeight: number
  penRelativeX: number   // Relative to R lane start
  penRelativeY: number   // Relative to R lane start
  penPixelWidth: number
  penPixelHeight: number
  
  // Exit behavior
  exitFadeDistance: number  // Distance to travel while fading out after tunnel exit
}

export interface TimePosition {
  time: number
  x: number
  y: number
  state: 'pen' | 'staging' | 'tunnel' | 'exiting' | 'queued'
  opacity: number
}

export class Tunnel {
  private config: TunnelConfig
  private bikes: Bike[] = []
  private cars: Car[] = []
  
  constructor(config: TunnelConfig) {
    this.config = config
    this.initializeVehicles()
  }
  
  private initializeVehicles() {
    // Create bikes (spawn every 4 minutes)
    for (let i = 0; i < 15; i++) {
      const spawnMinute = i * 4
      this.bikes.push(new Bike(this, i, spawnMinute))
    }
    
    // Create cars (spawn every minute)
    for (let minute = 0; minute < 60; minute++) {
      // L lane cars (always flow)
      this.cars.push(new Car(this, minute, minute, 'L'))
      
      // R lane cars (may queue during bike phases)
      this.cars.push(new Car(this, minute, minute, 'R'))
    }
  }
  
  // Convert absolute time to tunnel-relative time
  getRelativeTime(absoluteTime: number): number {
    const hourInSeconds = Math.floor(absoluteTime / 3600) * 3600
    const relativeTime = absoluteTime - hourInSeconds
    
    // Shift time so that our offset minute becomes "minute 0"
    const shiftedTime = relativeTime - (this.config.offsetMinute * 60)
    
    // Handle negative wrap-around (e.g. if we're at :10 and offset is :15)
    if (shiftedTime < 0) {
      return shiftedTime + 3600 // Add an hour
    }
    
    return shiftedTime
  }
  
  // Convert tunnel-relative time back to absolute
  getAbsoluteTime(relativeTime: number, hourBase: number): number {
    const hourInSeconds = Math.floor(hourBase / 3600) * 3600
    const absoluteTime = hourInSeconds + relativeTime + (this.config.offsetMinute * 60)
    
    // Handle overflow
    if (absoluteTime >= hourInSeconds + 3600) {
      return absoluteTime - 3600
    }
    
    return absoluteTime
  }
  
  // Get phase at relative time (0 = pen opens)
  getPhase(relativeTime: number): 'normal' | 'bikes-enter' | 'clearing' | 'sweep' | 'pace-car' {
    const minute = Math.floor(relativeTime / 60)
    
    if (minute >= 0 && minute < this.config.penOpenMinutes) {
      return 'bikes-enter'
    } else if (minute >= this.config.penOpenMinutes && minute < 5) {
      return 'clearing'
    } else if (minute >= 5 && minute < 10) {
      return 'sweep'
    } else if (minute >= 10 && minute < 15) {
      return 'pace-car'
    } else {
      return 'normal'
    }
  }
  
  getBikes(): Bike[] {
    return this.bikes
  }
  
  getCars(): Car[] {
    return this.cars
  }
  
  getConfig(): TunnelConfig {
    return this.config
  }
}
