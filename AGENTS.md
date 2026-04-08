# Synapse agent notes

## Hard-cut product policy

- This application currently has no external installed user base; optimize for one canonical current-state implementation, not compatibility with historical local states.
- Do not preserve or introduce compatibility bridges, migration shims, fallback paths, compact adapters, or dual behavior for old local states unless the user explicitly asks for that support.
- Prefer one canonical current-state codepath, fail-fast diagnostics, and explicit recovery steps over automatic migration, compatibility glue, silent fallbacks, or temporary second paths.
- If temporary migration or compatibility code is introduced for debugging or a narrowly scoped transition, call it out in the same diff with why it exists, why the canonical path is insufficient, exact deletion criteria, and the ADR/task tracking removal.
- Default stance across the app: delete old-state compatibility code rather than carrying it forward.

## Project shape

- Single-package Vite app. There is no workspace, no CI workflow, and no repo-local lint setup.
- Entrypath is `index.html -> src/main.tsx -> src/app/App.tsx`.
- `App.tsx` owns lifecycle only: it installs `useInputBridge()`, starts/stops `gameRuntime`, lazy-loads `GameViewport`, and renders HUD / map UI.
- `src/game/runtime/GameRuntime.ts` is the execution boundary. It runs its own fixed 60 Hz `requestAnimationFrame` loop outside React and writes `snapshot`, `previousSnapshot`, and `frameAlpha` into Zustand.
- `src/game/sim/*` is the canonical gameplay core. Keep it pure and deterministic; do not mix React, Three, or browser side effects into simulation code.
- `src/game/render/*` mirrors simulation state. Rendering should read from store state and interpolated state, not become a second gameplay authority.
- `src/game/state/gameStore.ts` is the boundary between runtime and UI/render code.
- `src/game/config/tuning.ts` is the source of truth for gameplay feel and balance constants. Change tuning there before adding ad hoc constants elsewhere.
- `src/game/worldgen/*` is deterministic from the universe seed. Preserve that property when changing generation logic.

## Commands that actually matter

- Package manager is locked to `pnpm@10.19.0`.
- `pnpm dev` starts Vite on `0.0.0.0:3000`.
- `pnpm typecheck` runs `tsc --noEmit -p tsconfig.app.json` against `src/` only.
- `pnpm test` runs Vitest once with `--passWithNoTests`. Current tests are pure logic tests under `src/game/**`.
- `pnpm build` is `tsc -b && vite build`. The order matters: TypeScript project references must pass before bundling starts.
- `pnpm preview` serves the built app on `0.0.0.0:4173` and blocks until stopped.

## Verification expectations

- Prefer focused verification: `pnpm typecheck` for type changes, `pnpm test` for simulation/worldgen/camera logic changes.
- `vite build` alone is not a typecheck. If you need a full production verification, use `pnpm build`, not just the Vite half.
- There are no repo-managed git hooks, so do not assume pre-commit or CI will catch mistakes for you.
- There are no `.env` files or required runtime env vars in this repo.

## Testing and architecture gotchas

- Vitest uses defaults because there is no dedicated Vitest config. Tests currently run in the Node environment, not jsdom.
- If you add tests that depend on DOM, Canvas, or browser APIs, you will need to add explicit Vitest environment config first.
- `useGameStore.getState()` / store API access from `GameRuntime` is intentional. Do not try to move the runtime loop into React state.
- Render smoothing depends on `previousSnapshot` + `snapshot` + `frameAlpha`. When changing runtime writes, preserve that interpolation contract.
- `App.tsx` lazy-loads `GameViewport`, and `GameViewport` wraps `SpaceScene` in `Suspense`. Keep that boundary intact for any async render-side loaders.

## R3F / Rapier constraints

- R3F hooks such as `useFrame` and `useThree` only work inside the `<Canvas>` tree.
- `@react-three/rapier` is installed but not wired into the current scene. If you introduce Rapier, keep physics inside Suspense and align any fixed timestep with the existing 60 Hz runtime instead of creating competing simulation authorities.
- Do not add a second gameplay loop inside render code. The current canonical owner of simulation advancement is `GameRuntime`.

## Generated artifacts

- `dist/` and `*.tsbuildinfo` are generated outputs.
