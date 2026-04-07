import type { ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';

function formatSector(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

export function GameHud(): ReactElement {
  const aimDownSights = useGameStore((state) => state.input.aimDownSights);
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const activeSector = useGameStore((state) => state.snapshot.activeSector);
  const projectileCount = useGameStore((state) => state.snapshot.projectiles.length);
  const shipResources = useGameStore((state) => state.snapshot.ship.resources);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);

  const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
  const hullPct = shipResources.hullMax > 0 ? (shipResources.hull / shipResources.hullMax) * 100 : 0;
  const shieldPct = shipResources.shieldMax > 0 ? (shipResources.shield / shipResources.shieldMax) * 100 : 0;
  const boostPct = shipResources.boostEnergyMax > 0 ? (shipResources.boostEnergy / shipResources.boostEnergyMax) * 100 : 0;

  return (
    <>
      <section className="hud-root">
        <div className="hud-instruments">
          <div className="hud-nav">
            <div className="hud-readout">
              <span className="hud-readout__label">sec</span>
              <span className="hud-readout__value">{formatSector(activeSector.x, activeSector.y, activeSector.z)}</span>
            </div>
            <div className="hud-readout">
              <span className="hud-readout__label">spd</span>
              <span className="hud-readout__value">{speed.toFixed(1)}</span>
            </div>
            <div className="hud-readout">
              <span className="hud-readout__label">t</span>
              <span className="hud-readout__value">{elapsedSeconds.toFixed(1)}</span>
            </div>
            <div className="hud-readout">
              <span className="hud-readout__label">rds</span>
              <span className="hud-readout__value">{projectileCount}</span>
            </div>
          </div>

          <div className="hud-resources">
            <div className="hud-bar">
              <span className="hud-bar__label">hull</span>
              <div className="hud-bar__track">
                <div className="hud-bar__fill" style={{ width: `${hullPct}%` }} />
              </div>
              <span className="hud-bar__value">{shipResources.hull.toFixed(0)}</span>
            </div>
            <div className="hud-bar">
              <span className="hud-bar__label">shield</span>
              <div className="hud-bar__track">
                <div className="hud-bar__fill hud-bar__fill--shield" style={{ width: `${shieldPct}%` }} />
              </div>
              <span className="hud-bar__value">{shipResources.shield.toFixed(0)}</span>
            </div>
            <div className="hud-bar">
              <span className="hud-bar__label">boost</span>
              <div className="hud-bar__track">
                <div className="hud-bar__fill hud-bar__fill--boost" style={{ width: `${boostPct}%` }} />
              </div>
              <span className="hud-bar__value">{shipResources.boostEnergy.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </section>
      <div className={aimDownSights ? 'reticle reticle--ads' : 'reticle'} aria-hidden="true" />
    </>
  );
}
