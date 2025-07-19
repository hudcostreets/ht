// Vehicle position and state
export interface VehiclePosition {
  x: number;
  y: number;
  state: 'approaching' | 'queued' | 'tunnel' | 'exiting' | 'staging' | 'pen';
  opacity: number;
}

// Base vehicle interface
export interface VehicleData {
  id: string;
  type: 'car' | 'bike' | 'sweep' | 'pace';
  spawnMinute: number;
  lane: number;
  direction: 'east' | 'west';
}

// Speed constants in pixels per second
export const SPEEDS = {
  CAR: 0, // Will be calculated
  BIKE_DOWNHILL: 0,
  BIKE_UPHILL: 0,
  SWEEP: 0,
  PACE: 0
};

// Layout constants
export const LAYOUT = {
  TUNNEL_WIDTH: 800,
  QUEUE_AREA_WIDTH: 150,
  LANE_HEIGHT: 30,
  BIKE_PEN_WIDTH: 120,
  BIKE_PEN_HEIGHT: 80,
  TUNNEL_LENGTH_MILES: 2
};

// Convert MPH to pixels per second
function mphToPixelsPerSecond(mph: number): number {
  const pixelsPerMile = LAYOUT.TUNNEL_WIDTH / LAYOUT.TUNNEL_LENGTH_MILES;
  const pixelsPerHour = mph * pixelsPerMile;
  const pixelsPerMinute = pixelsPerHour / 60;
  const pixelsPerSecond = pixelsPerMinute / 60;
  return pixelsPerSecond;
}

// Initialize speeds
SPEEDS.CAR = mphToPixelsPerSecond(24);
SPEEDS.BIKE_DOWNHILL = mphToPixelsPerSecond(15);
SPEEDS.BIKE_UPHILL = mphToPixelsPerSecond(8);
SPEEDS.SWEEP = mphToPixelsPerSecond(12);
SPEEDS.PACE = SPEEDS.CAR;

// Get phase for a given minute
export function getPhase(minute: number, direction: 'east' | 'west'): string {
  const offset = direction === 'west' ? 30 : 0;
  const adjustedMinute = (minute + offset) % 60;
  
  if (adjustedMinute < 45) return 'normal';
  if (adjustedMinute < 48) return 'bikes-enter';
  if (adjustedMinute < 50) return 'clearing';
  if (adjustedMinute < 55) return 'sweep';
  return 'pace-car';
}

// Get Y position for a lane
export function getLaneY(direction: 'east' | 'west', lane: number): number {
  if (direction === 'west') {
    const baseY = 100;
    return baseY + (2 - lane) * LAYOUT.LANE_HEIGHT + LAYOUT.LANE_HEIGHT / 2;
  } else {
    const baseY = 200;
    return baseY + (lane - 1) * LAYOUT.LANE_HEIGHT + LAYOUT.LANE_HEIGHT / 2;
  }
}

// Abstract base class for vehicles
export abstract class Vehicle {
  data: VehicleData;
  
  constructor(data: VehicleData) {
    this.data = data;
  }
  
  abstract getPosition(time: number): VehiclePosition | null;
  
  protected getTunnelEntrance(): number {
    return this.data.direction === 'east' ? 
      LAYOUT.QUEUE_AREA_WIDTH : 
      LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH;
  }
}

// Car class
export class Car extends Vehicle {
  private readonly fadeZone = 100;
  
  getPosition(time: number): VehiclePosition | null {
    const currentHour = Math.floor(time / 3600);
    const spawnTime = (currentHour * 3600) + (this.data.spawnMinute * 60);
    
    // Check if we're within 1 minute of spawn time
    if (time < spawnTime - 60) return null;
    
    // If we're before spawn time but within fade-in period, car is fading in
    if (time < spawnTime && time >= spawnTime - 60) {
      const timeUntilSpawn = spawnTime - time;
      const fadeProgress = 1 - (timeUntilSpawn / 60);
      
      return {
        x: this.getTunnelEntrance(),
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'approaching',
        opacity: fadeProgress
      };
    }
    
    // Check if lane is blocked
    const phase = getPhase(this.data.spawnMinute, this.data.direction);
    const isLane2Blocked = this.data.lane === 2 && phase !== 'normal';
    
    let enterTime = spawnTime;
    
    if (isLane2Blocked) {
      // Calculate when car can enter
      const nextNormalMinute = this.getNextNormalMinute();
      const nextNormalTime = (currentHour * 3600) + (nextNormalMinute * 60);
      
      if (nextNormalMinute === 60) {
        enterTime = ((currentHour + 1) * 3600);
      } else {
        enterTime = nextNormalTime;
      }
      
      // If still waiting to enter, show in queue
      if (time < enterTime) {
        return this.getQueuePosition();
      }
    }
    
    // Moving through tunnel
    const travelTime = time - enterTime;
    const tunnelTransitTime = (LAYOUT.TUNNEL_LENGTH_MILES / 24) * 3600; // 5 minutes at 24mph
    const totalTransitTime = tunnelTransitTime + 120; // Add 2 minutes for fade zones
    
    // Handle previous hour cars
    if (travelTime < 0) {
      const prevHourTravelTime = travelTime + 3600;
      if (prevHourTravelTime > totalTransitTime) return null;
      return this.calculateMovingPosition(prevHourTravelTime);
    }
    
    // Car has exited
    if (travelTime > totalTransitTime) return null;
    
    return this.calculateMovingPosition(travelTime);
  }
  
