# Holland Tunnel Bike Lane Concept Visualization

## Project Overview
This is an interactive web visualization demonstrating a time-share concept for bike lanes in the Holland Tunnel. The concept alternates one lane between cars and bikes on a scheduled basis.

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

## Vehicle Types & Speeds
- **Cars**: 20 mph, spawn 1 per minute per lane
- **Bikes**: 15 mph downhill, 8 mph uphill, spawn 1 per 4 minutes
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
pnpm run typecheck # Run TypeScript checks
```

## Development Environment Limitations
- Cannot run dev server (`pnpm run dev`) - it runs continuously
- Cannot use `open` command to open browsers
- Cannot take screenshots directly - need to use headless browser tools

## Key Files
- `src/components/HollandTunnelDeterministic.tsx` - Main visualization component
- `src/components/AnalogClock.tsx` - Animated clock display
- `src/components/HollandTunnel.css` - Styling
- `src/models/Vehicle.ts` - Contains Car and Bike classes that encapsulate vehicle position logic

## Important Notes
- **Always check `src/models/` for existing classes before implementing logic inline** - The Car and Bike classes already handle position calculations and movement logic
- Vehicles fade in/out at tunnel entrances/exits
- :45 E/b and :15 W/b cars queue and enter after pace car
- First bike stages at tunnel entrance when bike phase begins
- All timing uses simulated/virtual time scaled by speed setting