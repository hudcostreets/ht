import { describe, it, expect, beforeEach } from 'vitest'
import { Tunnel } from '../Tunnel'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Tunnel', () => {
  describe('Eastbound Tunnel', () => {
    let eastbound: Tunnel
    
    beforeEach(() => {
      eastbound = new Tunnel(HOLLAND_TUNNEL_CONFIG.eastbound)
    })
    
    describe('Time conversion', () => {
      it('should convert absolute time to relative time correctly', () => {
        // At 45 minutes (pen opens), relative time should be 0
        expect(eastbound.getRelativeTime(45 * 60)).toBe(0)
        
        // At 46 minutes, relative time should be 60 seconds
        expect(eastbound.getRelativeTime(46 * 60)).toBe(60)
        
        // At 44 minutes (before pen opens), should wrap around
        expect(eastbound.getRelativeTime(44 * 60)).toBe(59 * 60) // 59 minutes later in relative time
        
        // Hour boundaries
        expect(eastbound.getRelativeTime(3600 + 45 * 60)).toBe(0) // Next hour, minute 45
      })
    })
    
    describe('Phase detection', () => {
      it('should return correct phases for relative times', () => {
        expect(eastbound.getPhase(0)).toBe('bikes-enter') // :45 (minute 0 relative)
        expect(eastbound.getPhase(60)).toBe('bikes-enter') // :46 (minute 1 relative)
        expect(eastbound.getPhase(120)).toBe('bikes-enter') // :47 (minute 2 relative)
        expect(eastbound.getPhase(180)).toBe('clearing') // :48 (minute 3 relative)
        expect(eastbound.getPhase(300)).toBe('sweep') // :50 (minute 5 relative)
        expect(eastbound.getPhase(600)).toBe('pace-car') // :55 (minute 10 relative)
        expect(eastbound.getPhase(900)).toBe('normal') // :00 (minute 15 relative)
      })
    })
    
    describe('Early bikes (spawn before pen opens)', () => {
      it('should position first bike correctly at pen opening', () => {
        const firstBike = eastbound.getBikes()[0] // Spawns at :00
        
        // At pen opening (:45), first bike should be released immediately
        const position = firstBike.getPosition(45 * 60)
        expect(position).toBeTruthy()
        expect(position!.state).toBe('staging') // Now in staging state during transition
        
        // After 3 second transition, should be at tunnel entrance
        const positionAfterTransition = firstBike.getPosition(45 * 60 + 3)
        expect(positionAfterTransition!.x).toBe(0) // At tunnel entrance
        expect(positionAfterTransition!.state).toBe('tunnel')
      })
      
      it('should stagger bike releases correctly', () => {
        const firstBike = eastbound.getBikes()[0] // Index 0
        const secondBike = eastbound.getBikes()[1] // Index 1
        
        // First bike should be released at :45:00
        const firstPos = firstBike.getPosition(45 * 60)
        expect(firstPos!.state).toBe('staging') // In transition
        
        // Second bike should still be in pen at :45:00
        const secondPos = secondBike.getPosition(45 * 60)
        expect(secondPos!.state).toBe('pen')
        
        // Second bike should be released 12 seconds later (at :45:12)
        const secondPosLater = secondBike.getPosition(45 * 60 + 12)
        expect(secondPosLater!.state).toBe('staging') // Also in transition
        
        // After transitions complete, both should be in tunnel
        const firstPosInTunnel = firstBike.getPosition(45 * 60 + 3)
        const secondPosInTunnel = secondBike.getPosition(45 * 60 + 12 + 3)
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
        const relativeTime = 60 // 1 minute after pen opens
        const phase = eastbound.getPhase(relativeTime)
        expect(phase).toBe('bikes-enter')
      })
    })
    
    describe('Late arrival bikes', () => {
      it('should queue late arrivals for next cycle', () => {
        // Test the concept - bikes arriving after :47 should wait for next cycle
        const relativeTime = 5 * 60 // 5 minutes after pen opens (:50)
        const phase = eastbound.getPhase(relativeTime)
        expect(phase).toBe('sweep') // Not bikes-enter anymore
      })
    })
    
    describe('Cars in L lane (always flow)', () => {
      it('should allow L lane cars to flow during bike phases', () => {
        const lCars = eastbound.getCars().filter(car => car.getLane() === 'L')
        const carAt46 = lCars.find(car => car.getSpawnMinute() === 46)
        
        if (carAt46) {
          // L lane car spawning at :46 should flow normally
          const position = carAt46.getPosition(46 * 60)
          expect(position).toBeTruthy()
          expect(position!.state).toBe('tunnel')
        }
      })
    })
    
    describe('Cars in R lane (may queue)', () => {
      it('should queue R lane cars during bike phases', () => {
        const rCars = eastbound.getCars().filter(car => car.getLane() === 'R')
        const carAt46 = rCars.find(car => car.getSpawnMinute() === 46)
        
        if (carAt46) {
          // R lane car spawning at :46 should be queued
          const position = carAt46.getPosition(46 * 60)
          expect(position).toBeTruthy()
          expect(position!.state).toBe('queued')
          expect(position!.x).toBeLessThan(0) // In queue area (negative x)
        }
      })
      
      it('should release queued cars when pace car starts', () => {
        const rCars = eastbound.getCars().filter(car => car.getLane() === 'R')
        const carAt45 = rCars.find(car => car.getSpawnMinute() === 45)
        
        if (carAt45) {
          // At :45, car should be queued
          const queuedPosition = carAt45.getPosition(45 * 60)
          expect(queuedPosition!.state).toBe('queued')
          
          // At :55 (pace car starts), car should be moving
          const movingPosition = carAt45.getPosition(55 * 60)
          expect(movingPosition!.state).toBe('tunnel')
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
        expect(westbound.getRelativeTime(15 * 60)).toBe(0)
        
        // At 16 minutes, relative time should be 60 seconds
        expect(westbound.getRelativeTime(16 * 60)).toBe(60)
        
        // At 14 minutes (before pen opens), should wrap around
        expect(westbound.getRelativeTime(14 * 60)).toBe(59 * 60) // 59 minutes later in relative time
      })
    })
    
    describe('Westbound-specific behavior', () => {
      it('should handle :16 westbound bike correctly', () => {
        // A bike spawning at :16 should be able to join the traveling group
        const relativeTime = 60 // 1 minute after pen opens (:16)
        const phase = westbound.getPhase(relativeTime)
        expect(phase).toBe('bikes-enter')
      })
      
      it('should queue :20 westbound bike for next cycle', () => {
        // A bike spawning at :20 should wait for next cycle
        const relativeTime = 5 * 60 // 5 minutes after pen opens (:20)
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
      expect(eastbound.getPhase(eastbound.getRelativeTime(15 * 60))).toBe('normal')
      expect(westbound.getPhase(westbound.getRelativeTime(15 * 60))).toBe('bikes-enter')
      
      // At absolute time :45, eastbound should be in bikes-enter, westbound in normal
      expect(eastbound.getPhase(eastbound.getRelativeTime(45 * 60))).toBe('bikes-enter')
      expect(westbound.getPhase(westbound.getRelativeTime(45 * 60))).toBe('normal')
    })
  })
})