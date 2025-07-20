import { Car as BaseCar, LAYOUT, SPEEDS, getPhase, getLaneY } from './Vehicle'
import type { VehicleData, VehiclePosition } from './Vehicle'

// Extended car data that includes queue information
export interface CarData extends VehicleData {
  queuePosition?: number;
  paceCarStartMins?: number;
}

// Enhanced Car class that handles moving queue logic
export class Car extends BaseCar {
  private queuePosition?: number
  private paceCarStartMins?: number
  
  constructor(data: CarData) {
    super(data)
    this.queuePosition = data.queuePosition
    this.paceCarStartMins = data.paceCarStartMins
  }
  
  getPosition(time: number): VehiclePosition | null {
    const currentHour = Math.floor(time / 60)
    const spawnTime = (currentHour * 60) + this.data.spawnMinute
    
    // Check if we're within 1 minute of spawn time
    if (time < spawnTime - 60) {
      // Check if this vehicle might still be in transit from the previous hour
      const prevHourSpawnTime = ((currentHour - 1) * 3600) + (this.data.spawnMinute * 60)
      const timeSincePrevSpawn = time - prevHourSpawnTime
      
      // Calculate maximum transit time for a car
      const tunnelTransitMins = (LAYOUT.TUNNEL_LENGTH_MILES / SPEEDS.CAR) * 60
      const totalTransitMins = tunnelTransitMins + 2
      
      // If the car could still be in transit from previous hour, continue processing
      if (timeSincePrevSpawn > totalTransitMins + 60) {
        return null
      }
      
      // Process as a previous hour vehicle
      return this.getPositionForSpawnTime(time, prevHourSpawnTime, currentHour - 1)
    }
    
    return this.getPositionForSpawnTime(time, spawnTime, currentHour)
  }
  
  private getPositionForSpawnTime(time: number, spawnTime: number, spawnHour: number): VehiclePosition | null {
    // If we're before spawn time but within fade-in period, car is fading in
    if (time < spawnTime && time >= spawnTime - 60) {
      const timeUntilSpawn = spawnTime - time
      const fadeProgress = 1 - (timeUntilSpawn / 60)
      
      // Check if queue is currently draining (pace car has started)
      const isQueueDraining = this.isQueueCurrentlyDraining(time, spawnHour)
      
      if (isQueueDraining && this.paceCarStartMins && this.queuePosition !== undefined) {
        // Calculate position in the moving queue
        const paceStartTime = (spawnHour * 60) + this.paceCarStartMins
        const elapsedSincePaceStart = Math.max(0, time - paceStartTime)
        const paceDistance = SPEEDS.CAR * elapsedSincePaceStart
        
        const queueSpacing = 30
        const offset = ((this.queuePosition || 0) + 1) * queueSpacing
        
        const targetX = this.data.direction === 'east' ? 
          LAYOUT.QUEUE_AREA_WIDTH + paceDistance - offset :
          LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - paceDistance + offset
        
        // Calculate staging position
        const stagingOffset = SPEEDS.CAR * 60
        const stagingX = this.data.direction === 'east' ?
          targetX - stagingOffset :
          targetX + stagingOffset
        
        // Interpolate from staging to target
        const x = stagingX + (targetX - stagingX) * fadeProgress
        
        return {
          x,
          y: getLaneY(this.data.direction, this.data.lane),
          state: 'approaching',
          opacity: fadeProgress
        }
      }
      
      // Check if this car will queue
      const phase = getPhase(this.data.spawnMinute, this.data.direction)
      const willQueue = this.data.lane === 2 && phase !== 'normal' && this.queuePosition !== undefined
      
      // Calculate staging position (1 minute of travel distance before destination)
      const stagingOffset = SPEEDS.CAR * 60
      let targetX, stagingX
      
      if (willQueue) {
        // For queued cars, fade in to queue position (but adjust if queue is moving)
        const queuePos = this.calculateQueuePosition(time, spawnHour)
        targetX = queuePos.x
        stagingX = this.data.direction === 'east' ?
          targetX - stagingOffset :
          targetX + stagingOffset
      } else {
        // For non-queued cars, fade in to tunnel entrance
        targetX = this.getTunnelEntrance()
        stagingX = this.data.direction === 'east' ?
          targetX - stagingOffset :
          targetX + stagingOffset
      }
      
      // Interpolate from staging position to target
      const currentX = stagingX + (targetX - stagingX) * fadeProgress
      
      return {
        x: currentX,
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'approaching',
        opacity: fadeProgress
      }
    }
    
    // Check if lane is blocked
    const phase = getPhase(this.data.spawnMinute, this.data.direction)
    // R lane is blocked during bike phases: lane 2 for eastbound, lane 1 for westbound
    const rLane = this.data.direction === 'east' ? 2 : 1
    const isRLaneBlocked = this.data.lane === rLane && phase !== 'normal'
    
    let enterTime = spawnTime
    
    // Check if this car should be in a queue
    if (this.queuePosition !== undefined && this.paceCarStartMins) {
      const paceStartTime = (spawnHour * 60) + this.paceCarStartMins
      
      if (time >= paceStartTime) {
        // Pace car has started, all queued cars move together
        const travelTime = time - paceStartTime
        const distance = SPEEDS.CAR * travelTime
        
        // Calculate pace car position at pace start time
        const paceCarInitialX = this.data.direction === 'east' ? 
          LAYOUT.QUEUE_AREA_WIDTH : 
          LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH
        
        // Calculate this car's offset from pace car (based on queue position)
        const queueSpacing = 30
        const baseOffset = 50
        const carOffsetFromPace = baseOffset + (this.queuePosition * queueSpacing)
        
        // Car position = pace car position - offset
        const x = this.data.direction === 'east' ? 
          paceCarInitialX + distance - carOffsetFromPace :
          paceCarInitialX - distance + carOffsetFromPace
        
        // Handle fade out
        const tunnelTransitMins = (LAYOUT.TUNNEL_LENGTH_MILES / SPEEDS.CAR) * 60
        const totalTransitMins = tunnelTransitMins + 2
        
        if (travelTime > totalTransitMins) return null
        
        return this.calculatePositionWithFade(x)
      } else if (time >= spawnTime) {
        // Car has spawned but pace car hasn't started yet - sit in queue
        return this.calculateStaticQueuePosition()
      } else {
        // Car hasn't spawned yet
        return null
      }
    }
    
    // Normal blocked car logic
    if (isRLaneBlocked && !this.isLateArrival()) {
      // Calculate when car can enter
      const nextNormalMinute = this.calculateNextNormalMinute()
      const nextNormalTime = (spawnHour * 3600) + (nextNormalMinute * 60)
      
      if (nextNormalMinute === 60) {
        enterTime = ((spawnHour + 1) * 3600)
      } else {
        enterTime = nextNormalTime
      }
      
      // If still waiting to enter, show in queue
      if (time < enterTime) {
        return this.calculateQueuePosition(time, spawnHour)
      }
    }
    
    // Moving through tunnel normally
    const travelTime = time - enterTime
    const tunnelTransitTime = (LAYOUT.TUNNEL_LENGTH_MILES / 24) * 3600
    const totalTransitTime = tunnelTransitTime + 120
    
    // This should not happen with the new logic, but keep as safety
    if (travelTime < 0) {
      return null
    }
    
    // Car has exited
    if (travelTime > totalTransitTime) return null
    
    return this.computeMovingPosition(travelTime)
  }
  
