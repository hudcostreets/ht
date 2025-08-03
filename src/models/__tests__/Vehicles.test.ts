import { entries } from "@rdub/base"
import { beforeEach, describe, expect, it } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnels } from '../Tunnels'
import { Pos } from '../types'

describe('Vehicle Subclasses', () => {
  let tunnels: Tunnels

  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
  })

  function check(
    vehicle: { getPos: (mins: number) => Pos; currentTunnel?: { config: { direction: string } } },
    min: number,
    expected: Partial<Pos> & { tunnel?: string },
  ) {
    const pos = vehicle.getPos(min)
    entries(expected).forEach(([key, value]) => {
      if (key === 'tunnel') {
        // Check which tunnel the vehicle is currently in
        expect(vehicle.currentTunnel?.config.direction).toBe(value)
      } else if (key === 'x' || key === 'y') {
        expect(pos![key]).toBeCloseTo(value as number, 0)
      } else {
        expect(pos![key]).toBe(value)
      }
    })
  }

  describe('GlobalSweep', () => {
    it('should transition between tunnels with continuous movement', () => {
      // Sweep follows bikes through tunnels with transitions
      // At 12mph, takes 10 minutes to cross 2 miles (800px)

      // Minute 0-5: Transitioning from east exit to west staging
      check(tunnels.sweep,  0  , { state:     'origin', x: 800  , opacity: 1 })
      check(tunnels.sweep,  2.5, { state:     'origin', x: 817.5, opacity: 1 }) // Halfway through transition
      check(tunnels.sweep,  5  , { state:     'origin', x: 835  , opacity: 1 })

      // Minute 5-19: Staging at west entrance
      check(tunnels.sweep, 10  , { state:     'origin', x: 835  , opacity: 1 })
      check(tunnels.sweep, 19  , { state:     'origin', x: 835  , opacity: 1 })

      // Minute 19-20: Moving from staging to entrance
      check(tunnels.sweep, 19.5, { state:     'origin', x: 817.5, opacity: 1 })
      check(tunnels.sweep, 20  , { state: 'transiting', x: 800  , opacity: 1 })

      // Minute 20-30: Transit westbound
      check(tunnels.sweep, 25  , { state: 'transiting', x: 400  , opacity: 1, tunnel: 'west' })
      check(tunnels.sweep, 30  , { state:    'exiting', x:   0  , opacity: 1, tunnel: 'west' })

      // Minute 30-35: Transitioning from west exit to east staging
      check(tunnels.sweep, 30.5, { state:     'origin', x:  -3.5, opacity: 1 })
      check(tunnels.sweep, 32.5, { state:     'origin', x: -17.5, opacity: 1 })
      check(tunnels.sweep, 35  , { state:     'origin', x: -35  , opacity: 1 })

      // Minute 35-49: Staging at east entrance
      check(tunnels.sweep, 40  , { state:     'origin', x: -35  , opacity: 1 })
      check(tunnels.sweep, 49  , { state:     'origin', x: -35  , opacity: 1 })

      // Minute 49-50: Moving from staging to entrance
      check(tunnels.sweep, 49.5, { state:     'origin', x: -17.5, opacity: 1 })
      check(tunnels.sweep, 50  , { state: 'transiting', x:   0  , opacity: 1 })

      // Minute 50-60: Transit eastbound
      check(tunnels.sweep, 50  , { state: 'transiting', x:   0, opacity: 1, tunnel: 'east' }) // At :50, sweep at E/b entrance
      check(tunnels.sweep, 55  , { state: 'transiting', x: 400, opacity: 1, tunnel: 'east' })
      check(tunnels.sweep, 59.9, { state: 'transiting', x: 792, opacity: 1, tunnel: 'east' })

      // Verify opacity is always 1
      check(tunnels.sweep,  0  , { opacity: 1 })
      check(tunnels.sweep, 15  , { opacity: 1 })
      check(tunnels.sweep, 30  , { opacity: 1 })
      check(tunnels.sweep, 45  , { opacity: 1 })
      check(tunnels.sweep, 59  , { opacity: 1 })
    })
  })

  describe('GlobalPace', () => {
    it('should transition between tunnels with continuous movement', () => {
      // Pace leads cars with transitions
      // At 24mph, takes 5 minutes to cross 2 miles (800px)

      // Minute 0-5: Transitioning from east exit to west staging
      check(tunnels.pace, 0, { state: 'origin', x: 800, opacity: 1 })
      check(tunnels.pace, 2.5, { state: 'origin', x: 830, opacity: 1 }) // Halfway through transition
      check(tunnels.pace, 5, { state: 'origin', x: 860, opacity: 1 })

      // Minute 5-24: Staging at west entrance
      check(tunnels.pace, 15, { state: 'origin', x: 860, opacity: 1 })
      check(tunnels.pace, 24, { state: 'origin', x: 860, opacity: 1 })

      // Minute 24-25: Moving from staging to entrance
      check(tunnels.pace, 24.5, { state: 'origin', x: 830, opacity: 1 })
      check(tunnels.pace, 25, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 25-30: Transit westbound
      check(tunnels.pace, 27.5, { state: 'transiting', x: 400, opacity: 1, tunnel: 'west' })
      check(tunnels.pace, 30, { state: 'exiting', x: 0, opacity: 1, tunnel: 'west' })

      // Minute 30-35: Transitioning from west exit to east staging
      check(tunnels.pace, 30.5, { state: 'origin', x: -6, opacity: 1 })
      check(tunnels.pace, 32.5, { state: 'origin', x: -30, opacity: 1 })
      check(tunnels.pace, 35, { state: 'origin', x: -60, opacity: 1 })

      // Minute 35-54: Staging at east entrance
      check(tunnels.pace, 45, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 54, { state: 'origin', x: -60, opacity: 1 })

      // Minute 54-55: Moving from staging to entrance
      check(tunnels.pace, 54.5, { state: 'origin', x: -30, opacity: 1 })
      check(tunnels.pace, 55, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 55-60: Transit eastbound
      check(tunnels.pace, 55, { state: 'transiting', x: 0, opacity: 1, tunnel: 'east' }) // At :55, pace at E/b entrance
      check(tunnels.pace, 57.5, { state: 'transiting', x: 400, opacity: 1, tunnel: 'east' })
      check(tunnels.pace, 59.99, { state: 'transiting', x: 798, opacity: 1, tunnel: 'east' })

      // Verify opacity is always 1
      check(tunnels.pace, 0, { opacity: 1 })
      check(tunnels.pace, 15, { opacity: 1 })
      check(tunnels.pace, 30, { opacity: 1 })
      check(tunnels.pace, 45, { opacity: 1 })
      check(tunnels.pace, 59, { opacity: 1 })
    })
  })
})
