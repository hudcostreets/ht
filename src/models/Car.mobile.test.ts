import { describe, it, expect, vi } from 'vitest'
import { Tunnel } from './Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from './TunnelConfigs'

describe('Car mobile width issues', () => {
  it('should not have duplicate points for R car :10 on mobile', () => {
    // Mock window width to very narrow mobile size
    vi.stubGlobal('window', { innerWidth: 375 })  // iPhone SE width

    // Create tunnel with mobile config
    const config = { ...HOLLAND_TUNNEL_CONFIG.eb }
    const tunnel = new Tunnel(config)

    // Get R car :10
    const rCar10 = tunnel.cars.r[10]
    expect(rCar10.spawnMin).toBeCloseTo(10, 1)

    // Get the raw points before normalization
    const rawPoints = (rCar10 as any)._points
    console.log('R car :10 raw points:', rawPoints.map((p: any) => p.min))

    // Get the points - this should not throw
    const points = rCar10.points()

    // Log the points to debug
    console.log('R car :10 normalized points:', points.map(p => p.min))

    // Check for duplicates
    const minutes = points.map(p => p.min)
    const uniqueMinutes = [...new Set(minutes)]

    if (minutes.length !== uniqueMinutes.length) {
      // Find duplicates
      const duplicates = minutes.filter((min, index) => minutes.indexOf(min) !== index)
      console.log('Duplicate minutes found:', duplicates)
      console.log('All minutes:', minutes)
    }

    expect(minutes.length).toBe(uniqueMinutes.length)

    // Check strictly ascending
    for (let i = 1; i < points.length; i++) {
      expect(points[i].min).toBeGreaterThan(points[i - 1].min)
    }

    // Clean up
    vi.unstubAllGlobals()
  })
})
