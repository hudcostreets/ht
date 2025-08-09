import { describe, it } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../src/models/TunnelConfigs'
import { Tunnels } from '../src/models/Tunnels'

const tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
const { eb } = tunnels

describe('Debug bike positions', () => {
  it('should show bike 1.2 positions', () => {
    const times = [45, 45.1, 58.7, 59.7, 0, 44]
    times.forEach(min => {
      const bike = eb.allVehicles(min).find(v => v.metadata?.id === '1.2' && v.type === 'bike')
      if (bike) {
        console.log(`Bike 1.2 at minute ${min}:`, bike.pos)
      }
    })
  })
  
  it('should show bike 0 positions', () => {
    const times = [44, 45, 1.5, 43]
    times.forEach(min => {
      const bike = eb.allVehicles(min).find(v => v.metadata?.id === '0' && v.type === 'bike')
      if (bike) {
        console.log(`Bike 0 at minute ${min}:`, bike.pos)
      }
    })
  })
})
