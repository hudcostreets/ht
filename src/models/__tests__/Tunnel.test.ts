import { entries } from "@rdub/base"
import { beforeEach, describe, expect, it } from 'vitest'
import { Tunnel } from '../Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Pos } from '../types'

describe('Tunnel', () => {
  describe('Eastbound Tunnel', () => {
    let eb: Tunnel

    beforeEach(() => {
      eb = new Tunnel(HOLLAND_TUNNEL_CONFIG.eb)
    })

    function check(
      bikeIdx: number,
      min: number,
      expected: Partial<Pos>,
    ) {
      const bike = eb.bikes.find(({ id }) => id == bikeIdx.toString())!
      const pos = bike.getPos(min)
      entries(expected).forEach(([key, value]) => {
        expect(pos![key]).toBe(value)
      })
    }

    describe('Time conversion', () => {
      it('should convert absolute time to relative time correctly', () => {
        expect(eb.relMins(45)).toBe(0)
        expect(eb.relMins(46)).toBe(1)
        expect(eb.relMins(44)).toBe(59) // 59 minutes later in relative time
        expect(eb.relMins(60 + 45)).toBe(0) // Next hour, minute 45
      })
    })

    describe('Phase detection', () => {
      it('should return correct phases for relative times', () => {
        expect(eb.getPhase( 0)).toBe('bikes-enter') // :45 (minute 0 relative)
        expect(eb.getPhase( 1)).toBe('bikes-enter') // :46 (minute 1 relative)
        expect(eb.getPhase( 2)).toBe('bikes-enter') // :47 (minute 2 relative)
        expect(eb.getPhase( 3)).toBe('clearing') // :48 (minute 3 relative)
        expect(eb.getPhase( 5)).toBe('sweep') // :50 (minute 5 relative)
        expect(eb.getPhase(10)).toBe('pace-car') // :55 (minute 10 relative)
        expect(eb.getPhase(15)).toBe('normal') // :00 (minute 15 relative)
      })
    })

    describe('Early bikes (spawn before pen opens)', () => {
      it('should position bike 1.2 correctly', () => {
        // At pen opening (:45), first bike should be released immediately
        // Note: This is a split bike, so positions are from pre-calculated points
        check(1.2, 45  , { state: 'dequeueing', x:  -60, opacity: 1, }) // In queue at pen (centered)
        check(1.2, 45.1, { state: 'dequeueing', x:  -30, opacity: 1, }) // Dequeueing from pen
        check(1.2, 45.2, { state: 'transiting', x:    0, opacity: 1, }) // Entering
        check(1.2, 49.2, { state: 'transiting', x:  400, opacity: 1, }) // Halfway
        check(1.2, 56.7, { state:    'exiting', x:  800, opacity: 1, }) // Exiting
        check(1.2, 57.7, { state:       'done', x:  880, opacity: 0, }) // Faded out
        check(1.2, 58.7, { state:     'origin', x: -140, opacity: 0, }) // Reset at origin
        check(1.2, 59.7, { state:     'queued', x:  -60, opacity: 1, }) // Re-enqueued at pen
        check(1.2,  0  , { state:     'queued', x:  -60, opacity: 1, }) // In queue at pen
        check(1.2,  1  , { state:     'queued', x:  -60, opacity: 1, }) // In queue at pen
        check(1.2, 44  , { state:     'queued', x:  -60, opacity: 1, }) // In queue at pen
      })

      it('should position bike 0 correctly', () => {
        // Bike "0" arrives at :45 to a full queue, enters tunnel just before pen closes at :48
        check(0, 44  , { state:     'origin', x: -60, opacity: 0, }) // Origin near pen
        check(0, 45  , { state: 'dequeueing', x:  20, opacity: 1, }) // Dequeueing from pen
        check(0, 46.5, { state: 'dequeueing', x:  10, opacity: 1, }) // Moving towards entrance
        check(0, 48  , { state: 'transiting', x:   0, opacity: 1, })
        check(0, 52  , { state: 'transiting', x: 400, opacity: 1, })
        check(0, 59.5, { state:    'exiting', x: 800, opacity: 1, })
        check(0,  0.5, { state:       'done', x: 880, opacity: 0, })
        check(0,  1.5, { state:     'origin', x: -60, opacity: 0, }) // Origin near pen
        check(0,  2.5, { state:     'origin', x: -60, opacity: 0, }) // Origin near pen
        check(0, 43  , { state:     'origin', x: -60, opacity: 0, }) // Origin near pen
      })
    })
  })

  describe('Westbound Tunnel', () => {
    let westbound: Tunnel

    beforeEach(() => {
      westbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.wb)
    })

    describe('Time conversion', () => {
      it('should convert absolute time to relative time correctly', () => {
        // At 15 minutes (pen opens), relative time should be 0
        expect(westbound.relMins(15)).toBe(0)

        // At 16 minutes, relative time should be 1
        expect(westbound.relMins(16)).toBe(1)

        // At 14 minutes (before pen opens), should wrap around
        expect(westbound.relMins(14)).toBe(59) // 59 minutes later in relative time
      })
    })

    describe('Westbound-specific behavior', () => {
      it('should handle :16 westbound bike correctly', () => {
        // A bike spawning at :16 should be able to join the traveling group
        const relativeTime = 1 // 1 minute after pen opens (:16)
        const phase = westbound.getPhase(relativeTime)
        expect(phase).toBe('bikes-enter')
      })

      it('should queue :20 westbound bike for next cycle', () => {
        // A bike spawning at :20 should wait for next cycle
        const relativeTime = 5 // 5 minutes after pen opens (:20)
        const phase = westbound.getPhase(relativeTime)
        expect(phase).toBe('sweep') // Past the bikes-enter phase
      })
    })
  })

  describe('Cross-tunnel coordination', () => {
    it('should have offset schedules (E at :45, W at :15)', () => {
      const eastbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.eb)
      const westbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.wb)

      // At absolute time :15, eastbound should be in normal phase, westbound in bikes-enter
      expect(eastbound.getPhase(eastbound.relMins(15))).toBe('normal')
      expect(westbound.getPhase(westbound.relMins(15))).toBe('bikes-enter')

      // At absolute time :45, eastbound should be in bikes-enter, westbound in normal
      expect(eastbound.getPhase(eastbound.relMins(45))).toBe('bikes-enter')
      expect(westbound.getPhase(westbound.relMins(45))).toBe('normal')
    })
  })
})
