import { useEffect, type ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import type { PlanetDescriptor, SectorCoordinate } from '@/game/sim/types';
import { generateNearbySystems, getSystemLabel } from '@/game/worldgen/navigation';

function formatCoordinate(coordinate: SectorCoordinate): string {
  return `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
}

function LocalPlanetMap({ planets }: { planets: PlanetDescriptor[] }): ReactElement {
  const furthestOrbit = planets.reduce((maxDistance, planet) => {
    return Math.max(maxDistance, Math.hypot(planet.position.x, planet.position.z) + planet.radius);
  }, 1);

  return (
    <div className="map-diagram">
      <div className="map-diagram__star" />
      {planets.map((planet) => {
        const x = 50 + (planet.position.x / furthestOrbit) * 42;
        const y = 50 + (planet.position.z / furthestOrbit) * 42;
        const size = Math.max(6, Math.min(16, planet.radius * 0.24));

        return (
          <div
            key={planet.id}
            className="map-diagram__planet"
            style={{
              background: planet.color,
              height: `${size}px`,
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
            }}
            title={planet.id}
          />
        );
      })}
    </div>
  );
}

function SystemMap(): ReactElement {
  const selectTravelTarget = useGameStore((state) => state.selectTravelTarget);
  const snapshot = useGameStore((state) => state.snapshot);
  const systems = generateNearbySystems(snapshot.universeSeed, snapshot.activeSystem);

  return (
    <div className="system-map">
      <div className="system-map__grid">
        {systems.map((system) => {
          const isCurrent =
            system.coordinate.x === snapshot.activeSystem.x &&
            system.coordinate.y === snapshot.activeSystem.y &&
            system.coordinate.z === snapshot.activeSystem.z;
          const isSelected =
            snapshot.travel.targetSystem !== null &&
            system.coordinate.x === snapshot.travel.targetSystem.x &&
            system.coordinate.y === snapshot.travel.targetSystem.y &&
            system.coordinate.z === snapshot.travel.targetSystem.z;

          return (
            <button
              key={system.label}
              className={
                isCurrent
                  ? 'system-map__node system-map__node--current'
                  : isSelected
                    ? 'system-map__node system-map__node--selected'
                    : 'system-map__node'
              }
              onClick={() => {
                if (isCurrent) {
                  selectTravelTarget(null);
                  return;
                }

                selectTravelTarget(system.coordinate);
              }}
              type="button"
            >
              <span className="system-map__node-label">{system.label}</span>
              <span className="system-map__node-meta">{formatCoordinate(system.coordinate)}</span>
              <span className="system-map__node-meta">density {system.descriptor.density.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MapOverlay(): ReactElement | null {
  const mapLayer = useGameStore((state) => state.mapLayer);
  const setMapLayer = useGameStore((state) => state.setMapLayer);
  const snapshot = useGameStore((state) => state.snapshot);

  useEffect(() => {
    if (mapLayer !== 'none' && document.pointerLockElement !== null) {
      void document.exitPointerLock();
    }
  }, [mapLayer]);

  if (mapLayer === 'none') {
    return null;
  }

  const currentSystemLabel = getSystemLabel(snapshot.universeSeed, snapshot.activeSystem);
  const targetSystemLabel =
    snapshot.travel.targetSystem === null
      ? 'none'
      : getSystemLabel(snapshot.universeSeed, snapshot.travel.targetSystem);

  return (
    <section className="map-overlay">
      <header className="map-header">
        <h2 className="map-header__title">{currentSystemLabel}</h2>
        <div className="map-header__controls">
          <button
            className={`map-tab${mapLayer === 'local' ? ' map-tab--active' : ''}`}
            onClick={() => setMapLayer('local')}
            type="button"
          >
            Local
          </button>
          <button
            className={`map-tab${mapLayer === 'system' ? ' map-tab--active' : ''}`}
            onClick={() => setMapLayer('system')}
            type="button"
          >
            System
          </button>
          <button className="map-close" onClick={() => setMapLayer('none')} type="button">
            &times;
          </button>
        </div>
      </header>

      <div className="map-meta">
        <div className="map-meta__item">
          <span className="map-meta__label">coord</span>
          <span>{formatCoordinate(snapshot.activeSystem)}</span>
        </div>
        <div className="map-meta__item">
          <span className="map-meta__label">mode</span>
          <span>{snapshot.travel.mode}</span>
        </div>
        {mapLayer === 'system' ? (
          <>
            <div className="map-meta__item">
              <span className="map-meta__label">dest</span>
              <span>{targetSystemLabel}</span>
            </div>
            <div className="map-meta__item">
              <span className="map-meta__label">hyper</span>
              <span>
                hold h
                {snapshot.travel.mode === 'spooling'
                  ? ` ${Math.round(snapshot.travel.progress * 100)}%`
                  : ''}
              </span>
            </div>
          </>
        ) : (
          <div className="map-meta__item">
            <span className="map-meta__label">planets</span>
            <span>{snapshot.activeSectorDescriptor.planets.length}</span>
          </div>
        )}
      </div>

      {mapLayer === 'local' ? (
        <>
          <LocalPlanetMap planets={snapshot.activeSectorDescriptor.planets} />
          <div className="map-list">
            {snapshot.activeSectorDescriptor.planets.map((planet, index) => (
              <div key={planet.id} className="map-list__item">
                <span>
                  {index + 1}. {planet.id}
                </span>
                <span className="map-list__detail">r {planet.radius.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <SystemMap />
      )}
    </section>
  );
}
