import { HOLLAND_TUNNEL_CONFIG } from './src/models/TunnelConfigs.js'
import { Tunnels } from './src/models/Tunnels.js'

const tunnels = new Tunnels(HOLLAND_TUNNEL_CONFIG)
const { eb } = tunnels

// Get bike 1.2
const bike = eb.allVehicles(45).find(v => v.metadata?.id === '1.2' && v.type === 'bike')
if (bike) {
  console.log('Bike 1.2 at minute 45:', bike.pos)
  console.log('Bike 1.2 at minute 45.1:', eb.allVehicles(45.1).find(v => v.metadata?.id === '1.2' && v.type === 'bike')?.pos)
}

// Get bike 0
const bike0 = eb.allVehicles(45).find(v => v.metadata?.id === '0' && v.type === 'bike')
if (bike0) {
  console.log('Bike 0 at minute 45:', bike0.pos)
}
