import { Car as BaseCar, LAYOUT, SPEEDS, getPhase, getLaneY } from './Vehicle';
import type { VehicleData, VehiclePosition } from './Vehicle';

// Extended car data that includes queue information
export interface CarData extends VehicleData {
  queuePosition?: number;
  paceCarStartTime?: number;
}

// Enhanced Car class that handles moving queue logic
export class Car extends BaseCar {
  private queuePosition?: number;
  private paceCarStartTime?: number;
  
  constructor(data: CarData) {
    super(data);
    this.queuePosition = data.queuePosition;
    this.paceCarStartTime = data.paceCarStartTime;
  }
  
  getPosition(time: number): VehiclePosition | null {
    const currentHour = Math.floor(time / 3600);
    const spawnTime = (currentHour * 3600) + (this.data.spawnMinute * 60);
    
    // Check if we're within 1 minute of spawn time
    if (time < spawnTime - 60) return null;
    
    // If we're before spawn time but within fade-in period, car is fading in
    if (time < spawnTime && time >= spawnTime - 60) {
      const timeUntilSpawn = spawnTime - time;
      const fadeProgress = 1 - (timeUntilSpawn / 60);
      
      // For late arrivals that join moving queue
      const isLateArrival = this.isLateArrival();
      if (isLateArrival && this.paceCarStartTime) {
        // Calculate where the car should be fading in (following the moving queue)
        const paceStartTime = (currentHour * 3600) + (this.paceCarStartTime * 60);
        const elapsedSincePaceStart = Math.max(0, time - paceStartTime);
        const paceDistance = SPEEDS.CAR * elapsedSincePaceStart;
        
        const queueSpacing = 30;
        const offset = ((this.queuePosition || 0) + 1) * queueSpacing;
        
        const targetX = this.data.direction === 'east' ? 
          LAYOUT.QUEUE_AREA_WIDTH + paceDistance - offset :
          LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - paceDistance + offset;
        
        // Calculate staging position
        const stagingOffset = SPEEDS.CAR * 60;
        const stagingX = this.data.direction === 'east' ?
          targetX - stagingOffset :
          targetX + stagingOffset;
        
        // Interpolate from staging to target
        const x = stagingX + (targetX - stagingX) * fadeProgress;
        
        return {
          x,
          y: getLaneY(this.data.direction, this.data.lane),
          state: 'approaching',
          opacity: fadeProgress
        };
      }
      
      // Calculate staging position (1 minute of travel distance before tunnel entrance)
      const stagingOffset = SPEEDS.CAR * 60;
      const stagingX = this.data.direction === 'east' ?
        this.getTunnelEntrance() - stagingOffset :
        this.getTunnelEntrance() + stagingOffset;
      
      // Interpolate from staging position to tunnel entrance
      const currentX = stagingX + (this.getTunnelEntrance() - stagingX) * fadeProgress;
      
      return {
        x: currentX,
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'approaching',
        opacity: fadeProgress
      };
    }
    
    // Check if lane is blocked
    const phase = getPhase(this.data.spawnMinute, this.data.direction);
    const isLane2Blocked = this.data.lane === 2 && phase !== 'normal';
    
    let enterTime = spawnTime;
    
    // Handle late arrivals that join moving queue
    if (this.isLateArrival() && this.paceCarStartTime) {
      const paceStartTime = (currentHour * 3600) + (this.paceCarStartTime * 60);
      enterTime = spawnTime; // They enter immediately, following the moving queue
      
      // Calculate position following the pace car
      const elapsedSincePaceStart = Math.max(0, time - paceStartTime);
      const paceDistance = SPEEDS.CAR * elapsedSincePaceStart;
      
      const queueSpacing = 30;
      const offset = ((this.queuePosition || 0) + 1) * queueSpacing;
      
      const x = this.data.direction === 'east' ? 
        LAYOUT.QUEUE_AREA_WIDTH + paceDistance - offset :
        LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH - paceDistance + offset;
      
      // Check if still following or if car has reached its natural position
      const naturalTravelTime = time - enterTime;
      const naturalDistance = SPEEDS.CAR * naturalTravelTime;
      const naturalX = this.data.direction === 'east' ? 
        this.getTunnelEntrance() + naturalDistance : 
        this.getTunnelEntrance() - naturalDistance;
      
      // Use whichever position is further back (car can't go faster than pace)
      const finalX = this.data.direction === 'east' ? 
        Math.min(x, naturalX) : 
        Math.max(x, naturalX);
      
      // Handle fade out
      const tunnelTransitTime = (LAYOUT.TUNNEL_LENGTH_MILES / 24) * 3600;
      const totalTransitTime = tunnelTransitTime + 120;
      
      if (naturalTravelTime > totalTransitTime) return null;
      
      return this.calculatePositionWithFade(finalX);
    }
    
    // Normal blocked car logic
    if (isLane2Blocked && !this.isLateArrival()) {
      // Calculate when car can enter
      const nextNormalMinute = this.calculateNextNormalMinute();
      const nextNormalTime = (currentHour * 3600) + (nextNormalMinute * 60);
      
      if (nextNormalMinute === 60) {
        enterTime = ((currentHour + 1) * 3600);
      } else {
        enterTime = nextNormalTime;
      }
      
      // If still waiting to enter, show in queue
      if (time < enterTime) {
        return this.calculateQueuePosition();
      }
    }
    
    // Moving through tunnel normally
    const travelTime = time - enterTime;
    const tunnelTransitTime = (LAYOUT.TUNNEL_LENGTH_MILES / 24) * 3600;
    const totalTransitTime = tunnelTransitTime + 120;
    
    // Handle previous hour cars
    if (travelTime < 0) {
      const prevHourTravelTime = travelTime + 3600;
      if (prevHourTravelTime > totalTransitTime) return null;
      return this.computeMovingPosition(prevHourTravelTime);
    }
    
    // Car has exited
    if (travelTime > totalTransitTime) return null;
    
    return this.computeMovingPosition(travelTime);
  }
  
