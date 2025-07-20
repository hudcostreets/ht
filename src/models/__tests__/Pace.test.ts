import { describe, it, expect, beforeEach } from 'vitest'
import { Pace } from '../Pace'
import { Tunnels } from '../Tunnels'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Pace', () => {
  let tunnels: Tunnels
  let pace: Pace
  
  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
    pace = new Pace(tunnels)
  })
  
  describe('Position at key minutes', () => {
    it('should be at westbound staging at minute 0', () => {
      const pos = pace.getPosition(0)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(860) // tunnel width (800) + staging offset (60)
      expect(pos!.y).toBe(15) // R lane top (0.5 * 30)
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('west')
    })
    
    it('should still be at westbound staging at minute 4', () => {
      const pos = pace.getPosition(4)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(860)
      expect(pos!.y).toBe(15)
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('west')
    })
    
    it('should start leading westbound cars at minute 25', () => {
      const pos = pace.getPosition(25)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(800) // tunnel entrance (west)
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('west')
    })
    
    it('should be halfway through westbound tunnel at minute 27.5', () => {
      const pos = pace.getPosition(27.5)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(400) // halfway through tunnel
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('west')
    })
    
    it('should exit westbound tunnel at minute 30', () => {
      const pos = pace.getPosition(30)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(0) // tunnel exit (west)
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('exiting')
      expect(pos!.direction).toBe('west')
    })
    
    it('should be at eastbound staging at minute 34', () => {
      const pos = pace.getPosition(34)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(-60) // staging offset
      expect(pos!.y).toBe(45) // R lane bottom (1.5 * 30)
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('east')
    })
    
    it('should start leading eastbound cars at minute 55', () => {
      const pos = pace.getPosition(55)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(0) // tunnel entrance (east)
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('east')
    })
    
    it('should be partway through eastbound tunnel at minute 59', () => {
      const pos = pace.getPosition(59)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(640) // 80% through tunnel
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('east')
    })
  })
  
  describe('Transitions', () => {
    it('should smoothly transition from west exit to east staging', () => {
      // Between minutes 30 and 34
      const pos1 = pace.getPosition(31)
      const pos2 = pace.getPosition(32)
      const pos3 = pace.getPosition(33)
      
      // X position should decrease (moving left)
      expect(pos1!.x).toBeGreaterThan(pos2!.x)
      expect(pos2!.x).toBeGreaterThan(pos3!.x)
      
      // Should transition from exiting to staging
      expect(pos1!.state).toBe('exiting') // 31 - still exiting
      expect(pos2!.state).toBe('exiting') // 32 - still exiting
      expect(pos3!.state).toBe('exiting') // 33 - still exiting
    })
    
    it('should have consistent movement speed through tunnel', () => {
      // During westbound pace
      const pos1 = pace.getPosition(26)
      const pos2 = pace.getPosition(27)
      const pos3 = pace.getPosition(28)
      const pos4 = pace.getPosition(29)
      
      // Should move at constant speed
      const dist1 = pos1!.x - pos2!.x
      const dist2 = pos2!.x - pos3!.x
      const dist3 = pos3!.x - pos4!.x
      
      expect(dist1).toBeCloseTo(dist2, 1)
      expect(dist2).toBeCloseTo(dist3, 1)
    })
  })
  
  describe('Wraparound behavior', () => {
    it('should handle transition from minute 59 to 0', () => {
      // Pace car continues eastbound from 59 to 0
      const pos59 = pace.getPosition(59)
      const pos0 = pace.getPosition(0)
      
      // At 59, still in eastbound tunnel
      expect(pos59!.state).toBe('tunnel')
      expect(pos59!.direction).toBe('east')
      
      // At 0, at westbound staging (wrapped around)
      expect(pos0!.state).toBe('staging')
      expect(pos0!.direction).toBe('west')
    })
  })
})