# Synapse travel and cosmos direction

This note defines the first canonical travel model for Synapse and records the
constraints for future planet generation.

## Travel layers

Synapse should separate movement scale from simulation scale.

- **Boost** is a local movement verb.
- **Hyperspace** is a navigation and world-transition verb.

The canonical first implementation has two map layers:

1. **Local planet map**
   - used during normal flight
   - shows current planets in the active local space
   - supports readable exploration and combat positioning
2. **System hyper map**
   - used for selecting neighboring star systems
   - shows deterministic nearby systems around the current system
   - drives hyperspace spool and system jumps

The likely future third layer is a galaxy map for long-range travel, but that is
not part of the first implementation.

## Travel state rules

The canonical first travel state machine is:

- `local`
- `spooling`

Rules:

- the player must select a destination on the system map
- hyperspace requires a dedicated hold-to-spool input
- boost never becomes hyperspace
- brake never becomes hyperspace
- jump completion resets the ship to a stable arrival state in the destination
  system

## Map/UI rules

- local and system maps live in the React overlay layer, not in the 3D scene
- render code continues to mirror simulation state only
- map UI reads deterministic data from the runtime/store boundary

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

## Rule of thumb

If a traversal or planet idea makes the universe feel larger and more readable
without turning it into simulation busywork, it is probably right for Synapse.
