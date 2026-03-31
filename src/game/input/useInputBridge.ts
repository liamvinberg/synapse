import { useEffect } from 'react';
import { useGameStore } from '@/game/state/gameStore';

const keyBindings: Record<string, keyof ReturnType<typeof getInputPatch>> = {
  KeyA: 'strafeLeft',
  KeyD: 'strafeRight',
  KeyS: 'thrustBackward',
  KeyW: 'thrustForward',
  Space: 'brake',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};

function getInputPatch() {
  return {
    aim: { x: 0, y: 0 },
    thrustForward: false,
    thrustBackward: false,
    strafeLeft: false,
    strafeRight: false,
    brake: false,
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

    const onPointerMove = (event: PointerEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normalizedX = (event.clientX - centerX) / centerX;
      const normalizedY = (event.clientY - centerY) / centerY;

      setInputPatch({
        aim: {
          x: Math.max(-1, Math.min(1, normalizedX)),
          y: Math.max(-1, Math.min(1, normalizedY)),
        },
      });
    };

    const onPointerLeave = () => {
      setInputPatch({ aim: { x: 0, y: 0 } });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);
}
