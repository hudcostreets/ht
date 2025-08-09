# Holland Tunnel Bike Lane Concept Visualization

This is an interactive web visualization demonstrating how one of two lanes of the Holland Tunnel can be used, for 10 minutes of each hour, to allow bikes through. In each direction, the right lane alternates between car and bike access, on a scheduled basis.

`Tunnels` is the outer data model, which owns two `Tunnel`s (one Eastbound a.k.a. E/b, one Westbound a.k.a. W/b), and `Pace` and `Sweep` vehicles that operate globally in both directions, making a round trip every `period` minutes.

Each `Tunnel` contains pre-instantiated `Car` and `Bike` objects that represent vehicles that will approach the tunnel (fading in from upstream of the entrance), transit through it, and fade out on exit (before resetting to their "origin" point). The `Tunnel` class manages the lane configuration, vehicle "spawning" / queueing, and animation logic. Every moveable object is a `TimeVal` which contains (time,val) tuples and interpolates between them to determine its position at any given time. `period` determines a number of minutes after which the whole "universe" resets.

## Technical Stack
- **React + TypeScript** - Component-based UI
- **Vite** - Build tool and dev server
- **pnpm** - Package manager
- **SVG** - 2D visualization rendering
- **Session Storage** - State persistence across refreshes

## Key Features
- **Time-based Animation**: Virtual 60-minute cycle, animated at an adjustable speed
- **Deterministic System**: All vehicle positions through the cycle are pre-computed (and varied based on respective "spawn" times)
- **Phase Management**:
  - Normal traffic (cars only; default)
  - "Bike pen" opens, bikes enter (R lane becomes dedicated bike lane)
  - Buffer phase: bike pen closes, sweep van embarks a few minutes later (picking up stragglers, as needed).
  - Pace car embarks, normal traffic follows it.
- **Interactive Controls**:
  - Play/pause (Space key)
  - Left/Right arrow keys step forward/backward by 1 (virtual minute); alt/option modifier increments by 0.1mins.
  - Adjustable animation speed

## Vehicle Types & Speeds (default values)
Vehicle speeds, spawn frequencies, and layout sizes are parameterized, and positions and layout math is computed based on `TunnelConfigs` and `LAYOUT` objects. By default:
- Cars go 24 mph, spawn 1 per minute per lane.
- Bikes go 15 mph downhill / 8 mph uphill, and spawn 1 every 4 minutes (queueing in a "bike pen" for each direction).
- Sweep van goes 12 mph, makes round trips.
- Pace car goes 20 mph, leads cars back into R lane after bikes and sweep have cleared (also makes round trips).

## Lane Configuration
- **L Lane** (Left): Always open for cars
- **R Lane** (Right): Alternates between cars and bikes
- Eastbound and Westbound operate on schedules offset by 30 minutes (by default)

## Color Rects/Zones
- **Gray**: Car lanes / space (default)
- **Green**: Space cleared for bikes
- **Red**: DMZ (no-man's land) between sweep and pace vehicles (while transitioning from bikes back to cars)

### Implementation
- Color zones are calculated in `Tunnel.ts` via the `initColorZones()` method
- Zones are represented as a tuple `[greenStart, greenEnd, redEnd] | null` indicating x-coord positions; when present, green and red rects are drawn in the tunnel's R lane, between `[greenStart,greenEnd]` and `[greenEnd,redEnd]`, resp.
- The `getColorRectangles()` method returns the current zones based on time
- Zones are rendered as semi-transparent rectangles overlaid on the (grey) R lane.

## Commands
```bash
pnpm install      # Install dependencies
pnpm run dev      # Start dev server (Note: this runs continuously, don't use in Claude)
pnpm run build    # Build for production
pnpm run lint     # Run linter
```

## Development Environment Limitations
- Don't try to run dev servers (e.g. `pnpm run dev`) because they never exit.
- Don't try to use `open` to directly open a browser.
- Don't try to take screenshots directly - use a headless browser.

## Taking Screenshots
- Use `node take-screenshots.mjs <minute1> <minute2> ...` to capture specific minutes
- Assumes dev server is already running at localhost:5173
- Screenshots are saved to `tmp/XX.png` where XX is the minute

## Key Files
- `src/components/Tunnels.tsx` - Main visualization component
- `src/components/Tunnel.tsx` - instantiated twice (E/b and W/b)
- `src/components/AnalogClock.tsx` - Animated clock display
- `src/components/Tunnel.css` - Styling
- `src/models/Vehicle.ts` - interface implemented by `Car`, `Bike`, `Sweep`, and `Pace` subclasses; encapsulates vehicle [position x time] logic.

## Important Notes
- Data model classes live in `src/models/`; most timeseries logic is implemented there, and unit-tested.
- Vehicles fade in/out just upstream/downstream of tunnel entrances/exits.
- Cars that arrive just as the "bike pen" is opened become the first cars in a queue, which waits for the pace car to open that R lane back up to cars. By default, the bike pens open for 3mins on the :45 (E/b) and :15 (W/b).
- The first queued bike should be at the tunnel entrance at the moment the bike pen opens.
- All times should be in terms of simulated/virtual "minutes", which can be scaled by the configurable "speed" setting.

## Queueing Logic

### Car Queueing (R Lane)
- R lane cars arriving during minutes [0,10) (bike phases) must queue.
- Queue position (x-coord) is determined by `offsetPx` (spacing between queued cars).
- When pace car starts at :10 (tunnel-relative), queued cars begin moving behind it, in lockstep.
- Cars spawning while queue is draining should join the end of the queue (and spawn upstream of it by the usual relative x-offset).
- Queueing logic is implemented in `Tunnel.ts` (including  `spawnQueue.{offset,minsBeforeDequeueing,minsDequeueing}` metadata for each `Car` and `Bike`, which helps them instantiate their `points` array, which pre-determines their position at any queried "mins" time-val).

### Bike Queueing (Pen)
- Bikes can only enter tunnel during minutes [0-3) (by default; the "pen open" window)
- Bikes arriving during minutes [3-60) must queue in the pen
- Bikes are released at a rate of `bikesReleasedPerMin` (default: 5 per min)
- Pen arrangement should be configurable (grid layout with N bikes per row)
- Bikes spawning while queue is draining should go to the end of the (draining) queue
- Similar to cars, bikes are instantiated with `spawnQueue` metadata (computed by their containing `Tunnel`) to determine their queue (`XY`) position.

## Time Units
All time values throughout the codebase use **minutes** as the unit:
- Absolute time is in minutes (a.k.a. "min" or "mins" values; [0-60) for each hour, wrapping at 60)
- `Tunnel`s operate on "mins" values relative to a "0" (when their bike pen opens), along with an `offsetMin` (:15 for W/b, :45 for E/b, by default) indicating which "min" of their parent `Tunnels` corresponds to their "0".
- Transiting times, delays, etc. are all `number`s (fractional minutes, "mins")
- Animation speed is in (virtual) minutes per (real) second
- When writing tests, use minutes directly (e.g., `bike.getPos(45)` for minute 45)
