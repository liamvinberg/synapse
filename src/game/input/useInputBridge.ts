import { useEffect } from 'react';
import { useGameStore } from '@/game/state/gameStore';

const keyBindings: Record<string, keyof ReturnType<typeof getInputPatch>> = {
  KeyA: 'yawLeft',
  KeyD: 'yawRight',
  KeyS: 'thrustBackward',
  KeyW: 'thrustForward',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};

function getInputPatch() {
  return {
    thrustForward: false,
    thrustBackward: false,
    yawLeft: false,
    yawRight: false,
    boost: false,
  };
}

export function useInputBridge(): void {
  useEffect(() => {
    const setInputPatch = useGameStore.getState().setInputPatch;

    const applyKeyState = (code: string, isPressed: boolean) => {
      const patchKey = keyBindings[code];

      if (patchKey === undefined) {
        return;
      }

      setInputPatch({ [patchKey]: isPressed });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      applyKeyState(event.code, true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      applyKeyState(event.code, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
