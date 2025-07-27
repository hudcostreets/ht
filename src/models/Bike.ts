import {Pos} from "./Tunnel"
import {TimePoint} from "./TimeVal"
import {Vehicle} from "./Vehicle"

export class Bike extends Vehicle {
  get fadeMph(): number {
    return this.config.bikeFlatMph
  }

  points(): TimePoint<Pos>[] {
    // Calculate the full trajectory for this bike
    const { tunnel, config, spawnQueue, idx, spawnMin } = this
    const { d } = tunnel
    const { period, laneWidthPx, penCloseMin, lengthMi, bikeDownMph, bikeUpMph, bikeFlatMph, fadeMins, } = config

    // let transitingMin

    let initPos = tunnel.r.entrance
    if (spawnQueue) {
      // Bike has queue info - use it
      const { offset, minsBeforeDequeueing, minsDequeueing } = spawnQueue
      // transitingMin = minsBeforeDequeueing + minsDequeueing
      initPos = {
        x: initPos.x + offset.x,
        y: initPos.y + offset.y,
      }
    } else {
      // Bike flows immediately (arrives during pen open window)
      // transitingMin = this.spawnMin
    }
    const origin = {
      x: initPos.x - 100 * d,
      y: initPos.y,
    }

    // Calculate tunnel transit time
    const tunnelWidthPx = laneWidthPx
    const pxPerMile = tunnelWidthPx / lengthMi
    const pxPerMin = bikeFlatMph / lengthMi * tunnelWidthPx / 60
    const fadePx = pxPerMin * fadeMins

    // Variable speed through tunnel (downhill first half, uphill second half)
    const halfWPx = tunnelWidthPx / 2
    const halfway = { ...tunnel.r.entrance }
    halfway.x += halfWPx * d
    const downMins = (halfWPx / pxPerMile) / bikeDownMph * 60
    const upMins = (halfWPx / pxPerMile) / bikeUpMph * 60

    // Build time positions array
    const points: TimePoint<Pos>[] = []
    
    // Handle bikes that are released immediately vs those that wait
    if (!spawnQueue) {
      // Bike enters tunnel immediately at minute 0
      points.push({ min: spawnMin, val: { ...tunnel.r.entrance, state: 'transiting', opacity: 1, }, })
    } else {
      const { offset, minsBeforeDequeueing, minsDequeueing } = spawnQueue
      // Start in pen
      points.push({ min: spawnMin, val: { ...initPos, state: 'queued', opacity: 1, }, })

      // Add dequeueing state if there's time before release
      if (spawnMin > penCloseMin) {
        points.push({ min: (transitingMin + period - 1) % period, val: { ...initPos, state: 'dequeueing', opacity: 1, }, })
      }
      
      // Enter tunnel
      points.push({ min: transitingMin, val: { ...tunnel.r.entrance, state: 'transiting', opacity: 1, }, })
    }
    
    // Exit tunnel
    const halfwayMin = (transitingMin + downMins) % period
    points.push({ min: halfwayMin, val: { ...halfway, state: 'transiting', opacity: 1, }, })
    const exitMin = (halfwayMin + upMins) % period
    points.push({ min: exitMin, val: { ...tunnel.r.exit, state: 'exiting', opacity: 1, }, })
      
    // Fade out
    const fadeMin = (exitMin + fadeMins) % period
    const destPos = { ...tunnel.r.exit }
    destPos.x += fadePx * d
    points.push({ min: fadeMin, val: { ...destPos, state: 'done', opacity: 0, }, })

    // Return to origin
    const returnMin = (fadeMin + 1) % period
    const originVal: Pos = { ...origin, state: 'origin', opacity: 0, }
    points.push({ min: returnMin, val: originVal, })
    points.push({ min: (spawnMin - 1 + period) % period, val: originVal, })
    points.sort((a, b) => a.min - b.min)
    console.log(`Bike ${idx}:`, points, spawnQueue)
    return points
  }
}