  private isLateArrival(): boolean {
    return (this.data.direction === 'east' && (this.data.spawnMinute === 56 || this.data.spawnMinute === 57)) ||
           (this.data.direction === 'west' && (this.data.spawnMinute === 26 || this.data.spawnMinute === 27));
  }
  
  private calculateNextNormalMinute(): number {
    const minute = this.data.spawnMinute;
    
    if (this.data.direction === 'east') {
      if (minute === 45) return 56;
      if (minute < 45 || minute >= 56) return minute;
      return 60;
    } else {
      if (minute === 15) return 26;
      if (minute >= 30 || minute < 15) return minute;
      return 30;
    }
  }
  
  private calculateQueuePosition(): VehiclePosition {
    const queueIndex = this.queuePosition !== undefined ? 
      this.queuePosition : 
      (this.data.spawnMinute - (this.data.direction === 'east' ? 45 : 15));
    const queueSpacing = 30;
    const baseOffset = 50;
    
    const x = this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH - baseOffset - (queueIndex * queueSpacing) :
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + baseOffset + (queueIndex * queueSpacing);
    
    return {
      x,
      y: getLaneY(this.data.direction, this.data.lane),
      state: 'queued',
      opacity: 1
    };
  }
  
  private computeMovingPosition(travelTime: number): VehiclePosition | null {
    const distance = SPEEDS.CAR * travelTime;
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance;
    
    return this.calculatePositionWithFade(x);
  }
  
  private calculatePositionWithFade(x: number): VehiclePosition | null {
    const fadeZone = 100;
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - fadeZone)) {
      return null;
    }
    
    // Calculate opacity for fade out at exits
    let opacity = 1;
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + fadeZone - x) / fadeZone);
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - fadeZone)) / fadeZone);
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'exiting' : 'tunnel';
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity };
  }
}