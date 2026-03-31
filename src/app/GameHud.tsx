import type { ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';

function formatSector(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

export function GameHud(): ReactElement {
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const activeSector = useGameStore((state) => state.snapshot.activeSector);
  const controlMode = useGameStore((state) => state.snapshot.ship.controlMode);
  const shipResources = useGameStore((state) => state.snapshot.ship.resources);
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
              <div className="hud-metric">
                <span className="hud-label">Mode</span>
                <span className="hud-value">{controlMode}</span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Hull / Shield</span>
                <span className="hud-value">
                  {shipResources.hull.toFixed(0)} / {shipResources.shield.toFixed(0)}
                </span>
              </div>
              <div className="hud-metric">
                <span className="hud-label">Boost</span>
                <span className="hud-value">
                  {shipResources.boostEnergy.toFixed(0)} / {shipResources.boostEnergyMax.toFixed(0)}
                </span>
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
              Cursor steers facing · W/S thrust · A/D strafe · Shift boost ·
              Space brake. The controller is tuned for readable boss-combat
              movement, not hard simulation.
            </p>
          </article>
          <article className="hud-panel">
            <h2>Combat systems scaffold</h2>
            <p className="hud-copy">
              Hull, shields, stagger, and boost economy are now first-class ship
              resources so damage, boss pressure, and recovery loops can be built
              without reshaping the controller layer later.
            </p>
          </article>
        </div>
      </section>
      <div className="reticle" aria-hidden="true" />
    </>
  );
}
