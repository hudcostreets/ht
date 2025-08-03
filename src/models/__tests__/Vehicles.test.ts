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
    it('should follow eastbound bikes from :50 to :00', () => {
      // Sweep follows bikes through tunnels
      // At 12mph, takes 10 minutes to cross 2 miles (800px)

      // Minute 0-19: Staging east (from previous eastbound run)
      check(tunnels.sweep, 0, { state: 'origin', x: 835, opacity: 1 })
      check(tunnels.sweep, 10, { state: 'origin', x: 835, opacity: 1 })
      check(tunnels.sweep, 19, { state: 'origin', x: 835, opacity: 1 })

      // Minute 20: Start westbound
      check(tunnels.sweep, 20, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 25: Halfway through westbound
      check(tunnels.sweep, 25, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 30: Exit westbound
      check(tunnels.sweep, 30, { state: 'exiting', x: 0, opacity: 1 })

      // Minute 31-49: Staging west
      check(tunnels.sweep, 31, { state: 'origin', x: -35, opacity: 1 })
      check(tunnels.sweep, 40, { state: 'origin', x: -35, opacity: 1 })
      check(tunnels.sweep, 49, { state: 'origin', x: -35, opacity: 1 })

      // Minute 50: Start eastbound (following bikes that entered at :45)
      check(tunnels.sweep, 50, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 55: Halfway through eastbound
      check(tunnels.sweep, 55, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 59.9: Just before exit eastbound
      check(tunnels.sweep, 59.9, { state: 'transiting', x: 792, opacity: 1 })

      // Verify direction
      tunnels.sweep.getPos(55)
      expect(tunnels.sweep.currentTunnel?.config.direction).toBe('east')
    })
  })

  describe('GlobalPace', () => {
    it('should lead cars eastbound from :55 to :00', () => {
      // Pace leads cars after bikes
      // At 24mph, takes 5 minutes to cross 2 miles (800px)

      // Minute 0-24: Staging east (from previous eastbound run)
      check(tunnels.pace, 0, { state: 'origin', x: 860, opacity: 1 })
      check(tunnels.pace, 10, { state: 'origin', x: 860, opacity: 1 })
      check(tunnels.pace, 24, { state: 'origin', x: 860, opacity: 1 })

      // Minute 25: Start westbound
      check(tunnels.pace, 25, { state: 'transiting', x: 800, opacity: 1 })

      // Minute 27.5: Halfway through westbound
      check(tunnels.pace, 27.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 30: Exit westbound
      check(tunnels.pace, 30, { state: 'exiting', x: 0, opacity: 1 })

      // Minute 31-54: Staging west
      check(tunnels.pace, 31, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 40, { state: 'origin', x: -60, opacity: 1 })
      check(tunnels.pace, 54, { state: 'origin', x: -60, opacity: 1 })

      // Minute 55: Start eastbound (leading cars after bikes)
      check(tunnels.pace, 55, { state: 'transiting', x: 0, opacity: 1 })

      // Minute 57.5: Halfway through eastbound
      check(tunnels.pace, 57.5, { state: 'transiting', x: 400, opacity: 1 })

      // Minute 59.9: Just before exit eastbound
      check(tunnels.pace, 59.9, { state: 'transiting', x: 784, opacity: 1 })

      // Verify direction
      tunnels.pace.getPos(57)
      expect(tunnels.pace.currentTunnel?.config.direction).toBe('east')
    })
  })
})
