import type { ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';

function formatSector(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

export function GameHud(): ReactElement {
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const activeSector = useGameStore((state) => state.snapshot.activeSector);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const planetCount = useGameStore(
    (state) => state.snapshot.activeSectorDescriptor.planets.length,
  );
  const runtimeStatus = useGameStore((state) => state.isRuntimeRunning);

  const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);

  return (
    <>
      <section className="hud-root">
        <div className="hud-column">
          <article className="hud-panel">
            <h1>Synapse</h1>
            <div className="hud-grid">
              <div className="hud-metric">
                <span className="hud-label">Runtime</span>
                <span className="hud-value">
                  {runtimeStatus ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Elapsed</span>
                <span className="hud-value">{elapsedSeconds.toFixed(1)} s</span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Sector</span>
                <span className="hud-value">
                  {formatSector(activeSector.x, activeSector.y, activeSector.z)}
                </span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Speed</span>
                <span className="hud-value">{speed.toFixed(1)} u/s</span>
              </div>
            </div>
          </article>
        </div>

        <div className="hud-column">
          <article className="hud-panel">
            <h2>Foundation status</h2>
            <p className="hud-copy">
              Deterministic sector generation, fixed-step runtime updates, and
              camera-relative rendering are active. The current sector has{' '}
              {planetCount} generated bodies.
            </p>
          </article>
          <article className="hud-panel">
            <h2>Flight controls</h2>
            <p className="hud-copy">
              W/S thrust · A/D yaw · Shift boost. Crossing a sector boundary
              regenerates the local system from the same universe seed.
            </p>
          </article>
        </div>
      </section>
      <div className="reticle" aria-hidden="true" />
    </>
  );
}
