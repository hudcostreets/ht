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

    // At minute 48 (3 minutes into blocked period for E/b), check positions
    // Note: E/b tunnel offset is 45, so tunnel-relative minute is 48-45=3
    // With the added wait time, cars need more time to complete merging
    const testMinute = 48

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
    // At minute 48, cars have been transiting for different amounts of time:
    // - L car :0.5 spawned at 45.5, been transiting for 2.5 mins
    // - R car :0 spawned at 45, started transiting at 46, been transiting for 2 mins
    // - R car :1 spawned at 46, started transiting at 47, been transiting for 1 min
    // - L car :1.5 spawned at 46.5, been transiting for 1.5 mins

    // Get L car :1.5 for comparison
    const lCar1_5 = lCars[1]
    const lCar1_5_pos = lCar1_5.getPos(testMinute)

    // R car :0 should be roughly midway between L car :0.5 and L car :1.5
    const expectedMidpoint = (lCar0_5_pos.x + lCar1_5_pos.x) / 2
    expect(Math.abs(rCar0_pos.x - expectedMidpoint)).toBeLessThan(20) // Within reasonable tolerance

    // After merging, R cars should be in L lane (same y as L cars)
    // Check that R car :0 has moved to L lane after merging
    // With wait time added, merge completes at 0.2 + 0.5 + 0.5 = 1.2 mins after spawn
    const mergeCompleteTime = 47 // After fade-in, wait, and merge
    const rCar0_merged = rCar0.getPos(mergeCompleteTime)
    const lCarY = lCar0_5.getPos(mergeCompleteTime).y

    // They should have similar Y positions after merge (within lane height)
    expect(Math.abs(rCar0_merged.y - lCarY)).toBeLessThan(5)

    // Verify that car :10 does NOT merge (spawns after pace car starts)
    const rCar10 = rCars[10]
    expect(rCar10.spawnMin).toBeCloseTo(10, 1)
    const rCar10_pos = rCar10.getPos(55) // Check at minute 55 (10 minutes after spawn)
    // Car :10 should stay in R lane (y=245), not merge to L lane (y=215)
    expect(rCar10_pos.y).toBeCloseTo(245, 0)
    expect(rCar10_pos.state).toBe('transiting')
  })
})