  private getNextNormalMinute(): number {
    const minute = this.data.spawnMinute;
    
    if (this.data.direction === 'east') {
      if (minute === 45) return 56;
      if (minute < 45 || minute >= 56) return minute;
      return 60; // :46-:55 don't exist
    } else {
      if (minute === 15) return 26;
      if (minute >= 30 || minute < 15) return minute;
      return 30;
    }
  }
  
  private getQueuePosition(): VehiclePosition {
    // Calculate unique queue position based on spawn minute
    const queueIndex = this.data.spawnMinute % 15;
    const queueSpacing = 40;
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
  
  private calculateMovingPosition(travelTime: number): VehiclePosition | null {
    const distance = SPEEDS.CAR * travelTime;
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance;
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone) ||
        (this.data.direction === 'west' && x < LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) {
      return null;
    }
    
    // Calculate opacity for fade out at exits
    let opacity = 1;
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone - x) / this.fadeZone);
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x - (LAYOUT.QUEUE_AREA_WIDTH - this.fadeZone)) / this.fadeZone);
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'approaching' : 'tunnel';
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity };
  }
}

// Bike class
export class Bike extends Vehicle {
  private readonly fadeZone = 50;
  
  getPosition(time: number): VehiclePosition | null {
    // Bikes spawn every 4 minutes (15 total per hour)
    const bikeSpawnMinute = this.data.spawnMinute * 4;
    const currentHour = Math.floor(time / 3600);
    const minuteInHour = Math.floor(time / 60) % 60;
    
    // Only spawn first 14 bikes (0-13)
    if (this.data.spawnMinute > 13 || bikeSpawnMinute > minuteInHour) return null;
    
    // Determine release time based on phase
    const releaseMinute = this.data.direction === 'east' ? 45 : 15;
    const releaseTime = (currentHour * 3600) + (releaseMinute * 60);
    
    if (time < releaseTime) {
      return this.getPenPosition();
    }
    
    // First bike stages at tunnel entrance
    const isFirstBike = this.data.spawnMinute === 0;
    if (isFirstBike && time >= releaseTime && time < releaseTime + 12) {
      return {
        x: this.getTunnelEntrance(),
        y: getLaneY(this.data.direction, this.data.lane),
        state: 'tunnel',
        opacity: 1
      };
    }
    
    // Calculate release timing (5 per minute = 12 seconds apart)
    const releaseOrder = this.data.spawnMinute;
    const releaseDelay = releaseOrder * 12;
    const actualReleaseTime = releaseTime + releaseDelay;
    
    if (time < actualReleaseTime) {
      return this.getPenPosition();
    }
    
    // Moving through tunnel
    const travelTime = time - actualReleaseTime;
    return this.calculateMovingPosition(travelTime);
  }
  
  private getPenPosition(): VehiclePosition {
    // Arrange bikes in a 3x5 grid
    const row = Math.floor(this.data.spawnMinute / 3);
    const col = this.data.spawnMinute % 3;
    
    const penX = this.data.direction === 'east' ? 70 : LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + 70;
    const penY = this.data.direction === 'east' ? 310 : 60;
    
    return {
      x: penX + (col * 20) - 20,
      y: penY + (row * 15) - 30,
      state: 'pen',
      opacity: 1
    };
  }
  
  private calculateMovingPosition(travelTime: number): VehiclePosition | null {
    // Calculate position with variable speed
    let distance = 0;
    const halfwayTime = (LAYOUT.TUNNEL_WIDTH / 2) / SPEEDS.BIKE_DOWNHILL;
    
    if (travelTime <= halfwayTime) {
      distance = SPEEDS.BIKE_DOWNHILL * travelTime;
    } else {
      distance = (LAYOUT.TUNNEL_WIDTH / 2) + SPEEDS.BIKE_UPHILL * (travelTime - halfwayTime);
    }
    
    const x = this.data.direction === 'east' ? 
      this.getTunnelEntrance() + distance : 
      this.getTunnelEntrance() - distance;
    
    // Check if exited
    if ((this.data.direction === 'east' && x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone) ||
        (this.data.direction === 'west' && x < -this.fadeZone)) {
      return null;
    }
    
    // Calculate opacity for fade out at exit
    let opacity = 1;
    if (this.data.direction === 'east') {
      if (x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH + this.fadeZone - x) / this.fadeZone);
      }
    } else {
      if (x < LAYOUT.QUEUE_AREA_WIDTH) {
        opacity = Math.max(0, (x + this.fadeZone) / this.fadeZone);
      }
    }
    
    const state = x < LAYOUT.QUEUE_AREA_WIDTH || x > LAYOUT.TUNNEL_WIDTH + LAYOUT.QUEUE_AREA_WIDTH ? 
      'approaching' : 'tunnel';
    
    return { x, y: getLaneY(this.data.direction, this.data.lane), state, opacity };
  }
}