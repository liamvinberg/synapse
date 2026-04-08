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
- mission-driven structure with clear travel and return beats

The reference is closer to a Souls-like combat rhythm in space than to a full
dogfighting sim.

## Near-term player loop

Synapse should move toward a clear mission loop instead of a pure free-flight
sandbox.

The canonical near-term loop is:

1. arrive at a hub or safe station
2. review contracts from one or more factions
3. stack one or more missions headed toward the same destination when possible
4. travel to the target system or local zone
5. resolve the local objective through combat, pursuit, escort, scan, or boss
   escalation
6. extract or return to a station for payout, standing, and upgrades

The important part is that travel exists to support missions and encounters, not
to become its own simulation chore.

## Mission and faction direction

Synapse should lean toward a factional structure closer to crime-action games
than to a neutral mission kiosk.

The first canonical faction model should assume three broad groups:

- **Authority**
  - law, security, patrol, suppression, escort, and bounty work
- **Outlaws**
  - raids, theft, smuggling, sabotage, ambush, and extraction jobs
- **Rebels**
  - insurgent strikes, rescues, intel recovery, disruption, and asymmetric fights

These are role categories, not final lore names.

The player should be able to lean toward a side through repeated work without
forcing a single irreversible morality choice in the first implementation.

This means the progression layer should favor:

- faction standing / reputation
- better contracts and more dangerous opportunities from the groups you support
- mission chains that reveal faction perspective through play rather than lore
  dumps

The goal is not to become an MMO reputation spreadsheet. The goal is to make
mission choice feel like choosing who you are helping or hurting.

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
6. mission board / contract flow
   - location-tagged contracts
   - stackable jobs toward the same route
   - payout plus faction standing
7. hub loop
   - briefing
   - payout / debrief
   - lightweight upgrade step
8. travel ceremony
   - route planning
   - alignment indicator
   - hyperspace spool and arrival beat

See also:

- [`docs/weapon-model.md`](./weapon-model.md) - first canonical weapon split

## Things we are deliberately not doing yet

- full flight sim controls
- seamless landable planets
- multiplayer-first architecture
- irreversible faction-lock morality systems in the first pass
- bloated combat stat systems
- deep content pipelines before the combat loop feels right

This does **not** mean Synapse should ignore future co-op.

The intended rule is:

- build a strong solo-first mission loop now
- keep mission state, faction state, and travel state compatible with future co-op
- avoid designing the entire game around multiplayer infrastructure before the
  combat and mission loop are proven

## Rule of thumb for future decisions

If a new idea improves realism but hurts readability, recovery windows, or boss
clarity, it is probably the wrong direction for Synapse.
