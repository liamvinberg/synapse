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

export type MapLayer = 'none' | 'local' | 'system';

export interface GameStore {
  frameAlpha: number;
  input: InputState;
  isRuntimeRunning: boolean;
  mapLayer: MapLayer;
  previousSnapshot: GameSnapshot;
  selectTravelTarget: (targetSystem: SectorCoordinate | null) => void;
  setMapLayer: (mapLayer: MapLayer) => void;
  setFrameAlpha: (frameAlpha: number) => void;
  setInputPatch: (patch: Partial<InputState>) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  snapshot: GameSnapshot;
  cycleMapLayer: () => void;
}

const initialSnapshot = createInitialSnapshot('synapse-foundation');

export const useGameStore = create<GameStore>((set) => ({
  cycleMapLayer: () => {
    set((state) => ({
      mapLayer:
        state.mapLayer === 'none'
          ? 'local'
          : state.mapLayer === 'local'
            ? 'system'
            : 'none',
    }));
  },
  frameAlpha: 0,
  input: initialInputState,
  isRuntimeRunning: false,
  mapLayer: 'none',
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
  setMapLayer: (mapLayer) => {
    set({ mapLayer });
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
