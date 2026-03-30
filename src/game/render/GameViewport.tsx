import { Suspense, type ReactElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from '@/game/render/SpaceScene';

export function GameViewport(): ReactElement {
  return (
    <div className="game-viewport">
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 6000, position: [0, 6, 16] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <SpaceScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
