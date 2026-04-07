import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import type { SectorCoordinate } from '@/game/sim/types';
import { generateGalaxyWindow, getSystemLabel } from '@/game/worldgen/navigation';

function formatCoordinate(coordinate: SectorCoordinate): string {
  return `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
}

function areSameCoordinate(left: SectorCoordinate, right: SectorCoordinate | null): boolean {
  return right !== null && left.x === right.x && left.y === right.y && left.z === right.z;
}

export function MapOverlay(): ReactElement | null {
  const galaxyMapOpen = useGameStore((state) => state.galaxyMapOpen);
  const selectTravelTarget = useGameStore((state) => state.selectTravelTarget);
  const setGalaxyMapOpen = useGameStore((state) => state.setGalaxyMapOpen);
  const snapshot = useGameStore((state) => state.snapshot);
  const [mapCenter, setMapCenter] = useState(snapshot.activeSystem);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (galaxyMapOpen) {
      setMapCenter(snapshot.activeSystem);
      if (document.pointerLockElement !== null) {
        void document.exitPointerLock();
      }
    }
  }, [galaxyMapOpen, snapshot.activeSystem]);

  const systems = useMemo(() => {
    return generateGalaxyWindow(snapshot.universeSeed, mapCenter, 6);
  }, [mapCenter, snapshot.universeSeed]);

  if (!galaxyMapOpen) {
    return null;
  }

  const onMapMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragOrigin({ x: event.clientX, y: event.clientY });
  };

  const onMapMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDragging || dragOrigin === null) {
      return;
    }

    const deltaX = event.clientX - dragOrigin.x;
    const deltaY = event.clientY - dragOrigin.y;
    const nextCenter = {
      x: mapCenter.x - Math.trunc(deltaX / 44),
      y: mapCenter.y,
      z: mapCenter.z - Math.trunc(deltaY / 44),
    };

    if (nextCenter.x !== mapCenter.x || nextCenter.z !== mapCenter.z) {
      setMapCenter(nextCenter);
      setDragOrigin({ x: event.clientX, y: event.clientY });
    }
  };

  const onMapMouseUp = () => {
    setIsDragging(false);
    setDragOrigin(null);
  };

  return (
    <section className="galaxy-map" onMouseLeave={onMapMouseUp}>
      <div className="galaxy-map__frame">
        <header className="galaxy-map__header">
          <div>
            <div className="galaxy-map__eyebrow">Galaxy navigation</div>
            <h2 className="galaxy-map__title">{getSystemLabel(snapshot.universeSeed, snapshot.activeSystem)}</h2>
          </div>
          <div className="galaxy-map__status">
            <span>{formatCoordinate(snapshot.activeSystem)}</span>
            <span>{snapshot.travel.targetSystem === null ? 'No route armed' : getSystemLabel(snapshot.universeSeed, snapshot.travel.targetSystem)}</span>
            <button className="galaxy-map__close" onClick={() => setGalaxyMapOpen(false)} type="button">
              Close
            </button>
          </div>
        </header>

        <div
          className={isDragging ? 'galaxy-map__field galaxy-map__field--dragging' : 'galaxy-map__field'}
          onMouseDown={onMapMouseDown}
          onMouseMove={onMapMouseMove}
          onMouseUp={onMapMouseUp}
        >
          <div className="galaxy-map__center-mark" />
          {systems.map((system) => {
            const x = 50 + (system.coordinate.x - mapCenter.x) * 7.4;
            const y = 50 + (system.coordinate.z - mapCenter.z) * 7.4;
            const isCurrent = areSameCoordinate(system.coordinate, snapshot.activeSystem);
            const isTarget = areSameCoordinate(system.coordinate, snapshot.travel.targetSystem);
            const size = Math.max(2, Math.min(7, system.descriptor.density * 7));

            return (
              <button
                key={`${system.coordinate.x}:${system.coordinate.y}:${system.coordinate.z}`}
                className={
                  isCurrent
                    ? 'galaxy-map__node galaxy-map__node--current'
                    : isTarget
                      ? 'galaxy-map__node galaxy-map__node--target'
                      : 'galaxy-map__node'
                }
                onClick={() => {
                  selectTravelTarget(isCurrent ? null : system.coordinate);
                }}
                style={{
                  height: `${size}px`,
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                }}
                title={`${system.label} · ${formatCoordinate(system.coordinate)}`}
                type="button"
              />
            );
          })}
        </div>

        <footer className="galaxy-map__footer">
          <div className="galaxy-map__legend">
            <span>drag to pan</span>
            <span>click star to arm route</span>
            <span>close map and hold H to spool</span>
          </div>
          <div className="galaxy-map__focus">
            <span>Focus {formatCoordinate(mapCenter)}</span>
            <span>{snapshot.travel.mode === 'spooling' ? `Spool ${Math.round(snapshot.travel.progress * 100)}%` : 'Flight active'}</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
