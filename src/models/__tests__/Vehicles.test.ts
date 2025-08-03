import { beforeEach, describe, expect, it } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnels } from '../Tunnels'

describe('Vehicle Subclasses', () => {
  let tunnels: Tunnels

  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
  })

  describe('SweepVehicle', () => {
    describe('Eastbound sweep', () => {
      it('should move at 12mph through tunnel', () => {
        const sweep = tunnels.sweepEast
        // Eastbound sweep starts at minute 50
        // At 12mph, should take 10 minutes to cross 2 miles

        // The sweep takes 10 minutes to cross the tunnel
        const points = sweep.points()
        expect(points[0].min).toBe(0) // Starts at vehicle time 0
        expect(points[0].val.x).toBe(0) // At tunnel entrance
        expect(points[1].min).toBe(10) // Exits at vehicle time 10
        expect(points[1].val.x).toBe(800) // At tunnel exit

        // This confirms the sweep is moving at 12mph (10 minutes to cross 2 miles)
      })
    })

    describe('Westbound sweep', () => {
      it('should move at 12mph through tunnel', () => {
        const sweep = tunnels.sweepWest
        // Westbound sweep starts at minute 20
        // At 12mph, should take 10 minutes to cross 2 miles

        const points = sweep.points()
        expect(points[0].min).toBe(0)
        expect(points[0].val.x).toBe(0)
        expect(points[1].min).toBe(10)
        expect(points[1].val.x).toBe(800)
      })
    })
  })

  describe('PaceVehicle', () => {
    describe('Eastbound pace', () => {
      it('should move at 24mph through tunnel', () => {
        const pace = tunnels.paceEast
        // Eastbound pace starts at minute 55
        // At 24mph, should take 5 minutes to cross 2 miles

        const points = pace.points()
        expect(points[0].min).toBe(0)
        expect(points[0].val.x).toBe(0)
        expect(points[1].min).toBe(5)
        expect(points[1].val.x).toBe(800)

        // This confirms pace car moves at 24mph (5 minutes to cross 2 miles)
      })
    })

    describe('Westbound pace', () => {
      it('should move at 24mph through tunnel', () => {
        const pace = tunnels.paceWest
        // Westbound pace starts at minute 25
        // At 24mph, should take 5 minutes to cross 2 miles

        const points = pace.points()
        expect(points[0].min).toBe(0)
        expect(points[0].val.x).toBe(0)
        expect(points[1].min).toBe(5)
        expect(points[1].val.x).toBe(800)
      })
    })
  })
})
