import { describe, it, expect, beforeEach } from 'vitest'
import { Sweep } from '../Sweep'
import { Tunnels } from '../Tunnels'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Sweep', () => {
  let tunnels: Tunnels
  let sweep: Sweep
  
  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
    sweep = new Sweep(tunnels)
  })
  
  describe('Position at key minutes', () => {
    it('should be at eastbound staging at minute 0', () => {
      const pos = sweep.getPosition(0)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(-35) // staging offset
      expect(pos!.y).toBe(45) // R lane bottom (1.5 * 30)
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('east')
    })
    
    it('should be at westbound staging at minute 5', () => {
      const pos = sweep.getPosition(5)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(835) // tunnel width (800) + staging offset (35)
      expect(pos!.y).toBe(15) // R lane top (0.5 * 30)
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('west')
    })
    
    it('should start sweeping westbound at minute 20', () => {
      const pos = sweep.getPosition(20)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(800) // tunnel entrance (west)
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('west')
    })
    
    it('should be halfway through westbound sweep at minute 22.5', () => {
      const pos = sweep.getPosition(22.5)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(400) // halfway through tunnel
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('west')
    })
    
    it('should complete westbound sweep at minute 25', () => {
      const pos = sweep.getPosition(25)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(0) // tunnel exit (west)
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('exiting')
      expect(pos!.direction).toBe('west')
    })
    
    it('should be at eastbound staging at minute 35', () => {
      const pos = sweep.getPosition(35)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(-35) // staging offset
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('east')
    })
    
    it('should start sweeping eastbound at minute 50', () => {
      const pos = sweep.getPosition(50)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(0) // tunnel entrance (east)
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('east')
    })
    
    it('should be halfway through eastbound sweep at minute 52.5', () => {
      const pos = sweep.getPosition(52.5)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(400) // halfway through tunnel
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('tunnel')
      expect(pos!.direction).toBe('east')
    })
    
    it('should complete eastbound sweep at minute 55', () => {
      const pos = sweep.getPosition(55)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(800) // tunnel exit (east)
      expect(pos!.y).toBe(45) // R lane bottom
      expect(pos!.state).toBe('exiting')
      expect(pos!.direction).toBe('east')
    })
    
    it('should be at westbound staging at minute 59', () => {
      const pos = sweep.getPosition(59)
      expect(pos).toBeTruthy()
      expect(pos!.x).toBe(835) // tunnel width + staging offset
      expect(pos!.y).toBe(15) // R lane top
      expect(pos!.state).toBe('staging')
      expect(pos!.direction).toBe('west')
    })
  })
  
  describe('Transitions', () => {
    it('should smoothly transition from eastbound to westbound staging', () => {
      // At minute 2.5 (halfway between 0 and 5)
      const pos = sweep.getPosition(2.5)
      expect(pos!.x).toBeCloseTo(400, 0) // Halfway between -35 and 835
      expect(pos!.y).toBeCloseTo(30, 0) // Halfway between 45 and 15
    })
    
    it('should smoothly transition position during sweep', () => {
      // During eastbound sweep
      const pos1 = sweep.getPosition(51)
      const pos2 = sweep.getPosition(52)
      const pos3 = sweep.getPosition(53)
      
      expect(pos1!.x).toBeLessThan(pos2!.x)
      expect(pos2!.x).toBeLessThan(pos3!.x)
      expect(pos1!.state).toBe('tunnel')
      expect(pos2!.state).toBe('tunnel')
      expect(pos3!.state).toBe('tunnel')
    })
  })
})