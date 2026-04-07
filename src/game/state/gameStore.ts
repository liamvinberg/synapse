import { create } from 'zustand';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import type { GameSnapshot, InputState, SectorCoordinate } from '@/game/sim/types';

const initialInputState: InputState = {
  aim: { x: 0, y: 0 },
  aimDownSights: false,
  boost: false,
  brake: false,
  fire: false,
  hyperCommit: false,
  strafeLeft: false,
  strafeRight: false,
  thrustBackward: false,
  thrustForward: false,
};

export interface GameStore {
  galaxyMapOpen: boolean;
  frameAlpha: number;
  input: InputState;
  isRuntimeRunning: boolean;
  previousSnapshot: GameSnapshot;
  selectTravelTarget: (targetSystem: SectorCoordinate | null) => void;
  setGalaxyMapOpen: (open: boolean) => void;
  setFrameAlpha: (frameAlpha: number) => void;
  setInputPatch: (patch: Partial<InputState>) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  snapshot: GameSnapshot;
}

const initialSnapshot = createInitialSnapshot('synapse-foundation');

export const useGameStore = create<GameStore>((set) => ({
  galaxyMapOpen: false,
  frameAlpha: 0,
  input: initialInputState,
  isRuntimeRunning: false,
  previousSnapshot: initialSnapshot,
  selectTravelTarget: (targetSystem) => {
    set((state) => ({
      previousSnapshot: state.snapshot,
      snapshot: {
        ...state.snapshot,
        travel: {
          ...state.snapshot.travel,
          progress: 0,
          targetSystem,
        },
      },
    }));
  },
  setGalaxyMapOpen: (open) => {
    set({ galaxyMapOpen: open });
  },
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
