import React, { type FC, useMemo, memo, useState, useEffect } from 'react'
import { Tooltip } from 'react-tooltip'

interface Props {
  currentMinute: number
  eb: any // E/b tunnel instance
  wb: any // W/b tunnel instance
}

const SpaceTimeRectsComponent: FC<Props> = ({ currentMinute, eb, wb }) => {
  // Get container width for responsive sizing
  const [containerWidth, setContainerWidth] = useState(720)

  // Detect if mobile/touch device
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  useEffect(() => {
    const updateWidth = () => {
      const container = document.querySelector('#spacetime .appendix-section')
      if (container) {
        const rect = container.getBoundingClientRect()
        // Get the actual usable width inside the appendix-section
        const computedStyle = window.getComputedStyle(container)
        const paddingLeft = parseFloat(computedStyle.paddingLeft)
        const paddingRight = parseFloat(computedStyle.paddingRight)
        const availableWidth = rect.width - paddingLeft - paddingRight
        setContainerWidth(Math.min(720, availableWidth))
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Responsive dimensions
  const width = containerWidth
  const laneHeight = 40
  const laneGap = 15  // Increased gap between directions
  // Reduce margins on narrow screens to maximize lane width
  const leftMargin = width < 500 ? 5 : 40
  const rightMargin = width < 500 ? 5 : 40
  const topMargin = 35  // More room for W/b time labels
  const bottomMargin = 45  // More room for E/b time labels to avoid cutoff

  // Calculate height based on fixed lane dimensions
  const height = topMargin + (4 * laneHeight) + (3 * laneGap) + bottomMargin

  const plotWidth = width - leftMargin - rightMargin
  const _plotHeight = height - topMargin - bottomMargin

  // Calculate tooltip values from config
  const tooltipValues = useMemo(() => {
    const config = eb.config // Use eb config (same as wb)

    // Bikes can enter during penCloseMin window (e.g., 3 minutes)
    const bikePulseMinutes = config.penCloseMin

    // Calculate bike transit times based on direction
    const bikeDownhillTime = (config.lengthMi / config.bikeDownMph) * 60
    const bikeUphillTime = (config.lengthMi / config.bikeUpMph) * 60

    // Earliest bike (enters at minute 0) vs latest bike (enters just before pen closes)
    const minBikeTime = Math.min(bikeDownhillTime, bikeUphillTime)
    const maxBikeTime = Math.max(bikeDownhillTime, bikeUphillTime) + bikePulseMinutes

    // R lane is blocked from minute 0 to paceStartMin
    const rLaneBlockedMinutes = config.paceStartMin
    const rLaneAvailableMinutes = config.period - rLaneBlockedMinutes
    const rLaneCarPercent = (rLaneAvailableMinutes / config.period) * 100

    return {
      bikeMinTime: Math.round(minBikeTime),
      bikeMaxTime: Math.round(maxBikeTime),
      bikePulseMinutes,
      rLaneCarPercent: Math.round(rLaneCarPercent)
    }
  }, [eb, wb])

  // Calculate space-time allocation statistics
  const spaceTimeStats = useMemo(() => {
    let carMinutes = 0
    let bikeMinutes = 0
    let dmzMinutes = 0

    // Sample the space-time diagram to calculate areas
    const timeSteps = 120 // Sample every 0.5 minutes
    const spaceSteps = 20 // Sample space at 20 points

    // For each lane
    for (const tunnel of [eb, wb]) {
      // L lane is always cars
      carMinutes += 60 * 1.0 // Full lane-hour for L lane

      // R lane varies by time
      for (let t = 0; t < timeSteps; t++) {
        const min = (t / timeSteps) * 60
        const relMin = tunnel.relMins(min)
        const colorData = tunnel.colorZones.at(relMin)

        if (!colorData) {
          // No zones, all cars
          carMinutes += (60 / timeSteps) * 1.0
        } else {
          const [greenStart, greenEnd, redEnd] = colorData
          const tunnelLength = tunnel.config.laneWidthPx

          // Sample space to determine fraction of each type
          let carFraction = 0
          let bikeFraction = 0
          let dmzFraction = 0

          for (let s = 0; s < spaceSteps; s++) {
            const pos = (s / spaceSteps) * tunnelLength

            if (greenStart >= 0 && greenEnd >= 0 && pos >= greenStart && pos <= greenEnd) {
              bikeFraction += 1 / spaceSteps
            } else if (redEnd >= 0) {
              if ((redEnd < greenStart && pos >= redEnd && pos < greenStart) ||
                  (redEnd > greenEnd && pos > greenEnd && pos <= redEnd)) {
                dmzFraction += 1 / spaceSteps
              } else {
                carFraction += 1 / spaceSteps
              }
            } else {
              carFraction += 1 / spaceSteps
            }
          }

          const timeSlice = 60 / timeSteps
          carMinutes += timeSlice * carFraction
          bikeMinutes += timeSlice * bikeFraction
          dmzMinutes += timeSlice * dmzFraction
        }
      }
    }

    const total = carMinutes + bikeMinutes + dmzMinutes
    return {
      carPercent: ((carMinutes / total) * 100).toFixed(1),
      bikePercent: ((bikeMinutes / total) * 100).toFixed(1),
      dmzPercent: ((dmzMinutes / total) * 100).toFixed(1)
    }
  }, [eb, wb])

  // No need for separate memoization - calculate positions inline

  // Calculate zone lines for each lane
  const zoneLanes = useMemo(() => {
    const lanes = []

    // Helper to get zone boundaries at a given time
    const getZoneBoundaries = (tunnel: any, min: number) => {
      const relMin = tunnel.relMins(min)
      const colorData = tunnel.colorZones.at(relMin)

      if (!colorData) return { greenStart: -1, greenEnd: -1, redEnd: -1 }

      const [greenStart, greenEnd, redEnd] = colorData
      const tunnelLength = tunnel.config.laneWidthPx

      // Normalize to 0-1 range
      return {
        greenStart: greenStart / tunnelLength,
        greenEnd: greenEnd / tunnelLength,
        redEnd: redEnd / tunnelLength
      }
    }

    // Sample zone boundaries over 60 minutes
    const timeSteps = 120 // Sample every 0.5 minutes for smoother lines

    // E/b R lane (bikes allowed)
    const ebRPoints: {
      greenStart: Array<{x: number, y: number}>,
      greenEnd: Array<{x: number, y: number}>,
      redEnd: Array<{x: number, y: number}>
    } = { greenStart: [], greenEnd: [], redEnd: [] }
    for (let i = 0; i <= timeSteps; i++) {
      const min = (i / timeSteps) * 60
      const zones = getZoneBoundaries(eb, min) // Use absolute minutes
      ebRPoints.greenStart.push({ x: min, y: zones.greenStart })
      ebRPoints.greenEnd.push({ x: min, y: zones.greenEnd })
      ebRPoints.redEnd.push({ x: min, y: zones.redEnd })
    }

    // W/b R lane (bikes allowed)
    const wbRPoints: {
      greenStart: Array<{x: number, y: number}>,
      greenEnd: Array<{x: number, y: number}>,
      redEnd: Array<{x: number, y: number}>
    } = { greenStart: [], greenEnd: [], redEnd: [] }
    for (let i = 0; i <= timeSteps; i++) {
      const min = (i / timeSteps) * 60
      const zones = getZoneBoundaries(wb, min) // Use absolute minutes
      wbRPoints.greenStart.push({ x: min, y: zones.greenStart })
      wbRPoints.greenEnd.push({ x: min, y: zones.greenEnd })
      wbRPoints.redEnd.push({ x: min, y: zones.redEnd })
    }

    lanes.push(
      { label: '← W/b R', type: 'bike-capable', y: 0, points: wbRPoints },
      { label: '← W/b L', type: 'car-only', y: laneHeight + laneGap },
      { label: 'E/b L →', type: 'car-only', y: 2 * (laneHeight + laneGap) },
      { label: 'E/b R →', type: 'bike-capable', y: 3 * (laneHeight + laneGap), points: ebRPoints }
    )

    return lanes
  }, [eb, wb])

  // Convert time to x coordinate (direction-aware)
  const timeToX = (min: number, isWestbound: boolean) => {
    if (isWestbound) {
      // W/b goes right to left
      return leftMargin + plotWidth - (min / 60) * plotWidth
    } else {
      // E/b goes left to right
      return leftMargin + (min / 60) * plotWidth
    }
  }

  // Convert space (0-1) to y coordinate within a lane
  const spaceToY = (space: number, laneY: number, _isWestbound: boolean) => {
    // Both directions have entrance at bottom, exit at top
    // E/b entrance is on left, W/b entrance is on right, but both at bottom of lane
    return topMargin + laneY + laneHeight * (1 - space)
  }

  // Create path from points
  const createPath = (points: Array<{x: number, y: number}>, laneY: number, isWestbound: boolean) => {
    if (!points || points.length === 0) return ''

    return points
      .map((p, i) => {
        const x = timeToX(p.x, isWestbound)
        const y = spaceToY(p.y, laneY, isWestbound)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')
  }

  // Create filled region between two paths
  const createFilledRegion = (startPoints: Array<{x: number, y: number}>, endPoints: Array<{x: number, y: number}>, laneY: number, isWestbound: boolean) => {
    if (!startPoints || !endPoints || startPoints.length === 0 || endPoints.length === 0) return ''

    const forwardPath = startPoints
      .map((p, i) => {
        const x = timeToX(p.x, isWestbound)
        const y = spaceToY(p.y, laneY, isWestbound)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')

    const backwardPath = endPoints
      .slice()
      .reverse()
      .map((p, _i) => {
        const x = timeToX(p.x, isWestbound)
        const y = spaceToY(p.y, laneY, isWestbound)
        return `L ${x} ${y}`
      })
      .join(' ')

    return `${forwardPath} ${backwardPath} Z`
  }

  return (
    <div>
      <h2 style={{ textAlign: 'left', margin: '10px 0 5px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>Space-Time Diagram</h2>
      <p style={{ textAlign: 'left', margin: '0 0 10px 0', fontSize: '0.95rem', color: '#555', fontWeight: '500' }}>
        Overall allocation: <strong>{spaceTimeStats.carPercent}%</strong> cars, <strong>{spaceTimeStats.bikePercent}%</strong> bikes, <strong>{spaceTimeStats.dmzPercent}%</strong> "DMZ"
      </p>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="#f5f5f5" />

        {/* Lanes */}
        {zoneLanes.map((lane, i) => {
          const isWestbound = lane.label.includes('W/b')

          return (
            <g key={i}>
              {/* Lane background */}
              <rect
                x={leftMargin}
                y={topMargin + lane.y}
                width={plotWidth}
                height={laneHeight}
                fill="#666"
                opacity="0.2"
                stroke="#333"
                strokeWidth="1"
                data-tooltip-id="str-tooltip"
                data-tooltip-content={
                  lane.type === 'car-only'
                    ? 'Cars have exclusive use of the left lane for 100% of each hour'
                    : `Cars have exclusive use of the right lane for ${tooltipValues.rLaneCarPercent}% of the hour`
                }
                style={{ cursor: 'default' }}
              />

              {/* Lane label - inside the lane */}
              <text
                x={isWestbound ? leftMargin + plotWidth - 5 : leftMargin + 5}
                y={topMargin + lane.y + laneHeight / 2}
                fontSize="11"
                textAnchor={isWestbound ? "end" : "start"}
                dominantBaseline="middle"
                fill="#333"
                fontWeight="bold"
                opacity="0.9"
                style={{ userSelect: 'none' }}
              >
                {lane.label}
              </text>

              {/* Car indicators for car-only lanes */}
              {lane.type === 'car-only' && (
                <>
                  {[10, 30, 50].map(min => {
                    const x = timeToX(min, isWestbound)
                    return (
                      <text
                        key={`car-only-${min}`}
                        x={x}
                        y={topMargin + lane.y + laneHeight / 2}
                        fontSize="20"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        opacity="0.5"
                        transform={!isWestbound ? `translate(${x * 2},0) scale(-1,1)` : undefined}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                        data-tooltip-id="str-tooltip"
                        data-tooltip-content="Cars have exclusive use of the left lane for 100% of each hour"
                      >
                      🚗
                      </text>
                    )
                  })}
                </>
              )}

              {/* Zone regions for bike-capable lanes */}
              {lane.type === 'bike-capable' && lane.points && (
                <>
                  {/* Green zone (bikes) */}
                  <path
                    d={createFilledRegion(lane.points.greenStart, lane.points.greenEnd, lane.y, isWestbound)}
                    fill="#4caf50"
                    opacity="0.3"
                    data-tooltip-id={isMobile ? undefined : "str-tooltip"}
                    data-tooltip-content={isMobile ? undefined : `Bikes use the right lane, and have ${tooltipValues.bikeMinTime}-${tooltipValues.bikeMaxTime} mins to cross (depending on when in the ${tooltipValues.bikePulseMinutes}-minute "pulse" they embark)`}
                    style={{ cursor: 'default', pointerEvents: isMobile ? 'none' : 'auto' }}
                  />

                  {/* Red zone (DMZ) - handle both before and after green */}
                  {(() => {
                    const redRegions = []
                    for (let i = 0; i < lane.points.greenEnd.length - 1; i++) {
                      const greenStart = lane.points.greenStart[i]
                      const greenEnd = lane.points.greenEnd[i]
                      const redEnd = lane.points.redEnd[i]
                      const nextGreenStart = lane.points.greenStart[i + 1]
                      const nextGreenEnd = lane.points.greenEnd[i + 1]
                      const nextRedEnd = lane.points.redEnd[i + 1]

                      // Check for red zone after green (W/b case)
                      if (greenEnd.y >= 0 && redEnd.y >= 0 && greenEnd.y < redEnd.y) {
                        if (nextGreenEnd.y >= 0 && nextRedEnd.y >= 0) {
                          redRegions.push(
                            <path
                              key={`red-after-${i}`}
                              d={createFilledRegion(
                                [greenEnd, nextGreenEnd],
                                [redEnd, nextRedEnd],
                                lane.y,
                                isWestbound
                              )}
                              fill="#f44336"
                              opacity="0.3"
                              data-tooltip-id={isMobile ? undefined : "str-tooltip"}
                              data-tooltip-content={isMobile ? undefined : '"DMZ" between "Sweep" and "Pace" cars'}
                              style={{ cursor: 'default', pointerEvents: isMobile ? 'none' : 'auto' }}
                            />
                          )
                        }
                      }

                      // Check for red zone before green (E/b case)
                      if (greenStart.y >= 0 && redEnd.y >= 0 && redEnd.y < greenStart.y) {
                        if (nextGreenStart.y >= 0 && nextRedEnd.y >= 0) {
                          redRegions.push(
                            <path
                              key={`red-before-${i}`}
                              d={createFilledRegion(
                                [redEnd, nextRedEnd],
                                [greenStart, nextGreenStart],
                                lane.y,
                                isWestbound
                              )}
                              fill="#f44336"
                              opacity="0.3"
                              data-tooltip-id={isMobile ? undefined : "str-tooltip"}
                              data-tooltip-content={isMobile ? undefined : '"DMZ" between "Sweep" and "Pace" cars'}
                              style={{ cursor: 'default', pointerEvents: isMobile ? 'none' : 'auto' }}
                            />
                          )
                        }
                      }
                    }
                    return redRegions
                  })()}

                  {/* Zone boundary lines - only draw valid segments */}
                  {(() => {
                    const lines = []

                    // Green start line - only when actually starts
                    const validGreenStarts = lane.points.greenStart.filter((p, i) => {
                    // Include points where green actually exists
                      return p.y >= 0 && lane.points.greenEnd[i]?.y > p.y
                    })
                    if (validGreenStarts.length > 0) {
                      lines.push(
                        <path
                          key="green-start"
                          d={createPath(validGreenStarts, lane.y, isWestbound)}
                          stroke="#4caf50"
                          strokeWidth="1.5"
                          fill="none"
                          opacity="0.6"
                        />
                      )
                    }

                    // Green end line
                    const validGreenEnds = lane.points.greenEnd.filter((p, i) => {
                      return p.y > 0 && p.y > lane.points.greenStart[i]?.y
                    })
                    if (validGreenEnds.length > 0) {
                      lines.push(
                        <path
                          key="green-end"
                          d={createPath(validGreenEnds, lane.y, isWestbound)}
                          stroke="#4caf50"
                          strokeWidth="1.5"
                          fill="none"
                          opacity="0.6"
                        />
                      )
                    }

                    // Red end line - only when red zone exists
                    const validRedEnds = lane.points.redEnd.filter((p, i) => {
                      const greenStart = lane.points.greenStart[i]
                      const greenEnd = lane.points.greenEnd[i]
                      // Red exists either before green or after green
                      return p.y >= 0 && (
                        (p.y < greenStart.y && greenStart.y >= 0) || // Red before green
                      (p.y > greenEnd.y && greenEnd.y >= 0) // Red after green
                      )
                    })
                    if (validRedEnds.length > 0) {
                      lines.push(
                        <path
                          key="red-end"
                          d={createPath(validRedEnds, lane.y, isWestbound)}
                          stroke="#f44336"
                          strokeWidth="1.5"
                          fill="none"
                          opacity="0.6"
                        />
                      )
                    }

                    return lines
                  })()}

                  {/* Zone indicators - emoji at optimal positions within zones */}
                  {(() => {
                    const indicators = []

                    // Find optimal position for bike emoji in green zone (quadrilateral)
                    // The green zone is a quadrilateral, we want a point well inside it
                    let greenMinTime = Infinity, greenMaxTime = -Infinity
                    let greenSpaceSum = 0, greenCount = 0

                    for (let i = 0; i < lane.points.greenStart.length; i++) {
                      const greenStart = lane.points.greenStart[i].y
                      const greenEnd = lane.points.greenEnd[i].y
                      const min = lane.points.greenStart[i].x

                      if (greenStart >= 0 && greenEnd > greenStart) {
                        greenMinTime = Math.min(greenMinTime, min)
                        greenMaxTime = Math.max(greenMaxTime, min)
                        // Sample in the middle 60% of the zone to avoid edges
                        const midSpace = greenStart * 0.3 + greenEnd * 0.7
                        greenSpaceSum += midSpace
                        greenCount++
                      }
                    }

                    if (greenCount > 0) {
                    // Place at 40% through time range, weighted average through space
                      const timePos = greenMinTime + (greenMaxTime - greenMinTime) * 0.4
                      const spacePos = greenSpaceSum / greenCount
                      const x = timeToX(timePos, isWestbound)
                      // Shift down to better center the emoji
                      const y = spaceToY(spacePos * 0.85, lane.y, isWestbound)

                      indicators.push(
                        <text
                          key="bike-optimal"
                          x={x}
                          y={y}
                          fontSize="20"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          // opacity="0.8"
                          transform={!isWestbound ? `translate(${x * 2},0) scale(-1,1)` : undefined}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                          data-tooltip-id="str-tooltip"
                          data-tooltip-content={`Bikes use the right lane, and have ${tooltipValues.bikeMinTime}-${tooltipValues.bikeMaxTime} mins to cross (depending on when in the ${tooltipValues.bikePulseMinutes}-minute "pulse" they embark)`}
                        >
                        🚴
                        </text>
                      )
                    }

                    // Find better position for red zone (triangular)
                    // For E/b: red triangle is at the beginning (before green)
                    // For W/b: red triangle is at the end (after green)

                    // Find when red zones actually exist (commented out for now)
                    // let redTimeSum = 0, redSpaceSum = 0, redCount = 0

                    // for (let i = 0; i < lane.points.greenStart.length; i++) {
                    //   const greenStart = lane.points.greenStart[i].y
                    //   const greenEnd = lane.points.greenEnd[i].y
                    //   const redEnd = lane.points.redEnd[i].y
                    //   const min = lane.points.greenStart[i].x

                    //   if (redEnd >= 0) {
                    //     if (!isWestbound && greenStart >= 0 && redEnd < greenStart) {
                    //     // E/b: red before green
                    //       redTimeSum += min
                    //       redSpaceSum += redEnd / 2  // Middle of red zone
                    //       redCount++
                    //     } else if (isWestbound && greenEnd >= 0 && redEnd > greenEnd) {
                    //     // W/b: red after green
                    //       redTimeSum += min
                    //       redSpaceSum += (greenEnd + redEnd) / 2  // Middle of red zone
                    //       redCount++
                    //     }
                    //   }
                    // }

                    // if (redCount > 0) {
                    //   const x = timeToX(redTimeSum / redCount, isWestbound)
                    //   const y = spaceToY(redSpaceSum / redCount, lane.y, isWestbound)
                    //   indicators.push(
                    //     <text
                    //       key="dmz-incenter"
                    //       x={x}
                    //       y={y}
                    //       fontSize="14"
                    //       textAnchor="middle"
                    //       dominantBaseline="middle"
                    //       opacity="0.7"
                    //       transform={`translate(0, -3)`}
                    //     >
                    //       🚫
                    //     </text>
                    //   )
                    // }

                    // Place car emojis in areas that are always grey
                    // Sample times that are typically car-only (normal traffic periods)
                    const carTimes = isWestbound ? [25, 35, 55] : [25, 35, 55]
                    for (const min of carTimes) {
                      const idx = Math.floor((min / 60) * lane.points.greenStart.length)
                      const zones = {
                        greenStart: lane.points.greenStart[idx]?.y || -1,
                        greenEnd: lane.points.greenEnd[idx]?.y || -1,
                        redEnd: lane.points.redEnd[idx]?.y || -1
                      }

                      // Only place car if there are truly no colored zones at this time
                      // Check that both green and red zones are absent
                      const noGreen = zones.greenStart < 0 || zones.greenEnd < 0 || zones.greenEnd <= zones.greenStart
                      const noRed = zones.redEnd < 0 ||
                                  (zones.greenStart >= 0 && zones.redEnd >= zones.greenStart && zones.redEnd <= zones.greenEnd)

                      if (noGreen && noRed) {
                        const x = timeToX(min, isWestbound)
                        const y = spaceToY(0.5, lane.y, isWestbound)
                        indicators.push(
                          <text
                            key={`car-${min}`}
                            x={x}
                            y={y}
                            fontSize="20"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            opacity="0.5"
                            transform={!isWestbound ? `translate(${x * 2},0) scale(-1,1)` : undefined}
                            style={{ userSelect: 'none', pointerEvents: 'none' }}
                            data-tooltip-id="str-tooltip"
                            data-tooltip-content={`Cars have exclusive use of the right lane for ${tooltipValues.rLaneCarPercent}% of the hour`}
                          >
                          🚗
                          </text>
                        )
                      }
                    }

                    return indicators
                  })()}
                </>
              )}
            </g>
          )
        })}

        {/* Current time indicators for both directions */}
        <line
          x1={timeToX(currentMinute % 60, false)}
          y1={topMargin + 2 * (laneHeight + laneGap)}
          x2={timeToX(currentMinute % 60, false)}
          y2={topMargin + 3 * (laneHeight + laneGap) + laneHeight}
          stroke="#000"
          strokeWidth="2"
          opacity="0.8"
        />
        <line
          x1={timeToX(currentMinute % 60, true)}
          y1={topMargin}
          x2={timeToX(currentMinute % 60, true)}
          y2={topMargin + laneHeight + laneGap + laneHeight}
          stroke="#000"
          strokeWidth="2"
          opacity="0.8"
        />

        {/* W/b time axis labels (above) */}
        {(width < 400 ? [0, 30, 60] : [0, 15, 30, 45, 60]).map(min => (
          <g key={`wb-${min}`}>
            <line
              x1={timeToX(min, true)}
              y1={topMargin - 5}
              x2={timeToX(min, true)}
              y2={topMargin}
              stroke="#333"
              strokeWidth="1"
            />
            <text
              x={timeToX(min, true)}
              y={topMargin - 10}
              fontSize="10"
              textAnchor="middle"
              fill="#333"
              style={{ userSelect: 'none' }}
            >
            :{String(min % 60).padStart(2, '0')}
            </text>
          </g>
        ))}

        {/* E/b time axis labels (below) */}
        {(width < 400 ? [0, 30, 60] : [0, 15, 30, 45, 60]).map(min => (
          <g key={`eb-${min}`}>
            <line
              x1={timeToX(min, false)}
              y1={topMargin + 3 * (laneHeight + laneGap) + laneHeight}
              x2={timeToX(min, false)}
              y2={topMargin + 3 * (laneHeight + laneGap) + laneHeight + 5}
              stroke="#333"
              strokeWidth="1"
            />
            <text
              x={timeToX(min, false)}
              y={topMargin + 3 * (laneHeight + laneGap) + laneHeight + 15}
              fontSize="10"
              textAnchor="middle"
              fill="#333"
              style={{ userSelect: 'none' }}
            >
            :{String(min % 60).padStart(2, '0')}
            </text>
          </g>
        ))}

        {/* Y-axis labels - hide on narrow screens */}
        {width >= 500 && (
          <>
        {/* 14th St label for W/b lanes (top two lanes) */}
        <text
          x={leftMargin - 15}
          y={topMargin + 0.5 * (laneHeight + laneGap) + laneHeight/2}
          fontSize="11"
          textAnchor="middle"
          fill="#666"
          transform={`rotate(-90 ${leftMargin - 15} ${topMargin + 0.5 * (laneHeight + laneGap) + laneHeight/2})`}
          style={{ userSelect: 'none' }}
        >
        14th St
        </text>

        {/* 12th St label for E/b lanes (bottom two lanes) */}
        <text
          x={leftMargin - 15}
          y={topMargin + 2.5 * (laneHeight + laneGap) + laneHeight/2}
          fontSize="11"
          textAnchor="middle"
          fill="#666"
          transform={`rotate(-90 ${leftMargin - 15} ${topMargin + 2.5 * (laneHeight + laneGap) + laneHeight/2})`}
          style={{ userSelect: 'none' }}
        >
        12th St
        </text>

        {/* NYC label on the right side (centered) */}
        <text
          x={leftMargin + plotWidth + 15}
          y={topMargin + 2 * (laneHeight + laneGap)}
          fontSize="11"
          textAnchor="middle"
          fill="#666"
          transform={`rotate(90 ${leftMargin + plotWidth + 15} ${topMargin + 2 * (laneHeight + laneGap)})`}
          style={{ userSelect: 'none' }}
        >
        NYC
        </text>
          </>
        )}

      </svg>
      <Tooltip id="str-tooltip" style={{ zIndex: 9999 }} float />
    </div>
  )
}

export const SpaceTimeRects = memo(SpaceTimeRectsComponent)