  private isLateArrival(): boolean {
    return (this.data.direction === 'east' && (this.data.spawnMinute === 56 || this.data.spawnMinute === 57)) ||
           (this.data.direction === 'west' && (this.data.spawnMinute === 26 || this.data.spawnMinute === 27))
  }
  
  private calculateNextNormalMinute(): number {
    const minute = this.data.spawnMinute
    
    if (this.data.direction === 'east') {
      if (minute === 45) return 56
      if (minute < 45 || minute >= 56) return minute
      return 60
    } else {
      if (minute === 15) return 26
      if (minute >= 30 || minute < 15) return minute
      return 30
    }
  }
  
  private calculateQueuePosition(time?: number, spawnHour?: number): VehiclePosition {
    const queueIndex = this.queuePosition !== undefined ? 
      this.queuePosition : 
      (this.data.spawnMinute - (this.data.direction === 'east' ? 45 : 15))
    const queueSpacing = 30
    const baseOffset = 50
    
    let x = this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing)
    
    // If queue is draining and we have time info, adjust position
    if (time && spawnHour && this.isQueueCurrentlyDraining(time, spawnHour) && this.paceCarStartMins) {
      const paceStartTime = (spawnHour * 3600) + (this.paceCarStartMins * 60)
      const elapsedSincePaceStart = Math.max(0, time - paceStartTime)
      
      // Calculate how far the front of the queue has moved
      const queueMovement = SPEEDS.CAR * elapsedSincePaceStart
      
      // Adjust our position based on queue movement
      if (this.data.direction === 'east') {
        x += queueMovement
      } else {
        x -= queueMovement
      }
    }
    
    return {
      x,
      y: getLaneY(this.data.direction, this.data.lane),
      state: 'queued',
      opacity: 1
    }
  }
  
  private calculateStaticQueuePosition(): VehiclePosition {
    const queueIndex = this.queuePosition !== undefined ? 
      this.queuePosition : 
      (this.data.spawnMinute - (this.data.direction === 'east' ? 45 : 15))
    const queueSpacing = 30
    const baseOffset = 50
    
    const x = this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing)
    
    return {
      x,
      y: getLaneY(this.data.direction, this.data.lane),
      state: 'queued',
      opacity: 1
    }
  }
  
  private isQueueCurrentlyDraining(time: number, spawnHour: number): boolean {
    if (!this.paceCarStartMins) return false
    
    const paceStartTime = (spawnHour * 3600) + (this.paceCarStartMins * 60)
    
    // Queue is draining once pace car has started
    if (this.data.direction === 'east') {
      // Eastbound pace starts at :55, queue drains through :59
      return time >= paceStartTime && time < paceStartTime + 300 // 5 minutes
    } else {
      // Westbound pace starts at :25, queue drains through :29  
      return time >= paceStartTime && time < paceStartTime + 300 // 5 minutes
    }
  }
  
  private computeMovingPosition(travelTime: number): VehiclePosition | null {
    const distance = SPEEDS.CAR * travelTime
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance
    
    return this.calculatePositionWithFade(x)
  }
  
  private calculatePositionWithFade(x: number): VehiclePosition | null {
    const fadeZone = 100
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - fadeZone)) {
      return null
    }
    
    // Calculate opacity for fade out at exits
    let opacity = 1
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + fadeZone - x) / fadeZone)
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - fadeZone)) / fadeZone)
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'exiting' : 'tunnel'
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity }
  }
}
