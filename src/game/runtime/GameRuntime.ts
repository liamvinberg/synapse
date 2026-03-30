import type { StoreApi } from 'zustand';
import { stepSimulation } from '@/game/sim/stepSimulation';
import type { GameStore } from '@/game/state/gameStore';
import { useGameStore } from '@/game/state/gameStore';

const FIXED_TIMESTEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 100;

export class GameRuntime {
  private frameHandle: number | null = null;
  private lastFrameTimeMs: number | null = null;
  private accumulatorMs = 0;

  constructor(private readonly store: StoreApi<GameStore>) {}

  start(): void {
    if (this.frameHandle !== null) {
      return;
    }

    this.store.setState({ isRuntimeRunning: true });
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }

    this.lastFrameTimeMs = null;
    this.accumulatorMs = 0;
    this.store.setState({ frameAlpha: 0, isRuntimeRunning: false });
  }

  private readonly tick = (frameTimeMs: number): void => {
    if (this.lastFrameTimeMs === null) {
      this.lastFrameTimeMs = frameTimeMs;
    }

    const frameDeltaMs = Math.min(
      frameTimeMs - this.lastFrameTimeMs,
      MAX_FRAME_DELTA_MS,
    );
    this.lastFrameTimeMs = frameTimeMs;
    this.accumulatorMs += frameDeltaMs;

    let previousSnapshot = this.store.getState().previousSnapshot;
    let currentSnapshot = this.store.getState().snapshot;

    while (this.accumulatorMs >= FIXED_TIMESTEP_MS) {
      const input = this.store.getState().input;
      previousSnapshot = currentSnapshot;
      currentSnapshot = stepSimulation(
        currentSnapshot,
        input,
        FIXED_TIMESTEP_MS / 1000,
      );
      this.accumulatorMs -= FIXED_TIMESTEP_MS;
    }

    this.store.setState({
      frameAlpha: this.accumulatorMs / FIXED_TIMESTEP_MS,
      previousSnapshot,
      snapshot: currentSnapshot,
    });
    this.frameHandle = requestAnimationFrame(this.tick);
  };
}

export const gameRuntime = new GameRuntime(useGameStore);
