import {field, Pos, Tunnel} from "./Tunnel"
import {TimePoint, TimeVal} from "./TimeVal"

export type BikeSpawnQueue = {
  offsetX: number  // X offset in pen
  offsetY: number  // Y offset in pen  
  releaseMin: number  // When this bike gets released from pen
}

export class Bike {
  public tunnel: Tunnel
  public index: number
  public spawnMin: number
  public spawnQueue?: BikeSpawnQueue
  public pos: TimeVal<Pos>

  constructor(
    tunnel: Tunnel,
    index: number,
    spawnMin: number,
    spawnQueue?: BikeSpawnQueue,
  ) {
    this.tunnel = tunnel
    this.index = index
    this.spawnMin = spawnMin
    this.spawnQueue = spawnQueue

    // Calculate the full trajectory for this bike
    const { period, laneWidthPx, lengthMi, bikeDownMph, bikeUpMph, penRelativeX, penRelativeY } = this.tunnel.config

    // Determine when this bike should be released from pen
    let releaseRelMins: number
    let penX: number
    let penY: number

    if (spawnQueue) {
      // Bike has queue info - use it
      releaseRelMins = spawnQueue.releaseMin
      penX = penRelativeX + spawnQueue.offsetX
      penY = penRelativeY + spawnQueue.offsetY
    } else {
      // Bike flows immediately (arrives during pen open window)
      releaseRelMins = this.spawnMin
      // Default pen position
      penX = penRelativeX
      penY = penRelativeY
    }

    // Calculate tunnel transit time
    const tunnelWidthPixels = laneWidthPx
    const pixelsPerMile = tunnelWidthPixels / lengthMi

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfwayPoint = tunnelWidthPixels / 2
    const downMins = (halfwayPoint / pixelsPerMile) / bikeDownMph * 60
    const upMins = (halfwayPoint / pixelsPerMile) / bikeUpMph * 60
    const totalTransitMins = downMins + upMins

    const penPos = { x: penX, y: penY }
    const origin = {
      x: penPos.x - 100 * this.tunnel.d,
      y: penPos.y,
    }

    // Build time positions array
    const points: TimePoint<Pos>[] = []
    
    // Handle bikes that are released immediately vs those that wait
    if (releaseRelMins === 0) {
      // Bike enters tunnel immediately at minute 0
      points.push({ min: 0, val: { ...tunnel.r.entrance, state: 'transiting', opacity: 1, }, })
    } else {
      // Start in pen
      points.push({ min: 0, val: { ...penPos, state: 'queued', opacity: 1, }, })
      
      // Add dequeueing state if there's time before release
      if (releaseRelMins > 1) {
        points.push({ min: releaseRelMins - 1, val: { ...penPos, state: 'dequeueing', opacity: 1, }, })
      }
      
      // Enter tunnel
      points.push({ min: releaseRelMins, val: { ...tunnel.r.entrance, state: 'transiting', opacity: 1, }, })
    }
    
    // Exit tunnel
    const exitMin = releaseRelMins + totalTransitMins
    if (exitMin < period - 0.1) {  // Leave some buffer before period end
      points.push({ min: exitMin, val: { ...tunnel.r.exit, state: 'exiting', opacity: 1, }, })
      
      // Fade out
      const fadeMin = exitMin + 1
      if (fadeMin < period - 0.1) {
        points.push({ min: fadeMin, val: { ...tunnel.r.dest, state: 'done', opacity: 0, }, })
        
        // Return to origin
        const returnMin = fadeMin + 1
        if (returnMin < period - 0.1) {
          points.push({ min: returnMin, val: { ...origin, state: 'origin', opacity: 0, }, })
        }
      }
    }
    
    // Always end at period - 1
    const lastPoint = points[points.length - 1]
    if (lastPoint.min < period - 1) {
      // Use the last point's value for the final position
      points.push({ min: period - 1, val: { ...lastPoint.val }, })
    }
    
    this.pos = new TimeVal(points, field, period)
  }

  getPos(absMins: number): { x: number, y: number, state: string, opacity: number } {
    const relMins = this.tunnel.relMins(absMins)
    return this.pos.at(relMins)
  }
}
