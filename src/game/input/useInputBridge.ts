import { useEffect } from 'react';
import { mouseLookTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';

const keyBindings: Record<string, keyof ReturnType<typeof getInputPatch>> = {
  KeyH: 'hyperCommit',
  KeyA: 'strafeRight',
  KeyD: 'strafeLeft',
  KeyS: 'thrustBackward',
  KeyW: 'thrustForward',
  Space: 'brake',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};

function getInputPatch() {
  return {
    aim: { x: 0, y: 0 },
    aimDownSights: false,
    hyperCommit: false,
    thrustForward: false,
    thrustBackward: false,
    strafeLeft: false,
    strafeRight: false,
    brake: false,
    boost: false,
    fire: false,
  };
}

export function useInputBridge(): void {
  useEffect(() => {
    const setInputPatch = useGameStore.getState().setInputPatch;
    const setGalaxyMapOpen = useGameStore.getState().setGalaxyMapOpen;
    const readInput = useGameStore.getState;

    const applyKeyState = (code: string, isPressed: boolean) => {
      const patchKey = keyBindings[code];

      if (patchKey === undefined) {
        return;
      }

      setInputPatch({ [patchKey]: isPressed });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyM') {
        event.preventDefault();
        setGalaxyMapOpen(!readInput().galaxyMapOpen);
        return;
      }

      if (event.code === 'Escape') {
        setGalaxyMapOpen(false);
        return;
      }

      if (readInput().galaxyMapOpen && event.code !== 'KeyH') {
        return;
      }

      applyKeyState(event.code, true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (readInput().galaxyMapOpen && event.code !== 'KeyH') {
        return;
      }

      applyKeyState(event.code, false);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement === null) {
        return;
      }

      const currentAim = readInput().input.aim;
      setInputPatch({
        aim: {
          x:
            currentAim.x +
            event.movementX * mouseLookTuning.yawSensitivity * mouseLookTuning.yawDirection,
          y:
            currentAim.y +
            event.movementY * mouseLookTuning.pitchSensitivity * mouseLookTuning.pitchDirection,
        },
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (readInput().galaxyMapOpen) {
        return;
      }

      if (document.pointerLockElement === null) {
        void document.body.requestPointerLock();
        return;
      }

      if (event.button === 0) {
        setInputPatch({ fire: true });
      }

      if (event.button === 2) {
        setInputPatch({ aimDownSights: true });
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        setInputPatch({ fire: false });
      }

      if (event.button === 2) {
        setInputPatch({ aimDownSights: false });
      }
    };

    const onPointerLockChange = () => {
      if (document.pointerLockElement === null) {
        setInputPatch({ aim: { x: 0, y: 0 }, aimDownSights: false, fire: false, hyperCommit: false });
      }
    };

    const onWindowBlur = () => {
      setInputPatch({ aim: { x: 0, y: 0 }, aimDownSights: false, fire: false, hyperCommit: false });
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, []);
}
