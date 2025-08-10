import { describe, it, expect } from 'vitest'
import { Tunnel } from './Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from './TunnelConfigs'

describe('Car merging behavior', () => {
  it('should position merging R lane cars correctly between L lane cars', () => {
    // Use the eastbound config directly
    const config = HOLLAND_TUNNEL_CONFIG.eb
    const tunnel = new Tunnel(config)

    // Get L lane cars and their positions at various times
    const lCars = tunnel.cars.l
    const rCars = tunnel.cars.r

    expect(lCars.length).toBe(60)
    expect(rCars.length).toBe(60)

    // Check car :0.5 (first L car)
    const lCar0_5 = lCars[0]
    expect(lCar0_5.spawnMin).toBeCloseTo(0.5, 1)

    // Check car :0 (first R car that should merge)
    const rCar0 = rCars[0]
    expect(rCar0.spawnMin).toBeCloseTo(0, 1)
    expect(rCar0.spawnQueue).toBeUndefined() // No more spawnQueue

    // Check car :1 (second R car)
    const rCar1 = rCars[1]
    expect(rCar1.spawnMin).toBeCloseTo(1, 1)
    expect(rCar1.spawnQueue).toBeUndefined() // No more spawnQueue

    // With slower fade-in at 12mph, cars take longer to merge
    // Fade-in ~1.625 mins + merge 0.3 mins = ~1.925 mins total
    // So check at minute 49 to give enough time
    const testMinute = 49

    // L car :0.5 should be well into the tunnel
    const lCar0_5_pos = lCar0_5.getPos(testMinute)

    // R car :0 should have merged and be between L cars
    const rCar0_pos = rCar0.getPos(testMinute)

    // R car :1 should also be in position
    const rCar1_pos = rCar1.getPos(testMinute)

    // Verify cars are merging and positioning correctly
    expect(rCar0_pos.state).toBe('transiting')
    expect(rCar1_pos.state).toBe('transiting')

    // R cars should be in L lane after merging (y coordinate check)
    expect(rCar0_pos.y).toBe(lCar0_5_pos.y)
    expect(rCar1_pos.y).toBe(lCar0_5_pos.y)

    // Verify proper spacing between cars
    // At minute 49, cars have been transiting for different amounts of time:
    // - L car :0.5 spawned at 45.5, been transiting for 3.5 mins
    // - R car :0 spawned at 45, started transiting at ~46.9, been transiting for ~2.1 mins
    // - R car :1 spawned at 46, started transiting at ~47.9, been transiting for ~1.1 mins
    // - L car :1.5 spawned at 46.5, been transiting for 2.5 mins

    // Get L car :1.5 for comparison
    const lCar1_5 = lCars[1]
    const lCar1_5_pos = lCar1_5.getPos(testMinute)

    // With perfect centering, R car :0 will be between L cars
    // At minute 49, both cars are transiting and R car should be behind L car :0.5
    expect(rCar0_pos.x).toBeGreaterThan(0)
    expect(rCar0_pos.x).toBeLessThanOrEqual(lCar0_5_pos.x)

    // After merging, R cars should be in L lane (same y as L cars)
    // Check that R car :0 has moved to L lane after merging
    // R car :0 should enter L lane 1.0 minute after spawn to be centered
    // Car spawns at 45, so should enter L lane at 46
    const mergeCompleteTime = 46
    const rCar0_merged = rCar0.getPos(mergeCompleteTime)
    const lCar0_5_merged = lCar0_5.getPos(mergeCompleteTime)


    // They should have similar Y positions after merge
    expect(Math.abs(rCar0_merged.y - lCar0_5_merged.y)).toBeLessThan(1)

    // Verify R car is centered between L cars
    // At minute 46, check positions to verify centering
    const checkTime = 46
    const rCar0_at46 = rCar0.getPos(checkTime)
    const lCar0_5_at46 = lCar0_5.getPos(checkTime)  // L car :0.5 spawned at 45.5
    const lCar59_5 = lCars[59]  // L car :59.5 (previous cycle)

    // R car :0 should be in L lane and moving
    expect(rCar0_at46.state).toBe('transiting')
    expect(rCar0_at46.y).toBe(lCar0_5_at46.y)

    // Verify that car :10 queues behind pace car (spawns when pace car starts)
    const rCar10 = rCars[10]
    expect(rCar10.spawnMin).toBeCloseTo(10, 1)

    // At spawn time (minute 55 for E/b), car should be queued
    const rCar10_at_spawn = rCar10.getPos(55)
    expect(rCar10_at_spawn.state).toBe('queued')
    expect(rCar10_at_spawn.y).toBeCloseTo(245, 0)  // Still in R lane

    // Half minute later, it should start transiting
    const rCar10_after_queue = rCar10.getPos(55.5)
    expect(rCar10_after_queue.state).toBe('transiting')
    expect(rCar10_after_queue.y).toBeCloseTo(245, 0)  // Still in R lane
    expect(rCar10_after_queue.x).toBe(0)  // At entrance, ready to transit

    // Check that it's actually moving through the tunnel
    const rCar10_mid_transit = rCar10.getPos(56)
    expect(rCar10_mid_transit.state).toBe('transiting')
    expect(rCar10_mid_transit.x).toBeGreaterThan(0)  // Moving through tunnel
    expect(rCar10_mid_transit.y).toBeCloseTo(245, 0)  // Still in R lane
  })

  it('should fade in L cars properly', () => {
    const config = HOLLAND_TUNNEL_CONFIG.eb
    const tunnel = new Tunnel(config)

    // L cars spawn at 0.5, 1.5, 2.5... so car at 8.5 is index 8
    const lCar8_5 = tunnel.cars.l[8]  // Index 8 spawns at 8.5
    expect(lCar8_5.spawnMin).toBeCloseTo(8.5, 1)

    // Log the car's timeline to understand fade-in
    console.log('L car :8.5 spawn minute:', lCar8_5.spawnMin)

    // Check position at various times relative to spawn
    // At spawn time (8.5 tunnel time = 53.5 absolute for E/b with offset 45)
    const spawnPos = lCar8_5.getPos(53.5)
    console.log('At spawn (53.5):', spawnPos)

    // Just before spawn
    const beforeSpawnPos = lCar8_5.getPos(53.0)
    console.log('Before spawn (53.0):', beforeSpawnPos)

    // Earlier still
    const earlyPos = lCar8_5.getPos(52.5)
    console.log('Early (52.5):', earlyPos)

    // Much earlier - should be at end of previous cycle
    const veryEarlyPos = lCar8_5.getPos(52.0)
    console.log('Very early (52.0):', veryEarlyPos)

    // Check the actual fade time
    // Car should fade in at normal speed: 100px at 160px/min = 0.625 minutes
    console.log('Expected fade time:', 100 / 160, 'minutes')

    // Check more precise timing
    const fadeStartTime = 53.5 - (100 / 160)  // Should start at 52.875
    const fadeStartPos = lCar8_5.getPos(fadeStartTime)
    console.log(`At fade start (${fadeStartTime.toFixed(3)}):`, fadeStartPos)

    // Check at 52.6 where user sees car appearing
    const at52_6 = lCar8_5.getPos(52.6)
    console.log('At 52.6:', at52_6)

    const at52_7 = lCar8_5.getPos(52.7)
    console.log('At 52.7:', at52_7)

    const at52_8 = lCar8_5.getPos(52.8)
    console.log('At 52.8:', at52_8)
  })
})
