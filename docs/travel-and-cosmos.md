# Synapse travel and cosmos direction

This note defines the first canonical travel model for Synapse and records the
constraints for future planet generation.

## Travel layers

Synapse should separate movement scale from simulation scale and give each layer
its own feel.

The canonical direction now has three travel verbs:

1. **Boost**
   - a local combat and repositioning verb
   - short, expressive, energy-gated
   - never becomes hyperspace
2. **Cruise**
   - a local traversal verb for crossing a system space or moving between points
     of interest without dead time
   - forward-biased and interrupted by combat pressure, damage, or suppressors
3. **Hyperspace**
   - an inter-system world-transition verb
   - selected from the map, confirmed in flight, then committed through spool

The UI and map model should support three corresponding layers:

1. **Local flight instrument**
   - always-on navigation context during combat and exploration
   - shows nearby planets, orientation, and immediate route context
2. **System navigation layer**
   - used for local route planning inside the current star system
   - shows planets, important points of interest, and mission destinations
3. **Galaxy route map**
   - used for selecting a neighboring or longer-range destination system
   - drives hyperspace route arming and jump commitment

## Travel state rules

The canonical travel state machine should now be treated as:

- `local`
- `route_armed`
- `spooling`
- `in_transit`
- `arriving`

Rules:

- the player selects a destination from the galaxy route map
- closing the map returns the player to flight with a visible route/alignment
  indicator in the world and HUD
- the player should have to face or meaningfully align with the route before
  committing the jump
- hyperspace requires a dedicated hold-to-spool input (`H` in the current
  control language)
- spool should take roughly `3–7s` depending on tuning and destination context
- boost never becomes hyperspace
- brake never becomes hyperspace
- hostile suppression or similar future mechanics should be allowed to block or
  interrupt spool
- transit should feel like a deliberate Star Wars-style stretch/tunnel beat,
  not an instant cut
- arrival should play its own exit beat and reset the ship to a stable,
  readable entry state in the destination system

## Map/UI rules

- local and system maps live in the React overlay layer, not in the 3D scene
- render code continues to mirror simulation state only
- map UI reads deterministic data from the runtime/store boundary
- route planning and jump commitment are separate actions
- selecting a destination should not instantly jump the player
- after route selection, the HUD should help the player reorient in normal
  flight before spool begins
- hyperspace should include a clear sequence:
  - route armed
  - alignment / readiness cue
  - hold-to-spool
  - point of no return
  - transit effect
  - arrival effect

## Planet generation direction

The first planets can stay simple, but the long-term direction should be guided
by recognizable physical patterns rather than pure noise.

Canonical constraints:

- planets should belong to a star system context, not appear as totally isolated
  random bodies
- size, orbit distance, and color should come from a deterministic family of
  system parameters
- hotter inner worlds and colder outer worlds should become more likely over
  time
- gas giants, rocky worlds, ice worlds, and rare unusual worlds should each use
  distinct generation bands
- visuals can stylize reality, but the underlying distribution should feel like
  it follows rules

This means future planet generation should move toward:

- star class influencing planet families
- orbit bands influencing temperature/material expectations
- biome templates layered on top of deterministic physical ranges
- visual noise only after the physical category is chosen

The local navigation and mission loop should treat planets as anchors for play:

- missions can happen near specific planets, rings, debris fields, and orbital
  lanes
- planets should help communicate where a fight or route belongs in the system
- a star system should read as a place with internal structure, not just a sky
  full of unrelated markers

## Mission-loop relationship

Travel should support the mission loop directly.

The intended shape is:

1. accept mission at a hub
2. route to destination system or local zone
3. use local flight / cruise to reach the active encounter space
4. resolve the encounter, escalation, or boss objective
5. extract, continue, or return for payout and standing

If a travel step is not making the mission loop more readable, more dramatic, or
more consequential, it is probably unnecessary.

## Rule of thumb

If a traversal or planet idea makes the universe feel larger and more readable
without turning it into simulation busywork, it is probably right for Synapse.
