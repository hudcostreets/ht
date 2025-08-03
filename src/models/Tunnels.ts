import { ColorRectangles } from './ColorRectangles'
import { Pace } from './Pace'
import { Sweep } from './Sweep'
import { Tunnel, type TunnelConfig } from './Tunnel'
import {Direction, State} from './types'
import {XY} from "./XY"

export type SupportProps = {
  mph: number
  stagingOffset: number
}

export interface TunnelsConfig {
  eb: TunnelConfig
  wb: TunnelConfig
  sweep: SupportProps
  pace: SupportProps
}

export type VehicleI<Metadata = any> = {
  id: string
  type: 'bike' | 'car' | 'sweep' | 'pace'
  pos: XY & { state: State, opacity: number }
  dir: Direction
  metadata: Metadata
}

export class Tunnels {
  public eb: Tunnel
  public wb: Tunnel
  public sweep: Sweep
  public pace: Pace
  private colorRects: ColorRectangles

  constructor(config: TunnelsConfig) {
    this.eb = new Tunnel(config.eb)
    this.wb = new Tunnel(config.wb)
    const { eb, wb } = this
    const { sweep, pace } = config
    this.sweep = new Sweep({
      eb,
      wb,
      mph: sweep.mph,
      stagingOffset: sweep.stagingOffset
    })
    this.pace = new Pace({
      eb,
      wb,
      mph: pace.mph,
      stagingOffset: pace.stagingOffset
    })
    this.colorRects = new ColorRectangles(this)
  }

  public get e(): Tunnel {
    return this.eb
  }

  public get w(): Tunnel {
    return this.wb
  }

  // Get all vehicles for rendering
  getAllVehicles(absMins: number): Array<VehicleI> {
    const { e, w, sweep, pace } = this
    return [
      ...e.allVehicles(absMins),
      ...w.allVehicles(absMins),
      {
        id: 'sweep', type: 'sweep',
        pos: sweep.getPos(absMins),
        dir: sweep.currentTunnel?.config.direction || 'east',
        metadata: {}
      },
      {
        id: 'pace', type: 'pace',
        pos: pace.getPos(absMins),
        dir: pace.currentTunnel?.config.direction || 'east',
        metadata: {}
      },
    ]
  }

  // Get current phase for each direction
  getPhases(absMins: number): { east: string, west: string } {
    const { e, w } = this
    const eastRelativeTime = e.relMins(absMins)
    const westRelativeTime = w.relMins(absMins)

    return {
      east: e.getPhase(eastRelativeTime),
      west: w.getPhase(westRelativeTime)
    }
  }

  // Get color rectangles for rendering
  getColorRectangles(absMins: number): Array<{
    direction: Direction
    color: 'green' | 'red'
    x: number
    width: number
    y: number
    height: number
  }> {
    const relMins = absMins % this.eb.config.period
    return this.colorRects.getRectangles(relMins)
  }
}
