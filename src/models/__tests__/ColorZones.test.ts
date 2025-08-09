import { describe, expect, it } from 'vitest'
import { HOLLAND_TUNNEL_CONFIG } from '../TunnelConfigs'
import { Tunnel } from '../Tunnel'

describe('Color Zones', () => {
  const eb = new Tunnel(HOLLAND_TUNNEL_CONFIG.eb)
  const wb = new Tunnel(HOLLAND_TUNNEL_CONFIG.wb)

  function checkRects(
    tunnel: Tunnel,
    min: number,
    green: { x: number, w: number } | null,
    red: { x: number, w: number } | null
  ) {
    const rects = tunnel.getColorRectangles(min)
    const expected = []
    if (green) expected.push({ color: 'green', x: green.x, width: green.w })
    if (red) expected.push({ color: 'red', x: red.x, width: red.w })

    expect(rects).toHaveLength(expected.length)
    expected.forEach((exp, i) => {
      expect(rects[i]).toMatchObject(exp)
    })
  }

  function checkZones(
    tunnel: Tunnel,
    relMin: number,
    expected: [number, number, number] | null
  ) {
    const zones = tunnel.colorZones.at(relMin)
    expect(zones).toEqual(expected)
  }

  it('should track eastbound color zones correctly', () => {
    // Bike lane opening phase (0-3)
    checkRects(eb, 45,   null            ,   null             )  // rel 0: no zones
    checkRects(eb, 46, { x:   0, w: 160 },   null             )  // rel 1: green growing
    checkRects(eb, 47, { x:   0, w: 320 },   null             )  // rel 2: green growing
    checkRects(eb, 48, { x:   0, w: 480 },   null             )  // rel 3: pen closes

    // Sweep phase (5-10)
    checkRects(eb, 50, { x:   0, w: 800 },   null             )  // rel 5: sweep enters
    checkRects(eb, 51, { x:  80, w: 720 }, { x:   0, w:  80 } )  // rel 6: sweep at 80
    checkRects(eb, 53, { x: 240, w: 560 }, { x:   0, w: 240 } )  // rel 8: sweep at 240

    // Pace phase (10-15)
    checkRects(eb, 55, { x: 400, w: 400 }, { x:   0, w: 400 } )  // rel 10: pace enters
    checkRects(eb, 56, { x: 480, w: 320 }, { x: 160, w: 320 } )  // rel 11: both moving
    checkRects(eb, 57, { x: 560, w: 240 }, { x: 320, w: 240 } )  // rel 12
    checkRects(eb, 59, { x: 720, w:  80 }, { x: 640, w:  80 } )  // rel 14
    checkRects(eb, 60,   null            ,   null             )  // rel 15: both exit
    checkRects(eb, 61,   null            ,   null             )  // rel 16: clear

    checkZones(eb, 2.5, [  0, 400, 400])                         // rel 2.5: interpolated
    checkZones(eb, 7.5, [200, 800,   0])                         // rel 7.5: sweep at 200
  })

  it('should track westbound color zones correctly', () => {
    // Bike lane opening phase (0-3)
    checkRects(wb, 15,   null            ,   null             )  // rel 0: no zones
    checkRects(wb, 16, { x: 640, w: 160 },   null             )  // rel 1: green from right
    checkRects(wb, 17, { x: 480, w: 320 },   null             )  // rel 2
    checkRects(wb, 18, { x: 320, w: 480 },   null             )  // rel 3: pen closes

    // Sweep phase (5-10)
    checkRects(wb, 20, { x:   0, w: 800 },   null             )  // rel 5: sweep enters
    checkRects(wb, 21, { x:   0, w: 720 }, { x: 720, w:  80 } )  // rel 6: sweep at 720
    checkRects(wb, 22, { x:   0, w: 640 }, { x: 640, w: 160 } )  // rel 7: sweep at 640
    checkRects(wb, 24, { x:   0, w: 480 }, { x: 480, w: 320 } )  // rel 9: sweep at 480

    // Pace phase (10-15)
    checkRects(wb, 25, { x:   0, w: 400 }, { x: 400, w: 400 } )  // rel 10: pace enters
    checkRects(wb, 26, { x:   0, w: 320 }, { x: 320, w: 320 } )  // rel 11: both moving
    checkRects(wb, 28, { x:   0, w: 160 }, { x: 160, w: 160 } )  // rel 13
    checkRects(wb, 30,   null            ,   null             )  // rel 15: both exit

    checkZones(wb,  1.5, [560, 800, 800])                        // rel 1.5: interpolated
    checkZones(wb, 12.5, [  0, 200, 400])                        // rel 12.5: interpolated
  })
})
