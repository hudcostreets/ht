import { describe, it, expect } from 'vitest'
import { TimeVal, Num } from '../TimeVal'

describe('TimeVal', () => {
  describe('Basic interpolation', () => {
    it('should interpolate between two points', () => {
      const tv = new TimeVal([
        { min: 0, val: 0 },
        { min: 10, val: 100 }
      ], Num)
      
      expect(tv.at(0)).toBe(0)
      expect(tv.at(5)).toBe(50)
      expect(tv.at(10)).toBe(100)
    })
    
    it('should handle multiple points', () => {
      const tv = new TimeVal([
        { min: 0, val: 0 },
        { min: 10, val: 100 },
        { min: 20, val: 50 }
      ], Num)
      
      expect(tv.at(0)).toBe(0)
      expect(tv.at(5)).toBe(50)
      expect(tv.at(10)).toBe(100)
      expect(tv.at(15)).toBe(75)
      expect(tv.at(20)).toBe(50)
    })
  })
  
  describe('Periodic/cyclic behavior', () => {
    it('should wrap around at period boundary', () => {
      const tv = new TimeVal([
        { min: 0, val: 0 },
        { min: 50, val: 100 },
        { min: 59, val: 200 }
      ], Num, 60) // 60 minute period
      
      // Test wraparound from end to beginning
      expect(tv.at(59)).toBe(200)
      expect(tv.at(59.5)).toBeCloseTo(100, 0) // Halfway between 59 (200) and 0 (0)
      expect(tv.at(60)).toBe(0) // Wraps to minute 0
      expect(tv.at(61)).toBeCloseTo(2, 0) // Same as minute 1
    })
    
    it('should interpolate across period boundary', () => {
      const tv = new TimeVal([
        { min: 0, val: 100 },
        { min: 55, val: 200 },
        { min: 59, val: 300 }
      ], Num, 60)
      
      // From minute 59 to minute 0 (next cycle)
      expect(tv.at(59)).toBe(300)
      expect(tv.at(59.5)).toBe(200) // Halfway between 300 and 100
      expect(tv.at(59.75)).toBe(150) // Three quarters
      expect(tv.at(0)).toBe(100)
    })
    
    it('should handle negative minutes with period', () => {
      const tv = new TimeVal([
        { min: 0, val: 0 },
        { min: 30, val: 100 }
      ], Num, 60)
      
      expect(tv.at(-1)).toBe(tv.at(59)) // -1 becomes 59
      expect(tv.at(-30)).toBe(tv.at(30)) // -30 becomes 30
    })
  })
  
  describe('Edge cases', () => {
    it('should return exact values at defined points', () => {
      const tv = new TimeVal([
        { min: 5, val: 50 },
        { min: 15, val: 150 },
        { min: 25, val: 75 }
      ], Num)
      
      expect(tv.at(5)).toBe(50)
      expect(tv.at(15)).toBe(150)
      expect(tv.at(25)).toBe(75)
    })
    
    it('should return first value before first point (non-periodic)', () => {
      const tv = new TimeVal([
        { min: 10, val: 100 },
        { min: 20, val: 200 }
      ], Num)
      
      expect(tv.at(0)).toBe(100)
      expect(tv.at(5)).toBe(100)
      expect(tv.at(9.9)).toBe(100)
    })
    
    it('should return last value after last point (non-periodic)', () => {
      const tv = new TimeVal([
        { min: 10, val: 100 },
        { min: 20, val: 200 }
      ], Num)
      
      expect(tv.at(20)).toBe(200)
      expect(tv.at(25)).toBe(200)
      expect(tv.at(100)).toBe(200)
    })
  })
  
  describe('Validation', () => {
    it('should throw error for non-ascending points', () => {
      expect(() => new TimeVal([
        { min: 10, val: 100 },
        { min: 5, val: 50 } // Out of order
      ], Num)).toThrow('strictly ascending')
    })
    
    it('should throw error for duplicate time points', () => {
      expect(() => new TimeVal([
        { min: 10, val: 100 },
        { min: 10, val: 200 } // Duplicate
      ], Num)).toThrow('strictly ascending')
    })
    
    it('should throw error for empty points', () => {
      expect(() => new TimeVal([], Num)).toThrow('at least one point')
    })
  })
})