import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import type { SectorCoordinate } from '@/game/sim/types';
import { generateGalaxyWindow, getSystemLabel } from '@/game/worldgen/navigation';

const SCALE = 7.4;
const RING_DISTANCES = [2, 4, 6];

function formatCoordinate(coordinate: SectorCoordinate): string {
  return `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
}

function areSameCoordinate(left: SectorCoordinate, right: SectorCoordinate | null): boolean {
  return right !== null && left.x === right.x && left.y === right.y && left.z === right.z;
}

function hexToGlow(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatBodyLabel(index: number): string {
  return `Body ${index + 1}`;
}

export function MapOverlay(): ReactElement | null {
  const galaxyMapOpen = useGameStore((state) => state.galaxyMapOpen);
  const selectTravelTarget = useGameStore((state) => state.selectTravelTarget);
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
  const targetSystem = snapshot.travel.targetSystem;
  const routeTargetDescriptor = targetSystem === null
    ? null
    : systems.find((system) => areSameCoordinate(system.coordinate, targetSystem));
  const localPlanets = snapshot.activeSectorDescriptor.planets;
  const localSystemSpan = localPlanets.reduce((furthestOrbit, planet) => {
    return Math.max(furthestOrbit, Math.hypot(planet.position.x, planet.position.z) + planet.radius);
  }, 1);
  const highlightedBodies = [...localPlanets]
    .sort((left, right) => right.radius - left.radius)
    .slice(0, Math.min(3, localPlanets.length));

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

  const originX = 50 + (snapshot.activeSystem.x - mapCenter.x) * SCALE;
  const originY = 50 + (snapshot.activeSystem.z - mapCenter.z) * SCALE;
  const hasTarget = targetSystem !== null;
  const targetX = hasTarget ? 50 + (targetSystem.x - mapCenter.x) * SCALE : 0;
  const targetY = hasTarget ? 50 + (targetSystem.z - mapCenter.z) * SCALE : 0;

  return (
    <section className="nav-field" onMouseLeave={onMapMouseUp}>
      <div
        className={isDragging ? 'nav-field__plane nav-field__plane--dragging' : 'nav-field__plane'}
        onMouseDown={onMapMouseDown}
        onMouseMove={onMapMouseMove}
        onMouseUp={onMapMouseUp}
      >
        {RING_DISTANCES.map((distance) => (
          <div
            key={distance}
            className="nav-field__ring"
            style={{
              left: `${originX}%`,
              top: `${originY}%`,
              width: `${distance * SCALE * 2}%`,
            }}
          />
        ))}

        {hasTarget && (
          <svg className="nav-field__route-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={originX}
              y1={originY}
              x2={targetX}
              y2={targetY}
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="0.46"
            />
            <line
              x1={originX}
              y1={originY}
              x2={targetX}
              y2={targetY}
              stroke={hexToGlow(routeTargetDescriptor?.descriptor.starColor ?? '#ffffff', 0.84)}
              strokeWidth="0.24"
              strokeDasharray="1.2 0.42"
            />
          </svg>
        )}

        <div className="nav-field__origin-ring" style={{ left: `${originX}%`, top: `${originY}%` }} />
        <div className="nav-field__crosshair" style={{ left: `${originX}%`, top: `${originY}%` }} />

        {systems.map((system) => {
          const x = 50 + (system.coordinate.x - mapCenter.x) * SCALE;
          const y = 50 + (system.coordinate.z - mapCenter.z) * SCALE;
          const isCurrent = areSameCoordinate(system.coordinate, snapshot.activeSystem);
          const isTarget = areSameCoordinate(system.coordinate, snapshot.travel.targetSystem);
          const size = isTarget
            ? Math.max(5, Math.min(12, system.descriptor.density * 11))
            : isCurrent
              ? Math.max(5, Math.min(10, system.descriptor.density * 10))
              : Math.max(3, Math.min(8, system.descriptor.density * 8));
          const distanceFromViewCenter = Math.hypot(x - 50, y - 50);
          const edgeFade = Math.max(0.18, 1 - distanceFromViewCenter / 44);
          const starColor = system.descriptor.starColor;
          const ambientScale = hasTarget && !isCurrent && !isTarget ? 0.42 : 1;
          const glowAlpha = system.descriptor.density * 0.34 * ambientScale;
          const glowSize = size + (isTarget ? 10 : isCurrent ? 8 : 5);

          let className = 'nav-field__star';
          if (isCurrent) className += ' nav-field__star--current';
          else if (isTarget) className += ' nav-field__star--target';

          return (
            <button
              key={`${system.coordinate.x}:${system.coordinate.y}:${system.coordinate.z}`}
              className={className}
              onClick={() => selectTravelTarget(isCurrent ? null : system.coordinate)}
              style={{
                background: isCurrent ? 'rgba(255, 255, 255, 0.88)' : starColor,
                boxShadow: isCurrent
                  ? '0 0 22px 8px rgba(255, 255, 255, 0.22), 0 0 0 9px rgba(255, 255, 255, 0.12)'
                  : isTarget
                    ? `0 0 0 9px ${hexToGlow(starColor, 0.3)}, 0 0 0 22px ${hexToGlow(starColor, 0.12)}, 0 0 ${glowSize + 2}px ${size + 3}px ${hexToGlow(starColor, glowAlpha + 0.16)}`
                    : `0 0 ${glowSize}px ${size}px ${hexToGlow(starColor, glowAlpha)}`,
                height: `${size}px`,
                left: `${x}%`,
                opacity: isCurrent || isTarget ? 1 : edgeFade * ambientScale,
                top: `${y}%`,
                width: `${size}px`,
              }}
              title={`${system.label} · ${formatCoordinate(system.coordinate)}`}
              type="button"
            />
          );
        })}

        <div
          className="nav-field__tag"
          style={{ left: `${originX}%`, top: `${originY}%`, transform: 'translate(-50%, 16px)' }}
        >
          {getSystemLabel(snapshot.universeSeed, snapshot.activeSystem)}
        </div>

        {hasTarget && (
          <div
            className="nav-field__tag nav-field__tag--target"
            style={{ left: `${targetX}%`, top: `${targetY}%`, transform: 'translate(-50%, -18px)' }}
          >
            {'\u2192 '}{getSystemLabel(snapshot.universeSeed, targetSystem)}
          </div>
        )}
      </div>

      <div className="nav-field__readout">
        <span>{formatCoordinate(mapCenter)}</span>
        <span>{hasTarget ? `Route ${getSystemLabel(snapshot.universeSeed, targetSystem)}` : 'No route'}</span>
        {snapshot.travel.mode === 'spooling' && (
          <span>Spool {Math.round(snapshot.travel.progress * 100)}%</span>
        )}
      </div>

      <section className="nav-field__system-panel" aria-hidden="true">
        <div className="nav-field__system-title">{getSystemLabel(snapshot.universeSeed, snapshot.activeSystem)}</div>
        <div className="nav-field__system-meta">{localPlanets.length} bodies · local plane</div>
        <div className="nav-field__system-view">
          <div className="nav-field__system-glow" style={{ background: `radial-gradient(circle, ${hexToGlow(snapshot.activeSectorDescriptor.starColor, 0.24)} 0%, rgba(0,0,0,0) 68%)` }} />
          <div className="nav-field__system-star" style={{ background: snapshot.activeSectorDescriptor.starColor, boxShadow: `0 0 28px ${hexToGlow(snapshot.activeSectorDescriptor.starColor, 0.35)}` }} />
          {localPlanets.map((planet) => {
            const orbit = Math.hypot(planet.position.x, planet.position.z);
            const orbitPct = Math.max(16, (orbit / localSystemSpan) * 82);
            const x = 50 + (planet.position.x / localSystemSpan) * 41;
            const y = 50 + (planet.position.z / localSystemSpan) * 41;
            const size = Math.max(4, Math.min(14, planet.radius * 0.18));

            return (
              <>
                <div
                  key={`${planet.id}-orbit`}
                  className="nav-field__system-orbit"
                  style={{ width: `${orbitPct}%`, height: `${orbitPct}%` }}
                />
                <div
                  key={planet.id}
                  className="nav-field__system-planet"
                  style={{
                    background: planet.color,
                    boxShadow: `0 0 18px ${hexToGlow(planet.color, 0.24)}`,
                    height: `${size}px`,
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}px`,
                  }}
                />
              </>
            );
          })}
        </div>
        <div className="nav-field__system-legend">
          {highlightedBodies.map((planet, index) => (
            <div key={planet.id} className="nav-field__system-legend-row">
              <span className="nav-field__system-swatch" style={{ background: planet.color }} />
              <span>{formatBodyLabel(index)}</span>
              <span>{Math.round(planet.radius)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="nav-field__hint">Esc</div>
    </section>
  );
}
