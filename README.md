# Synapse

Synapse is a performance-first browser space game foundation.

## Principles

- React owns app shell and HUD, not per-frame gameplay state.
- Game simulation stays separate from render objects.
- World generation is deterministic and descriptor-first.
- Large-world concerns like floating origin are accounted for early.

## Scripts

- `pnpm dev` — run the Vite development server
- `pnpm build` — typecheck and create a production build
- `pnpm typecheck` — run strict TypeScript checks
- `pnpm test` — run Vitest
