It's still broken. Time for a refactor:
- `Tunnel` class: represents 2 lanes in one direction (E, W), contains 60 *
  BIKES_PER_MINUTE=.25 bikes, 60 * CARS_PER_MINUTE=1 cars. Contains an "offset" that is
  the time when all bikes are in pen, and pen opens to release bikes (for
  PEN_OPEN_MINUTES=3 minutes). Current offsets are :45 (E) and :15 (W), but at this level
  it's configurable, and all computations can be done relative to its "zero minute". A
  `Tunnel` also contains and manages its Green and Red rects. It should also take a
  length (in miles, =2), car speed, bike uphill and downhill speeds, pen relative
  position and offset (from R Lane start), and px width and height for the lanes
  themselves.
- `Tunnels`: contains two `Tunnel`s (one E, one W), one `Sweep`, and one `Pace`.
- At instantiotion, a Tunnel should help its Bike and Car children obtain a sorted list
  of (time,position) tuples, that contains everything required to infer their position
  at any time.

Both `Tunnel`s in a `Tunnels` will have references to the same `Pace`/`Sweep`, since
those are "global" in a `Tunnels`.

I want to get away from all this stuff like `const penOpenMinute = this.data.direction
  === 'east' ? 45 : 15` in `Bike` class. They shouldn't have to know about that. Bikes
all do roughly the same thing, though their pen waiting position and x-offset while
transiting tunnel are slightly different from one another (determined by their overall
idx / spawn minute). Same with Cars. The containing Tunnel should abstract away as much
of that as possible. Similarly, the containing `Tunnels` can even handle flipping (and
time-offseting) things so that E/b and W/b are rendered with the same code paths.
