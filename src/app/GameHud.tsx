import type { CSSProperties, ReactElement } from 'react';
import { getSystemLabel } from '@/game/worldgen/navigation';
import { combatTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';

function formatSector(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function LocalSensorMap(): ReactElement {
  const planets = useGameStore((state) => state.snapshot.activeSectorDescriptor.planets);
  const furthestOrbit = planets.reduce((maxDistance, planet) => {
    return Math.max(maxDistance, Math.hypot(planet.position.x, planet.position.z) + planet.radius);
  }, 1);

  return (
    <div className="sensor-map" aria-hidden="true">
      <div className="sensor-map__glow" />
      {planets.map((planet) => {
        const x = 50 + (planet.position.x / furthestOrbit) * 36;
        const y = 50 + (planet.position.z / furthestOrbit) * 36;
        const size = Math.max(3, Math.min(10, planet.radius * 0.16));

        return (
          <div
            key={planet.id}
            className="sensor-map__body"
            style={{
              background: planet.color,
              height: `${size}px`,
              left: `${x}%`,
              opacity: Math.min(0.92, 0.35 + planet.radius / 70),
              top: `${y}%`,
              width: `${size}px`,
            }}
          />
        );
      })}
      <div className="sensor-map__player" />
      <div className="sensor-map__ring" />
      <div className="sensor-map__label">LOCAL</div>
    </div>
  );
}

export function GameHud(): ReactElement {
  const aimDownSights = useGameStore((state) => state.input.aimDownSights);
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const activeSector = useGameStore((state) => state.snapshot.activeSector);
  const ship = useGameStore((state) => state.snapshot.ship);
  const shipResources = useGameStore((state) => state.snapshot.ship.resources);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const snapshot = useGameStore((state) => state.snapshot);
  const galaxyMapOpen = useGameStore((state) => state.galaxyMapOpen);

  const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
  const hullPct = shipResources.hullMax > 0 ? (shipResources.hull / shipResources.hullMax) * 100 : 0;
  const shieldPct = shipResources.shieldMax > 0 ? (shipResources.shield / shipResources.shieldMax) * 100 : 0;
  const boostPct = shipResources.boostEnergyMax > 0 ? (shipResources.boostEnergy / shipResources.boostEnergyMax) * 100 : 0;
  const targetSystem = snapshot.travel.targetSystem;
  const targetLabel = targetSystem === null ? 'No route armed' : getSystemLabel(snapshot.universeSeed, targetSystem);
  const secondaryChargePct = Math.min(
    ship.secondaryChargeSeconds / combatTuning.secondaryChargeFullSeconds,
    1,
  );
  const reticleStyle = {
    '--reticle-charge': secondaryChargePct,
  } as CSSProperties;
  const reticleClassName = [
    'reticle',
    aimDownSights ? 'reticle--ads' : null,
    aimDownSights && ship.secondaryChargeSeconds <= 0 ? 'reticle--secondary-ready' : null,
    ship.secondaryChargeSeconds > 0 ? 'reticle--charging' : null,
    ship.secondaryCooldownSeconds > 0 ? 'reticle--cooldown' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <section className="hud-root">
        <div className="hud-mode">{galaxyMapOpen ? 'Galaxy navigation' : snapshot.travel.mode === 'spooling' ? 'Hyperspace spool' : 'Normal flight'}</div>
        <div className="hud-heading">{Math.round((snapshot.ship.yawRadians * 180) / Math.PI + 360) % 360}°</div>
        <div className="hud-top-line" />

        <div className="hud-left-stack">
          <div className="hud-primary-readout">{speed.toFixed(2)}c</div>
          <div className="hud-secondary-readout">SEC {formatSector(activeSector.x, activeSector.y, activeSector.z)}</div>
          <div className="hud-secondary-readout">T {elapsedSeconds.toFixed(1)}</div>
        </div>

        <div className={galaxyMapOpen ? 'hud-route hud-route--navigation' : 'hud-route'}>
          <div className="hud-route__label">Route</div>
          <div className="hud-route__value">{targetLabel}</div>
          <div className="hud-route__meta">
            {snapshot.travel.mode === 'spooling'
              ? `Spool ${Math.round(snapshot.travel.progress * 100)}%`
              : galaxyMapOpen
                ? 'Cursor active'
                : 'Press M for galaxy map'}
          </div>
        </div>

        <div className="hud-status">
          <div className="hud-status__row">
            <span>SHD</span>
            <div className="hud-status__bar"><div className="hud-status__fill hud-status__fill--shield" style={{ width: `${shieldPct}%` }} /></div>
            <span>{shipResources.shield.toFixed(0)}%</span>
          </div>
          <div className="hud-status__row">
            <span>HUL</span>
            <div className="hud-status__bar"><div className="hud-status__fill" style={{ width: `${hullPct}%` }} /></div>
            <span>{shipResources.hull.toFixed(0)}%</span>
          </div>
          <div className="hud-status__row">
            <span>BST</span>
            <div className="hud-status__bar"><div className="hud-status__fill hud-status__fill--boost" style={{ width: `${boostPct}%` }} /></div>
            <span>{shipResources.boostEnergy.toFixed(0)}%</span>
          </div>
        </div>

        <div className="hud-bottom-right">
          <LocalSensorMap />
          <div className="hud-system-readout">
            <div>{getSystemLabel(snapshot.universeSeed, snapshot.activeSystem)}</div>
            <div>{snapshot.activeSectorDescriptor.planets.length} bodies nearby</div>
          </div>
        </div>
      </section>
      <div className={reticleClassName} style={reticleStyle} aria-hidden="true">
        <div className="reticle__ring" />
        <div className="reticle__dot" />
        <div className="reticle__bar reticle__bar--left" />
        <div className="reticle__bar reticle__bar--right" />
        <div className="reticle__charge" />
        {aimDownSights ? (
          <div className="reticle__label">
            {ship.secondaryChargeSeconds > 0
              ? `${Math.round(secondaryChargePct * 100)}%`
              : 'LANCE'}
          </div>
        ) : null}
      </div>
    </>
  );
}
