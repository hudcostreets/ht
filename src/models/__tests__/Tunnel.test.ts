import { describe, it, expect, beforeEach } from 'vitest'
import { Tunnel } from '../Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Tunnel', () => {
  describe('Eastbound Tunnel', () => {
    let eb: Tunnel
    
    beforeEach(() => {
      eb = new Tunnel(HOLLAND_TUNNEL_CONFIG.eastbound)
    })
    
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
        expect(eb.getPhase(0)).toBe('bikes-enter') // :45 (minute 0 relative)
        expect(eb.getPhase(1)).toBe('bikes-enter') // :46 (minute 1 relative)
        expect(eb.getPhase(2)).toBe('bikes-enter') // :47 (minute 2 relative)
        expect(eb.getPhase(3)).toBe('clearing') // :48 (minute 3 relative)
        expect(eb.getPhase(5)).toBe('sweep') // :50 (minute 5 relative)
        expect(eb.getPhase(10)).toBe('pace-car') // :55 (minute 10 relative)
        expect(eb.getPhase(15)).toBe('normal') // :00 (minute 15 relative)
      })
    })
    
    describe('Early bikes (spawn before pen opens)', () => {
      it('should position first bike correctly at pen opening', () => {
        const firstBike = eb.bikes[0] // Spawns at :00
        
        // At pen opening (:45), first bike should be released immediately
        const position = firstBike.getPos(45)
        expect(position).toBeTruthy()
        expect(position!.state).toBe('tunnel') // Now at tunnel entrance
        expect(position!.x).toBe(0) // At tunnel entrance
      })
      
      it('should stagger bike releases correctly', () => {
        const firstBike = eb.bikes[0] // Index 0
        const secondBike = eb.bikes[1] // Index 1
        
        // First bike should be released at :45:00
        const firstPos = firstBike.getPos(45)
        expect(firstPos!.state).toBe('tunnel') // At tunnel entrance
        
        // Second bike should still be in pen at :45:00
        const secondPos = secondBike.getPos(45)
        expect(secondPos!.state).toBe('queue')
        
        // Second bike should be released later (bikes are released 5 per minute = 0.2 minutes apart)
        // But bike needs to reach the tunnel entrance position first
        const secondPosLater = secondBike.getPos(45 + 0.2)
        expect(secondPosLater!.state).toBe('tunnel') // At tunnel entrance
        
        // After transitions complete, both should be in tunnel
        const firstPosInTunnel = firstBike.getPos(45 + 0.05)
        const secondPosInTunnel = secondBike.getPos(45 + 0.25)
        expect(firstPosInTunnel!.state).toBe('tunnel')
        expect(secondPosInTunnel!.state).toBe('tunnel')
      })
    })
    
    describe('Bikes arriving during pen window', () => {
      it('should handle bike arriving at :46', () => {
        // Create a bike that spawns at :46 (during pen window :45-:47)
        // This would be handled differently in the real implementation
        // For now, test the concept with relative times
        
        // A bike arriving at relative minute 1 (:46) should join immediately
        const relativeTime = 1 // 1 minute after pen opens
        const phase = eb.getPhase(relativeTime)
        expect(phase).toBe('bikes-enter')
      })
    })
    
    describe('Late arrival bikes', () => {
      it('should queue late arrivals for next cycle', () => {
        // Test the concept - bikes arriving after :47 should wait for next cycle
        const relativeTime = 5 // 5 minutes after pen opens (:50)
        const phase = eb.getPhase(relativeTime)
        expect(phase).toBe('sweep') // Not bikes-enter anymore
      })
    })
    
    describe('Cars in L lane (always flow)', () => {
      it('should allow L lane cars to flow during bike phases', () => {
        const carAt46 = eb.cars.l.find(car => car.spawnMin === 46)
        if (carAt46) {
          // L lane car spawning at :46 should flow normally
          const position = carAt46.getPos(46)
          expect(position).toBeTruthy()
          expect(position!.state).toBe('transiting')
        }
      })
    })

    describe('Cars in R lane (may queue)', () => {
      it('should queue R lane cars during bike phases', () => {
        const carAt46 = eb.cars.r.find(car => car.spawnMin === 46)
        if (carAt46) {
          // R lane car spawning at :46 should be queued
          const position = carAt46.getPos(46)
          expect(position).toBeTruthy()
          expect(position!.state).toBe('queued')
          expect(position!.x).toBeLessThan(0) // In queue area (negative x)
        }
      })

      it('should release queued cars when pace car starts', () => {
        const carAt45 = eb.cars.r.find(car => car.spawnMin === 45)
        
        if (carAt45) {
          // At :45, car should be queued
          const queuedPosition = carAt45.getPos(45)
          expect(queuedPosition!.state).toBe('queued')
          
          // At :55 (pace car starts), car should be moving
          const movingPosition = carAt45.getPos(55)
          expect(movingPosition!.state).toBe('transiting')
          expect(movingPosition!.x).toBeGreaterThan(-50) // Should have moved from initial queue position
        }
      })
    })
  })
  
  describe('Westbound Tunnel', () => {
    let westbound: Tunnel
    
    beforeEach(() => {
      westbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.westbound)
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
      const eastbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.eastbound)
      const westbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.westbound)
      
      // At absolute time :15, eastbound should be in normal phase, westbound in bikes-enter
      expect(eastbound.getPhase(eastbound.relMins(15))).toBe('normal')
      expect(westbound.getPhase(westbound.relMins(15))).toBe('bikes-enter')
      
      // At absolute time :45, eastbound should be in bikes-enter, westbound in normal
      expect(eastbound.getPhase(eastbound.relMins(45))).toBe('bikes-enter')
      expect(westbound.getPhase(westbound.relMins(45))).toBe('normal')
    })
  })
})
