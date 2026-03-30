import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { GameHud } from '@/app/GameHud';
import { useInputBridge } from '@/game/input/useInputBridge';
import { gameRuntime } from '@/game/runtime/GameRuntime';

const GameViewport = lazy(async () => import('@/game/render/GameViewport').then((module) => ({ default: module.GameViewport })));

export function App(): ReactElement {
  useInputBridge();

  useEffect(() => {
    gameRuntime.start();

    return () => {
      gameRuntime.stop();
    };
  }, []);

  return (
    <main className="app-shell">
      <Suspense fallback={<div className="viewport-fallback" />}>
        <GameViewport />
      </Suspense>
      <GameHud />
    </main>
  );
}
