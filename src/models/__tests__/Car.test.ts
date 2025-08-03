import { describe, it, expect } from 'vitest'
import { Car } from '../Car'
import { Tunnel } from '../Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Car', () => {
  it('should create and position a normal flow car', () => {
    const tunnel = new Tunnel(HOLLAND_TUNNEL_CONFIG.eb)
    const car = new Car({
      tunnel,
      laneId: 'L',
      idx: 0,
      spawnMin: 5,
    })

    // At spawn time, car should be at tunnel entrance
    // Eastbound offset is 45, so relative minute 5 = absolute minute 50
    const pos = car.getPos(50)
    expect(pos.state).toBe('transiting')
    expect(pos.x).toBe(0) // Tunnel entrance
  })

  it('should handle queued car', () => {
    const tunnel = new Tunnel(HOLLAND_TUNNEL_CONFIG.eb)
    const car = new Car({
      tunnel,
      laneId: 'R',
      idx: 0,
      spawnMin: 0,
      spawnQueue: { offset: { x: 30, y: 0 }, minsBeforeDequeueing: 9, minsDequeueing: 1, }
    })

    // Check at absolute minute 45 (relative minute 0) when car spawns
    const pos = car.getPos(45)

    expect(pos).toBeTruthy()
    expect(pos!.state).toBe('queued')
  })
})
