# Holland Tunnel Bike Lane Concept Visualization

## Project Overview
This is an interactive web visualization demonstrating a time-share concept for bike lanes in the Holland Tunnel. The concept alternates one lane between cars and bikes on a scheduled basis.

`Tunnels` is the outer data model, which owns two `Tunnel`s (one Eastbound a.k.a. E/b, one Westbound a.k.a. W/b), and `Pace` and `Sweep` vehicles that operate globally across both directions, transitioning between them every `period/2` minutes.

Each `Tunnel` contains pre-instantiated `Car` and `Bike` objects that represent vehicles moving through the tunnel. The `Tunnel` class manages the lane configuration, vehicle "spawning" / queueing, and animation logic. Every moveable object is a `TimeVal` which contains (time,val) tuples and interpolates between them to determine its position at any given time. `period` determines a number of minutes after which the whole "universe" resets.

## Technical Stack
- **React + TypeScript** - Component-based UI
- **Vite** - Build tool and dev server
- **pnpm** - Package manager
- **SVG** - 2D visualization rendering
- **Session Storage** - State persistence across refreshes

## Key Features
- **Time-based Animation**: Virtual 60-minute cycle with adjustable speed
- **Deterministic System**: All vehicle positions calculated from spawn time
- **Phase Management**: 
  - Normal traffic (cars only)
  - Bikes enter (dedicated bike lane)
  - Clearing phase
  - Sweep van
  - Pace car + cars resume
- **Interactive Controls**:
  - Play/pause (Space key)
  - Step forward/backward by minute (Arrow keys)
  - Speed adjustment (0.5x - 10x)

## Vehicle Types & Speeds (default values)
- **Cars**: 24 mph, spawn 1 per minute per lane
- **Bikes**: 15 mph downhill, 8 mph uphill, spawn 1 every 4 minutes
- **Sweep Van**: 12 mph, makes round trips
- **Pace Car**: 20 mph, leads cars back after bike phase

## Lane Configuration
- **L Lane** (Left): Always open for cars
- **R Lane** (Right): Alternates between cars and bikes
- Eastbound and Westbound operate on 30-minute offset schedules

## Color Coding
- **Gray**: Car lanes
- **Green**: Space cleared for bikes
- **Yellow**: Area where bikes have traveled
- **Red**: DMZ (no-man's land) between sweep and pace vehicles

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
- `src/components/HollandTunnel.tsx` - Main visualization component
- `src/components/AnalogClock.tsx` - Animated clock display
- `src/components/HollandTunnel.css` - Styling
- `src/models/Vehicle.ts` - Contains Car and Bike classes that encapsulate vehicle position logic

## Important Notes
- Data model classes live in `src/models/`; most timeseries logic can be implemented there, and unit-tested.
- Vehicles fade in/out at tunnel entrances/exits
- Cars that arrive just as the "bike pen" is opened become the first cars in a queue" that waits for the pace car to open the tunnel back up to cars. By default, the bike pens open for 3mins at :45 (E/b) and :15 (W/b).
- The first queued bike should be at the tunnel entrance at the moment the bike pen opens.
- All times should be in terms of simulated/virtual "minutes", which can be scaled by the configurable "speed" setting.

## Time Units
**IMPORTANT**: All time values throughout the codebase use **minutes** as the unit:
- Absolute time is in minutes (0-59 for each hour, wrapping at 60)
- Relative time is in minutes (0-59 within each tunnel's cycle)
- Transit times, delays, etc. are all in fractional minutes
- The UI component (`HollandTunnelNew.tsx`) also uses minutes internally
- Animation speed is in minutes per frame (at 60fps, speed=1 means 1 minute of simulation per real second)
- When writing tests, use minutes directly (e.g., `bike.getPos(45)` for minute 45)
