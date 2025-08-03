import { describe, it, expect, beforeEach } from 'vitest'
import { ColorRectangles } from '../ColorRectangles'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnels } from '../Tunnels'

describe('ColorRectangles', () => {
  let tunnels: Tunnels
  let colorRects: ColorRectangles

  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
    colorRects = new ColorRectangles(tunnels)
  })

  describe('Eastbound rectangles', () => {
    it('should have no rectangles before bikes enter', () => {
      const rects = colorRects.getRectangles(44)
      const eastRects = rects.filter(r => r.direction === 'east')
      expect(eastRects).toHaveLength(0)
    })

    it('should start growing green rectangle at minute 45', () => {
      const rects = colorRects.getRectangles(45)
      const eastRects = rects.filter(r => r.direction === 'east')

      // At exactly minute 45, green width is 0, so no rectangles yet
      expect(eastRects).toHaveLength(0)
    })

    it('should have growing green rectangle at minute 46.5', () => {
      const rects = colorRects.getRectangles(46.5)
      const eastRects = rects.filter(r => r.direction === 'east')

      expect(eastRects).toHaveLength(2)

      // Green rectangle
      const green = eastRects.find(r => r.color === 'green')!
      expect(green.x).toBe(0)
      expect(green.width).toBeCloseTo(400, 0) // Halfway

      // Red rectangle
      const red = eastRects.find(r => r.color === 'red')!
      expect(red.x).toBeCloseTo(400, 0)
      expect(red.width).toBeCloseTo(400, 0)
    })

    it('should have full green rectangle at minute 48', () => {
      const rects = colorRects.getRectangles(48)
      const eastRects = rects.filter(r => r.direction === 'east')

      expect(eastRects).toHaveLength(1)
      expect(eastRects[0].color).toBe('green')
      expect(eastRects[0].x).toBe(0)
      expect(eastRects[0].width).toBe(800)
    })

    it('should maintain full green through sweep phase', () => {
      // Check minutes 50-55
      for (let min = 50; min <= 55; min++) {
        const rects = colorRects.getRectangles(min)
        const eastRects = rects.filter(r => r.direction === 'east')

        expect(eastRects).toHaveLength(1)
        expect(eastRects[0].color).toBe('green')
        expect(eastRects[0].width).toBe(800)
      }
    })

    it('should have no rectangles after pace car starts', () => {
      const rects = colorRects.getRectangles(56)
      const eastRects = rects.filter(r => r.direction === 'east')
      expect(eastRects).toHaveLength(0)
    })
  })

  describe('Westbound rectangles', () => {
    it('should have no rectangles before bikes enter', () => {
      const rects = colorRects.getRectangles(14)
      const westRects = rects.filter(r => r.direction === 'west')
      expect(westRects).toHaveLength(0)
    })

    it('should start with full red at minute 15', () => {
      const rects = colorRects.getRectangles(15)
      const westRects = rects.filter(r => r.direction === 'west')

      // At exactly minute 15, no change yet
      expect(westRects).toHaveLength(0)
    })

    it('should have shrinking red rectangle at minute 16.5', () => {
      const rects = colorRects.getRectangles(16.5)
      const westRects = rects.filter(r => r.direction === 'west')

      expect(westRects).toHaveLength(2)

      // Red rectangle (shrinking)
      const red = westRects.find(r => r.color === 'red')!
      expect(red.x).toBe(0)
      expect(red.width).toBeCloseTo(400, 0) // Halfway

      // Green rectangle (growing)
      const green = westRects.find(r => r.color === 'green')!
      expect(green.x).toBeCloseTo(400, 0)
      expect(green.width).toBeCloseTo(400, 0)
    })

    it('should have full green rectangle at minute 18', () => {
      const rects = colorRects.getRectangles(18)
      const westRects = rects.filter(r => r.direction === 'west')

      expect(westRects).toHaveLength(1)
      expect(westRects[0].color).toBe('green')
      expect(westRects[0].x).toBe(0)
      expect(westRects[0].width).toBe(800)
    })

    it('should maintain full green through sweep phase', () => {
      // Check minutes 20-25
      for (let min = 20; min <= 25; min++) {
        const rects = colorRects.getRectangles(min)
        const westRects = rects.filter(r => r.direction === 'west')

        expect(westRects).toHaveLength(1)
        expect(westRects[0].color).toBe('green')
        expect(westRects[0].width).toBe(800)
      }
    })

    it('should have no rectangles after pace car starts', () => {
      const rects = colorRects.getRectangles(26)
      const westRects = rects.filter(r => r.direction === 'west')
      expect(westRects).toHaveLength(0)
    })
  })

  describe('Rectangle properties', () => {
    it('should have correct height for all rectangles', () => {
      const rects = colorRects.getRectangles(46.5)

      for (const rect of rects) {
        expect(rect.height).toBe(30) // Lane height
      }
    })

    it('should position eastbound rectangles in bottom lane', () => {
      const rects = colorRects.getRectangles(46.5)
      const eastRects = rects.filter(r => r.direction === 'east')

      for (const rect of eastRects) {
        expect(rect.y).toBe(30) // Bottom lane
      }
    })

    it('should position westbound rectangles in top lane', () => {
      const rects = colorRects.getRectangles(16.5)
      const westRects = rects.filter(r => r.direction === 'west')

      for (const rect of westRects) {
        expect(rect.y).toBe(0) // Top lane
      }
    })
  })
})
