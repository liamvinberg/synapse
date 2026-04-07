import { create } from 'zustand';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import type { GameSnapshot, InputState } from '@/game/sim/types';

const initialInputState: InputState = {
  aim: { x: 0, y: 0 },
  boost: false,
  brake: false,
  fire: false,
  strafeLeft: false,
  strafeRight: false,
  thrustBackward: false,
  thrustForward: false,
};

export interface GameStore {
  frameAlpha: number;
  input: InputState;
  isRuntimeRunning: boolean;
  previousSnapshot: GameSnapshot;
  setFrameAlpha: (frameAlpha: number) => void;
  setInputPatch: (patch: Partial<InputState>) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  snapshot: GameSnapshot;
}

const initialSnapshot = createInitialSnapshot('synapse-foundation');

export const useGameStore = create<GameStore>((set) => ({
  frameAlpha: 0,
  input: initialInputState,
  isRuntimeRunning: false,
  previousSnapshot: initialSnapshot,
  setFrameAlpha: (frameAlpha) => {
    set({ frameAlpha });
  },
  setInputPatch: (patch) => {
    set((state) => ({ input: { ...state.input, ...patch } }));
  },
  setSnapshot: (snapshot) => {
    set((state) => ({ previousSnapshot: state.snapshot, snapshot }));
  },
  snapshot: initialSnapshot,
}));
