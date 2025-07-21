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
      spawnMin: 46,
      spawnQueue: { offsetPx: 30, minsBeforeDequeueStart: 9 }
    })
    
    // At spawn time (relative minute 1), car should be queued
    const pos = car.getPos(46)
    console.log('Queued car timePositions:', car.pos)
    console.log('Queued car position at 46:', pos)
    
    expect(pos).toBeTruthy()
    expect(pos!.state).toBe('queued')
  })
})
