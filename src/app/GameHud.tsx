import type { ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';

function formatSector(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

export function GameHud(): ReactElement {
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const activeSector = useGameStore((state) => state.snapshot.activeSector);
  const projectileCount = useGameStore((state) => state.snapshot.projectiles.length);
  const shipResources = useGameStore((state) => state.snapshot.ship.resources);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);

  const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);

  return (
    <>
      <section className="hud-root">
        <div className="debug-overlay">
          <div className="debug-line">time {elapsedSeconds.toFixed(1)}s</div>
          <div className="debug-line">sector {formatSector(activeSector.x, activeSector.y, activeSector.z)}</div>
          <div className="debug-line">speed {speed.toFixed(1)}</div>
          <div className="debug-line">
            hull {shipResources.hull.toFixed(0)} shield {shipResources.shield.toFixed(0)}
          </div>
          <div className="debug-line">
            boost {shipResources.boostEnergy.toFixed(0)} / {shipResources.boostEnergyMax.toFixed(0)}
          </div>
          <div className="debug-line">shots {projectileCount}</div>
        </div>
      </section>
      <div className="reticle" aria-hidden="true" />
    </>
  );
}
