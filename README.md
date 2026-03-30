# Synapse

Synapse is a performance-first browser space game foundation built to keep the
simulation, rendering, and app shell separate from the start.

## Architecture

```txt
src/
  app/          React shell, HUD, input bridge
  game/
    input/      keyboard bridge and future input adapters
    render/     R3F scene, camera rig, visual components
    runtime/    fixed-step runtime loop and execution boundaries
    sim/        pure state and deterministic simulation updates
    state/      Zustand store used as the runtime boundary
    worldgen/   seeded sector and planet generation
```

## Design rules

- React owns menus, overlays, and lifecycle.
- The runtime loop owns simulation ticks.
- Render objects mirror simulation state; they do not own it.
- Sector generation is deterministic from a seed.
- Camera-relative rendering is baked into the first scene setup.

## Scripts

- `pnpm dev` — run the Vite development server
- `pnpm build` — typecheck and create a production build
- `pnpm typecheck` — run strict TypeScript checks
- `pnpm test` — run Vitest
