import { describe, it, expect } from 'vitest'
import { Car } from '../Car'
import { Tunnel } from '../Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Car', () => {
  it('should create and position a normal flow car', () => {
    const tunnel = new Tunnel(HOLLAND_TUNNEL_CONFIG.eastbound)
    const car = new Car({ 
      tunnel, 
      laneId: 'L', 
      spawnMin: 0
    })
    
    // At spawn time, car should be at tunnel entrance
    const pos = car.getPos(45) // Absolute minute 45 = relative minute 0 for eastbound
    console.log('Car timePositions:', car.pos)
    console.log('Car position at 45:', pos)
    console.log('Tunnel relMins(45):', tunnel.relMins(45))
    
    expect(pos).toBeTruthy()
    expect(pos?.state).toBe('transiting')
    expect(pos?.x).toBe(0) // Tunnel entrance
  })
  
  it('should handle queued car', () => {
    const tunnel = new Tunnel(HOLLAND_TUNNEL_CONFIG.eastbound)
    const car = new Car({ 
      tunnel, 
      laneId: 'R', 
      spawnMin: 1,  // Spawns at tunnel-relative minute 1
      spawnQueue: { offsetPx: 30, minsBeforeDequeueing: 9 }
    })
    
    // At spawn time (absolute minute 46 = tunnel relative minute 1), car should be queued
    const pos = car.getPos(46)  // Absolute minute 46 = relative minute 1 for eastbound
    console.log('Queued car timePositions:', car.pos)
    console.log('Queued car position at 46:', pos)
    console.log('Car spawnMin:', car.spawnMin)
    
    expect(pos).toBeTruthy()
    expect(pos!.state).toBe('queued')
  })
})
