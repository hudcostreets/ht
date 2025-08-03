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
    vehicle: { getPos: (mins: number) => Pos },
    min: number,
    expected: Partial<Pos>,
  ) {
    const pos = vehicle.getPos(min)
    entries(expected).forEach(([key, value]) => {
      if (key === 'x' || key === 'y') {
        expect(pos![key]).toBeCloseTo(value as number, 5)
      } else {
        expect(pos![key]).toBe(value)
      }
    })
  }

  describe('GlobalSweep', () => {
    it('should complete a 60-minute round trip at 12mph', () => {
      // Sweep does a round trip through both tunnels
      // At 12mph, takes 10 minutes to cross 2 miles (800px)

      // Minute 0-4: Staging west
      check(tunnels.sweep, 0, { state: 'origin', x: -35, opacity: 1 })
      check(tunnels.sweep, 1, { state: 'origin', x: -35, opacity: 1 })
      check(tunnels.sweep, 4, { state: 'origin', x: -35, opacity: 1 })

      // Minute 5: Start eastbound
      check(tunnels.sweep, 5, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 10: Halfway through eastbound
      check(tunnels.sweep, 10, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 15: Exit eastbound
      check(tunnels.sweep, 15, { state: 'exiting', x: 800, opacity: 1 })

      // Minute 16-19: Staging east
      check(tunnels.sweep, 16, { state: 'origin', x: 835, opacity: 1 })
      check(tunnels.sweep, 19, { state: 'origin', x: 835, opacity: 1 })

      // Minute 20: Start westbound
      check(tunnels.sweep, 20, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 25: Halfway through westbound
      check(tunnels.sweep, 25, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 30: Exit westbound
      check(tunnels.sweep, 30, { state: 'exiting', x: 0, opacity: 1 })

      // Minute 31-34: Staging west
      check(tunnels.sweep, 31, { state: 'origin', x: -35, opacity: 1 })
      check(tunnels.sweep, 34, { state: 'origin', x: -35, opacity: 1 })

      // Minute 35: Start eastbound again
      check(tunnels.sweep, 35, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 40: Halfway through eastbound
      check(tunnels.sweep, 40, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 45: Exit eastbound
      check(tunnels.sweep, 45, { state: 'exiting', x: 800, opacity: 1 })

      // Minute 46-49: Staging east
      check(tunnels.sweep, 46, { state: 'origin', x: 835, opacity: 1 })
      check(tunnels.sweep, 49, { state: 'origin', x: 835, opacity: 1 })

      // Minute 50: Start westbound again
      check(tunnels.sweep, 50, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 55: Halfway through westbound
      check(tunnels.sweep, 55, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 59.9: Just before exit westbound
      check(tunnels.sweep, 59.9, { state: 'transiting', x: 8, opacity: 1 })
    })
  })

  describe('GlobalPace', () => {
    it('should complete a 60-minute round trip at 24mph', () => {
      // Pace does a round trip through both tunnels
      // At 24mph, takes 5 minutes to cross 2 miles (800px)

      // Minute 0-9: Staging west
      check(tunnels.pace, 0, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 1, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 9, { state: 'origin', x: -60, opacity: 1 })

      // Minute 10: Start eastbound
      check(tunnels.pace, 10, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 12.5: Halfway through eastbound
      check(tunnels.pace, 12.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 15: Exit eastbound
      check(tunnels.pace, 15, { state: 'exiting', x: 800, opacity: 1 })

      // Minute 16-24: Staging east
      check(tunnels.pace, 16, { state: 'origin', x: 860, opacity: 1 })
      check(tunnels.pace, 24, { state: 'origin', x: 860, opacity: 1 })

      // Minute 25: Start westbound
      check(tunnels.pace, 25, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 27.5: Halfway through westbound
      check(tunnels.pace, 27.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 30: Exit westbound
      check(tunnels.pace, 30, { state: 'exiting', x: 0, opacity: 1 })

      // Minute 31-39: Staging west
      check(tunnels.pace, 31, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 39, { state: 'origin', x: -60, opacity: 1 })

      // Minute 40: Start eastbound again
      check(tunnels.pace, 40, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 42.5: Halfway through eastbound
      check(tunnels.pace, 42.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 45: Exit eastbound
      check(tunnels.pace, 45, { state: 'exiting', x: 800, opacity: 1 })

      // Minute 46-54: Staging east
      check(tunnels.pace, 46, { state: 'origin', x: 860, opacity: 1 })
      check(tunnels.pace, 54, { state: 'origin', x: 860, opacity: 1 })

      // Minute 55: Start westbound again
      check(tunnels.pace, 55, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 57.5: Halfway through westbound
      check(tunnels.pace, 57.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 59.9: Just before exit westbound
      check(tunnels.pace, 59.9, { state: 'transiting', x: 16, opacity: 1 })
    })
  })
})
