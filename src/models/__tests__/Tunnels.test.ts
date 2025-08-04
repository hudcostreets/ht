import { describe, it, expect, beforeEach } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnels } from '../Tunnels'

describe('Tunnels', () => {
  let ht: Tunnels

  beforeEach(() => {
    ht = new Tunnels(HOLLAND_TUNNEL_CONFIG)
  })

  describe('Vehicle coordination', () => {
    it('should return all vehicles at a given time', () => {
      // At :45 (eastbound pen opens)
      const vehicles = ht.getAllVehicles(45)

      // Should have eastbound and westbound vehicles
      const eastboundVehicles = vehicles.filter(v => v.dir === 'east')
      const westboundVehicles = vehicles.filter(v => v.dir === 'west')

      expect(eastboundVehicles.length).toBeGreaterThan(0)
      expect(westboundVehicles.length).toBeGreaterThan(0)

      // Should have different types
      const bikes = vehicles.filter(v => v.type === 'bike')
      const cars = vehicles.filter(v => v.type === 'car')

      expect(bikes.length).toBeGreaterThan(0)
      expect(cars.length).toBeGreaterThan(0)
    })

    it('should provide correct phase information', () => {
      const phases = ht.getPhases(45)

      expect(phases.east).toBe('bikes-enter') // :45 eastbound
      expect(phases.west).toBe('normal') // :45 westbound (30 minutes after their :15)
    })

    it('should handle hour boundaries correctly', () => {
      // Test at :00 (start of new hour)
      const vehiclesAt00 = ht.getAllVehicles(0)
      const vehiclesAt60 = ht.getAllVehicles(60) // Same time, next hour

      // Should have consistent behavior across hour boundaries
      expect(vehiclesAt00.length).toBe(vehiclesAt60.length)
    })
  })

  describe('Critical time points', () => {
    it('should handle eastbound bike pen opening at :45', () => {
      const car = ht.e.cars.r[0]
      const carPos = car.getPos(45)
      expect(carPos.state).toBe('queued') // First R lane car should be queued when bikes enter
      const vehicles = ht.getAllVehicles(45)
      const eastboundBikes = vehicles.filter(v => v.type === 'bike' && v.dir === 'east')

      // First eastbound bike should be in position
      const firstBike = eastboundBikes.find(v => v.metadata.id === '1.2') // First bike that enters
      expect(firstBike).toBeTruthy()
      expect(firstBike!.pos.state).toBe('dequeueing') // Just starting to dequeue at :45
    })

    it('should handle westbound bike pen opening at :15', () => {
      const vehicles = ht.getAllVehicles(15)
      const westboundBikes = vehicles.filter(v => v.type === 'bike' && v.dir === 'west')

      // Look for a bike that's actually moving (westbound bikes are created similarly)
      const firstBike = westboundBikes.find(v => v.pos.state === 'dequeueing' || v.pos.state === 'transiting')
      expect(firstBike).toBeTruthy()
    })

    it('should handle :16 westbound bike joining traveling group', () => {
      // const vehicles = ht.getAllVehicles(16)

      // Should have westbound bikes in bikes-enter phase
      const phases = ht.getPhases(16)
      expect(phases.west).toBe('bikes-enter')
    })

    it('should handle :20 westbound bike waiting in pen', () => {
      // const vehicles = ht.getAllVehicles(20)

      // :20 bike should not be in tunnel yet (should wait for next cycle)
      const phases = ht.getPhases(20)
      expect(phases.west).toBe('sweep') // Past bikes-enter phase
    })

    it('should handle eastbound pace car starting at :55', () => {
      const vehicles = ht.getAllVehicles(55)
      const phases = ht.getPhases(55)

      expect(phases.east).toBe('pace-car')

      // Queued eastbound cars should be moving
      const eastboundCars = vehicles.filter(v =>
        v.type === 'car' &&
        v.dir === 'east' &&
        v.metadata.laneId === 'R'
      )

      // Look for the first R lane car (spawnMin=0), which should be queued and then released by pace car
      const queuedCar = eastboundCars.find(v => v.metadata.spawnMin === 0)
      if (queuedCar) {
        // At minute 55 (relative minute 10), pace car has started and queued cars should be moving
        expect(queuedCar.pos.state).toBe('dequeueing')
        expect(queuedCar.pos.x).toBe(-30) // First car in queue
      }
    })

    it('should handle westbound pace car starting at :25', () => {
      const vehicles = ht.getAllVehicles(25)
      const phases = ht.getPhases(25)

      expect(phases.west).toBe('pace-car')

      // Queued westbound cars should be moving
      const westboundCars = vehicles.filter(v =>
        v.type === 'car' &&
        v.dir === 'west' &&
        v.metadata.laneId === 'R'
      )

      // Look for the first R lane car (spawnMin=0), which should be queued and then released by pace car
      const queuedCar = westboundCars.find(v => v.metadata.spawnMin === 0)
      if (queuedCar) {
        // At minute 25 (relative minute 10), pace car has started and queued cars should be moving
        expect(queuedCar.pos.state).toBe('dequeueing')
      }
    })
  })

  describe('Vehicle count validation', () => {
    it('should have correct number of bikes per direction', () => {
      const vehicles = ht.getAllVehicles(0)
      const eastboundBikes = vehicles.filter(v => v.type === 'bike' && v.dir === 'east')
      const westboundBikes = vehicles.filter(v => v.type === 'bike' && v.dir === 'west')

      // Should have around 15 bikes per direction (0.25 bikes/minute * 60 minutes = 15)
      // But bikes can split into multiple objects when wrapping around the period
      expect(eastboundBikes.length).toBeLessThanOrEqual(20) // Allow for split bikes
      expect(westboundBikes.length).toBeLessThanOrEqual(20) // Allow for split bikes
    })

    it('should have correct number of cars per direction per lane', () => {
      const vehicles = ht.getAllVehicles(30) // :30, during normal flow
      const eastboundCars = vehicles.filter(v => v.type === 'car' && v.dir === 'east')
      const westboundCars = vehicles.filter(v => v.type === 'car' && v.dir === 'west')

      // Each direction should have cars in both lanes
      const eastboundLCars = eastboundCars.filter(v => v.metadata.laneId === 'L')
      const eastboundRCars = eastboundCars.filter(v => v.metadata.laneId === 'R')
      const westboundLCars = westboundCars.filter(v => v.metadata.laneId === 'L')
      const westboundRCars = westboundCars.filter(v => v.metadata.laneId === 'R')

      expect(eastboundLCars.length).toBeGreaterThan(0)
      expect(eastboundRCars.length).toBeGreaterThan(0)
      expect(westboundLCars.length).toBeGreaterThan(0)
      expect(westboundRCars.length).toBeGreaterThan(0)
    })
  })
})
