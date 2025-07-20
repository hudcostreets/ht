import { describe, it, expect, beforeEach } from 'vitest'
import { Tunnels } from '../Tunnels'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'

describe('Tunnels', () => {
  let tunnels: Tunnels
  
  beforeEach(() => {
    tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
  })
  
  describe('Vehicle coordination', () => {
    it('should return all vehicles at a given time', () => {
      // At :45 (eastbound pen opens)
      const vehicles = tunnels.getAllVehicles(45 * 60)
      
      // Should have eastbound and westbound vehicles
      const eastboundVehicles = vehicles.filter(v => v.direction === 'east')
      const westboundVehicles = vehicles.filter(v => v.direction === 'west')
      
      expect(eastboundVehicles.length).toBeGreaterThan(0)
      expect(westboundVehicles.length).toBeGreaterThan(0)
      
      // Should have different types
      const bikes = vehicles.filter(v => v.type === 'bike')
      const cars = vehicles.filter(v => v.type === 'car')
      
      expect(bikes.length).toBeGreaterThan(0)
      expect(cars.length).toBeGreaterThan(0)
    })
    
    it('should provide correct phase information', () => {
      const phases = tunnels.getPhases(45 * 60)
      
      expect(phases.east).toBe('bikes-enter') // :45 eastbound
      expect(phases.west).toBe('normal') // :45 westbound (30 minutes after their :15)
    })
    
    it('should handle hour boundaries correctly', () => {
      // Test at :00 (start of new hour)
      const vehiclesAt00 = tunnels.getAllVehicles(0)
      const vehiclesAt3600 = tunnels.getAllVehicles(3600) // Same time, next hour
      
      // Should have consistent behavior across hour boundaries
      expect(vehiclesAt00.length).toBe(vehiclesAt3600.length)
    })
  })
  
  describe('Critical time points', () => {
    it('should handle eastbound bike pen opening at :45', () => {
      const vehicles = tunnels.getAllVehicles(45 * 60)
      const eastboundBikes = vehicles.filter(v => v.type === 'bike' && v.direction === 'east')
      
      // First eastbound bike should be entering tunnel
      const firstBike = eastboundBikes.find(v => v.metadata.index === 0)
      expect(firstBike).toBeTruthy()
      expect(firstBike!.position.state).toBe('tunnel')
      expect(firstBike!.position.x).toBe(0) // At tunnel entrance
    })
    
    it('should handle westbound bike pen opening at :15', () => {
      const vehicles = tunnels.getAllVehicles(15 * 60)
      const westboundBikes = vehicles.filter(v => v.type === 'bike' && v.direction === 'west')
      
      // First westbound bike should be entering tunnel
      const firstBike = westboundBikes.find(v => v.metadata.index === 0)
      expect(firstBike).toBeTruthy()
      expect(firstBike!.position.state).toBe('tunnel')
    })
    
    it('should handle :16 westbound bike joining traveling group', () => {
      const vehicles = tunnels.getAllVehicles(16 * 60)
      
      // Should have westbound bikes in bikes-enter phase
      const phases = tunnels.getPhases(16 * 60)
      expect(phases.west).toBe('bikes-enter')
    })
    
    it('should handle :20 westbound bike waiting in pen', () => {
      const vehicles = tunnels.getAllVehicles(20 * 60)
      
      // :20 bike should not be in tunnel yet (should wait for next cycle)
      const phases = tunnels.getPhases(20 * 60)
      expect(phases.west).toBe('sweep') // Past bikes-enter phase
    })
    
    it('should handle eastbound pace car starting at :55', () => {
      const vehicles = tunnels.getAllVehicles(55 * 60)
      const phases = tunnels.getPhases(55 * 60)
      
      expect(phases.east).toBe('pace-car')
      
      // Queued eastbound cars should be moving
      const eastboundCars = vehicles.filter(v => 
        v.type === 'car' && 
        v.direction === 'east' && 
        v.metadata.lane === 'R'
      )
      
      const queuedCar = eastboundCars.find(v => v.metadata.spawnMinute === 45)
      if (queuedCar) {
        expect(queuedCar.position.state).toBe('tunnel')
        expect(queuedCar.position.x).toBeGreaterThan(-50) // Should have moved from initial queue position
      }
    })
    
    it('should handle westbound pace car starting at :25', () => {
      const vehicles = tunnels.getAllVehicles(25 * 60)
      const phases = tunnels.getPhases(25 * 60)
      
      expect(phases.west).toBe('pace-car')
      
      // Queued westbound cars should be moving
      const westboundCars = vehicles.filter(v => 
        v.type === 'car' && 
        v.direction === 'west' && 
        v.metadata.lane === 'R'
      )
      
      const queuedCar = westboundCars.find(v => v.metadata.spawnMinute === 15)
      if (queuedCar) {
        expect(queuedCar.position.state).toBe('tunnel')
      }
    })
  })
  
  describe('Vehicle count validation', () => {
    it('should have correct number of bikes per direction', () => {
      const vehicles = tunnels.getAllVehicles(0)
      const eastboundBikes = vehicles.filter(v => v.type === 'bike' && v.direction === 'east')
      const westboundBikes = vehicles.filter(v => v.type === 'bike' && v.direction === 'west')
      
      // Should have 15 bikes per direction (0.25 bikes/minute * 60 minutes = 15)
      // But not all may be visible at time 0
      expect(eastboundBikes.length).toBeLessThanOrEqual(15)
      expect(westboundBikes.length).toBeLessThanOrEqual(15)
    })
    
    it('should have correct number of cars per direction per lane', () => {
      const vehicles = tunnels.getAllVehicles(30 * 60) // :30, during normal flow
      const eastboundCars = vehicles.filter(v => v.type === 'car' && v.direction === 'east')
      const westboundCars = vehicles.filter(v => v.type === 'car' && v.direction === 'west')
      
      // Each direction should have cars in both lanes
      const eastboundLCars = eastboundCars.filter(v => v.metadata.lane === 'L')
      const eastboundRCars = eastboundCars.filter(v => v.metadata.lane === 'R')
      const westboundLCars = westboundCars.filter(v => v.metadata.lane === 'L')
      const westboundRCars = westboundCars.filter(v => v.metadata.lane === 'R')
      
      expect(eastboundLCars.length).toBeGreaterThan(0)
      expect(eastboundRCars.length).toBeGreaterThan(0)
      expect(westboundLCars.length).toBeGreaterThan(0)
      expect(westboundRCars.length).toBeGreaterThan(0)
    })
  })
  
  describe('Hour boundary behavior', () => {
    it('should maintain continuity across :59 to :00 transition', () => {
      const vehiclesAt59 = tunnels.getAllVehicles(59 * 60)
      const vehiclesAt00 = tunnels.getAllVehicles(60 * 60) // Next hour :00
      
      // Should not have a dramatic drop in vehicle count
      const bikesAt59 = vehiclesAt59.filter(v => v.type === 'bike').length
      const bikesAt00 = vehiclesAt00.filter(v => v.type === 'bike').length
      
      // Allow for some variation due to vehicles exiting/entering
      expect(Math.abs(bikesAt59 - bikesAt00)).toBeLessThan(5)
    })
    
    it('should handle westbound late arrivals correctly at hour boundary', () => {
      // At :59, should have westbound bikes waiting in pen
      const vehiclesAt59 = tunnels.getAllVehicles(59 * 60)
      const westboundBikesAt59 = vehiclesAt59.filter(v => 
        v.type === 'bike' && 
        v.direction === 'west' && 
        v.position.state === 'pen'
      )
      
      // At :00, should have westbound bikes in pen (including new :00 bike)
      const vehiclesAt00 = tunnels.getAllVehicles(60 * 60)
      const westboundBikesAt00 = vehiclesAt00.filter(v => 
        v.type === 'bike' && 
        v.direction === 'west' && 
        v.position.state === 'pen'
      )
      
      // Should have at least as many bikes at :00 (new bike spawned)
      expect(westboundBikesAt00.length).toBeGreaterThanOrEqual(westboundBikesAt59.length)
    })
  })
})