# Synapse weapon model

This note defines the first canonical weapon split for Synapse.

It exists to turn the combat direction into something implementable without
adding multiple overlapping weapon ideas at once.

## Goal

The weapon model should support this loop:

1. apply pressure
2. create or recognize an opening
3. commit to a punish
4. cash out with shield break, stagger, or burst damage

The weapon set should feel readable in third-person space combat and should not
depend on hard simulation complexity to be interesting.

## Canonical first loadout

Synapse should start with exactly two player weapons:

- **Primary:** light pressure weapon
- **Secondary:** charged punish weapon

These weapons must have clearly different jobs. The secondary should not be a
slightly stronger version of the primary.

## Input contract

- **Left click:** fire primary weapon
- **Right click hold:** charge secondary weapon
- **Right click release:** fire charged secondary weapon

If the player stops aiming, boosts, dodges, or is interrupted by a future hard
stagger state, the charge should cancel unless there is a specific reason not
to.

This keeps the secondary as a commitment action instead of free background DPS.

## Primary weapon: pressure cannon

### Role

The primary weapon exists to maintain pressure, test defenses, and keep the
player active between larger commitment windows.

### Feel target

- quick response
- low commitment
- stable cadence
- accurate enough to feel dependable
- moderate shield damage
- low stagger contribution per hit
- low to medium hull damage

### Intended use

Use the primary to:

- keep enemies engaged
- chip shields
- force movement
- maintain damage during neutral states
- fill the space between dodge, boost, and heavy punish windows

### Not intended to do

The primary should not:

- erase enemies during punish windows by itself
- outclass the charged weapon on burst
- dominate stagger generation alone

## Secondary weapon: charged rail lance

### Recommendation

The first heavy weapon should be a **charged rail lance** fired on right click
release.

This should be a single high-commitment projectile or near-instant bolt with a
strong visual line, not a sustained beam.

### Why this is the best first heavy weapon

It fits the game better than a continuous beam or lock-on missile because it:

- gives a clear punish tool without requiring a large new targeting system
- creates strong readability in boss fights
- keeps the combat loop focused on pressure into payoff
- is easier to tune than a sustained beam
- can later evolve into more specialized variants without replacing the model

### Role

The charged rail lance is the player's punish weapon.

Its job is to:

- punish exposed enemies
- hit harder into stagger windows
- contribute meaningful shield break pressure
- reward choosing the right firing moment instead of constant firing

### Feel target

- visible charge-up
- strong anticipation audio
- obvious release payoff
- noticeably slower cadence than primary
- meaningful recovery after release
- high confidence shot, not spam

### Recommended behavior

#### Charge thresholds

Use three states instead of fully continuous scaling.

This makes the weapon easier to read and tune.

Suggested thresholds:

- **Quick charge:** `0.25s`
- **Mid charge:** `0.75s`
- **Full charge:** `1.25s`

#### Release behavior

- Releasing before `0.25s` cancels the shot
- Releasing between `0.25s` and `0.75s` fires a weak partial charge
- Releasing between `0.75s` and `1.25s` fires a strong mid charge
- Releasing at or after `1.25s` fires the full charge shot

Do **not** auto-fire at max charge in the first implementation. Requiring
release keeps player intent clearer and makes the commitment feel deliberate.

### Damage identity

The charged rail lance should be weighted toward:

- high stagger contribution
- strong shield damage
- solid but not absurd hull damage

That means the weapon is best when used either:

- to force a shield break sooner, or
- to cash out during a vulnerability window

### On-hit behavior by charge level

#### Partial charge

- useful if player has to release early
- modest damage
- small stagger contribution
- mostly a salvage state, not the goal

#### Mid charge

- reliable punish option
- strong shield damage
- meaningful stagger gain
- acceptable general-purpose heavy hit

#### Full charge

- strongest burst state
- highest stagger value
- strongest shield damage
- optional mild line pierce or impact shock ring

The full charge shot should feel exceptional, but not become the only correct
way to play.

## Suggested first tuning band

These are starting ranges, not final values.

### Primary

- fire interval: `0.10s - 0.16s`
- hull damage baseline: `1x`
- shield damage multiplier: `1.0x - 1.15x`
- stagger contribution: low

### Charged rail lance

- minimum usable charge: `0.25s`
- full charge time: `1.25s`
- post-fire recovery: `0.35s - 0.55s`
- partial charge hull damage: `2.0x - 2.5x` primary shot
- mid charge hull damage: `4.0x - 5.0x` primary shot
- full charge hull damage: `6.0x - 8.0x` primary shot
- partial charge stagger: low-medium
- mid charge stagger: medium-high
- full charge stagger: high
- shield damage multiplier: higher than hull damage multiplier at every tier

The heavy weapon should generally scale more through **stagger and shield
pressure** than through raw hull deletion.

## Resource and commitment rules

The first implementation should keep cost simple.

Use **time commitment** as the primary cost, not a new weapon energy system.

That means the heavy weapon is gated by:

- charge time
- release recovery
- risk of losing the shot if the player has to dodge or reposition

Only add a dedicated ammo or heat system later if tuning shows timing cost is
not enough.

## Camera and presentation rules

The heavy weapon must be readable from the current third-person camera.

That means:

- charge VFX should live clearly on the ship nose or hardpoint
- the charge state should be legible before release
- the full charge release should have a stronger tracer, flash, and impact
- the player should not need UI bars to understand basic charge state

UI can reinforce the charge, but the ship itself should communicate it first.

## Future expansions that fit this model

Once the primary and charged lance feel good, future heavy variants can branch
from the same role family:

- shield-break beam
- piercing lance
- lock-assisted missile punish
- burst flak punish for large targets

These should come later. The first goal is to prove that **pressure into
punish** feels good.

## Explicit recommendation

Build this first:

- left click pressure cannon
- right click hold / release charged rail lance

If only one heavy weapon prototype is built in the near term, it should be the
charged rail lance.

It is the cleanest match for the current combat pillars and the most efficient
way to learn whether Synapse's punish loop is actually working.
