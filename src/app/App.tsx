import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { GameHud } from '@/app/GameHud';
import { MapOverlay } from '@/app/MapOverlay';
import { gameAudio } from '@/game/audio/GameAudioEngine';
import { useInputBridge } from '@/game/input/useInputBridge';
import { gameRuntime } from '@/game/runtime/GameRuntime';

const GameViewport = lazy(async () => import('@/game/render/GameViewport').then((module) => ({ default: module.GameViewport })));

export function App(): ReactElement {
  useInputBridge();

  useEffect(() => {
    gameAudio.start();
    gameRuntime.start();

    return () => {
      gameAudio.stop();
      gameRuntime.stop();
    };
  }, []);

  return (
    <main className="app-shell">
      <Suspense fallback={<div className="viewport-fallback" />}>
        <GameViewport />
      </Suspense>
      <MapOverlay />
      <GameHud />
    </main>
  );
}
