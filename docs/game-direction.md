# Synapse game direction

This note exists to preserve the current direction without turning it into a
large spec.

## What Synapse is trying to be

Synapse is not aiming for hard flight simulation.

The target feel is:

- third-person space action
- readable boss fights
- deliberate movement and punish windows
- mobility that feels expressive without becoming chaotic

The reference is closer to a Souls-like combat rhythm in space than to a full
dogfighting sim.

## Controller direction

The current foundation is built around an **action-flight** controller.

### Current input language

- cursor steers the ship's facing
- `W / S` handles forward and reverse thrust
- `A / D` handles strafing
- `Shift` boosts
- `Space` brakes

### Why this direction

This keeps the ship readable during combat and gives bosses room to telegraph.
The ship should feel like an action character in space, not like an aircraft
that demands constant roll-management.

### Long-term evolution

The likely long-term model is:

- free action-flight by default
- soft target assist for regular enemies
- optional hard lock-on for bosses
- short dodge burst for timing-based defense
- longer boost for chase, disengage, and repositioning

Lock-on should help framing and readability. It should not solve the fight for
the player.

## Combat pillars

The combat foundation should support these loops:

1. pressure the target
2. break shields or create vulnerability
3. punish openings with stronger commitment
4. build stagger and create bigger punish windows

This is why the ship now tracks these resources:

- hull
- shield
- stagger
- boost energy

## Systems already established in code

- fixed-step runtime loop
- deterministic sector generation
- camera-relative rendering
- interpolated render state between sim ticks
- pure ship controller step
- pure damage resolution step

These boundaries matter because they keep future combat, missions, and co-op
from being mixed directly into render code.

## Near-term systems to build next

These should come before broader content work:

1. targeting system
   - soft assist
   - boss lock-on
   - target cycling
2. dodge / burst movement
3. weapon model
   - light pressure weapon
   - heavy punish weapon
4. enemy state machine
   - pursuit
   - telegraph
   - attack
   - recovery
   - staggered
5. one boss prototype designed around readability

See also:

- [`docs/weapon-model.md`](./weapon-model.md) - first canonical weapon split

## Things we are deliberately not doing yet

- full flight sim controls
- seamless landable planets
- multiplayer-first architecture
- bloated combat stat systems
- deep content pipelines before the combat loop feels right

## Rule of thumb for future decisions

If a new idea improves realism but hurts readability, recovery windows, or boss
clarity, it is probably the wrong direction for Synapse.
