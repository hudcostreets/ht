import { entries } from "@rdub/base"
import { describe, expect, it } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnels } from '../Tunnels'
import { Pos } from '../types'

describe('Vehicle Subclasses', () => {
  const tunnels: Tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
  const { sweep, pace } = tunnels

  function check(
    vehicle: { getPos: (mins: number) => Pos },
    min: number,
    expected: Partial<Pos>,
  ) {
    const pos = vehicle.getPos(min)
    entries(expected).forEach(([key, value]) => {
      if (key === 'x' || key === 'y') {
        expect(pos![key]).toBeCloseTo(value as number, 0)
      } else {
        expect(pos![key]).toBe(value)
      }
    })
  }

  describe('Sweep', () => {
    it('should transition between tunnels with continuous movement', () => {
      // Sweep follows bikes through tunnels with transitions
      // At 12mph, takes 10 minutes to cross 2 miles (800px)

      // Minute 0-5: Transitioning from east exit to west staging
      // Y offsets: E/b at y=200, W/b at y=100
      // R lane: E/b at y=45, W/b at y=15
      check(sweep,  0  , { state:    'exiting', x: 800  , y: 245, opacity: 1 })  // E/b R lane: 45 + 200
      check(sweep,  5  , { state:     'queued', x: 835  , y: 85, opacity: 1 })  // W/b staging: 115 - 30

      // Minute 5-18: Staging at west entrance (above lane)
      check(sweep, 10  , { state:     'queued', x: 835  , y: 85, opacity: 1 })
      check(sweep, 18  , { state:     'queued', x: 835  , y: 85, opacity: 1 })

      // Minute 19-20: Moving from staging to entrance
      check(sweep, 19.5, { state:     'dequeueing', x: 817.5, y: 100, opacity: 1 })  // Interpolating y from 85 to 115
      check(sweep, 20  , { state: 'transiting', x: 800  , y: 115, opacity: 1 })

      // Minute 20-30: Transit westbound
      check(sweep, 25  , { state: 'transiting', x: 400  , opacity: 1 })
      check(sweep, 30  , { state:    'exiting', x:   0  , opacity: 1 })

      // Minute 30-35: Transitioning from west exit to east staging
      check(sweep, 30  , { state:     'exiting', x:   0  , y: 115, opacity: 1 })  // W/b R lane: 15 + 100
      check(sweep, 35  , { state:     'queued', x: -35  , y: 275, opacity: 1 })  // E/b staging: 245 + 30

      // Minute 35-48: Staging at east entrance (below lane)
      check(sweep, 40  , { state:     'queued', x: -35  , y: 275, opacity: 1 })
      check(sweep, 48  , { state:     'queued', x: -35  , y: 275, opacity: 1 })

      // Minute 49-50: Moving from staging to entrance
      check(sweep, 49.5, { state:     'dequeueing', x: -17.5, y: 260, opacity: 1 })  // Interpolating y from 275 to 245
      check(sweep, 50  , { state: 'transiting', x:   0  , y: 245, opacity: 1 })

      // Minute 50-60: Transit eastbound
      check(sweep, 50  , { state: 'transiting', x:   0, opacity: 1 }) // At :50, sweep at E/b entrance
      check(sweep, 55  , { state: 'transiting', x: 400, opacity: 1 })
      check(sweep, 59.9, { state: 'transiting', x: 792, opacity: 1 })

      // Verify opacity is always 1
      check(sweep,  0  , { opacity: 1 })
      check(sweep, 15  , { opacity: 1 })
      check(sweep, 30  , { opacity: 1 })
      check(sweep, 45  , { opacity: 1 })
      check(sweep, 59  , { opacity: 1 })
    })
  })

  describe('Pace', () => {
    it('should transition between tunnels with continuous movement', () => {
      // Pace leads cars with transitions
      // At 24mph, takes 5 minutes to cross 2 miles (800px)

      // Minute 0-5: Transitioning from east exit to west staging
      check(pace, 0, { state: 'exiting', x: 800, opacity: 1 })
      check(pace, 5, { state: 'queued', x: 860, y: 85, opacity: 1 })  // W/b staging: 115 - 30

      // Minute 5-23: Staging at west entrance (above lane)
      check(pace, 15, { state: 'queued', x: 860, y: 85, opacity: 1 })
      check(pace, 23, { state: 'queued', x: 860, y: 85, opacity: 1 })

      // Minute 24-25: Moving from staging to entrance
      check(pace, 24.5, { state: 'dequeueing', x: 830, y: 100, opacity: 1 })  // Interpolating y from 85 to 115
      check(pace, 25, { state: 'transiting', x: 800, y: 115, opacity: 1 })

      // Minute 25-30: Transit westbound
      check(pace, 27.5, { state: 'transiting', x: 400, opacity: 1 })
      check(pace, 30, { state: 'exiting', x: 0, opacity: 1 })

      // Minute 30-35: Transitioning from west exit to east staging
      check(pace, 30, { state: 'exiting', x: 0, opacity: 1 })
      check(pace, 35, { state: 'queued', x: -60, y: 275, opacity: 1 })  // E/b staging: 245 + 30

      // Minute 35-53: Staging at east entrance (below lane)
      check(pace, 45, { state: 'queued', x: -60, y: 275, opacity: 1 })
      check(pace, 53, { state: 'queued', x: -60, y: 275, opacity: 1 })

      // Minute 54-55: Moving from staging to entrance
      check(pace, 54.5, { state: 'dequeueing', x: -30, y: 260, opacity: 1 })  // Interpolating y from 275 to 245
      check(pace, 55, { state: 'transiting', x: 0, y: 245, opacity: 1 })

      // Minute 55-60: Transit eastbound
      check(pace, 55, { state: 'transiting', x: 0, opacity: 1 }) // At :55, pace at E/b entrance
      check(pace, 57.5, { state: 'transiting', x: 400, opacity: 1 })
      check(pace, 59.99, { state: 'transiting', x: 798, opacity: 1 })

      // Verify opacity is always 1
      check(pace, 0, { opacity: 1 })
      check(pace, 15, { opacity: 1 })
      check(pace, 30, { opacity: 1 })
      check(pace, 45, { opacity: 1 })
      check(pace, 59, { opacity: 1 })
    })
  })
})
