import { audioAssets } from '@/game/audio/audioAssets';
import { audioTuning, combatTuning } from '@/game/config/tuning';
import type { CombatEventState, ProjectileState, SectorCoordinate } from '@/game/sim/types';
import type { GameStore } from '@/game/state/gameStore';
import { useGameStore } from '@/game/state/gameStore';

type LoopChannelName = 'boost' | 'charge' | 'engine' | 'spool' | 'thruster';

interface LoopChannel {
  element: HTMLAudioElement | null;
  variants: readonly string[];
}

interface OneShotOptions {
  playbackRate: number;
  playbackVariance?: number;
  volume: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function areCoordinatesEqual(
  left: SectorCoordinate | null,
  right: SectorCoordinate | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.x === right.x &&
      left.y === right.y &&
      left.z === right.z)
  );
}

function getNewEntries<T extends { id: string }>(current: T[], previous: T[]): T[] {
  const previousIds = new Set(previous.map((entry) => entry.id));
  return current.filter((entry) => !previousIds.has(entry.id));
}

function getDirectionalThrust(input: GameStore['input']): number {
  return clamp(
    Number(input.thrustForward) +
      Number(input.thrustBackward) +
      (Number(input.strafeLeft) + Number(input.strafeRight)) * 0.8 +
      (Number(input.thrustUp) + Number(input.thrustDown)) * 0.7 +
      Number(input.brake) * 0.55,
    0,
    1.8,
  );
}

function getSpeed(state: GameStore): number {
  const velocity = state.snapshot.ship.velocity;
  return Math.hypot(velocity.x, velocity.y, velocity.z);
}

function getSecondaryChargeMix(projectile: ProjectileState): 'full' | 'mid' | 'partial' {
  if (projectile.length >= combatTuning.secondaryProjectileLengths.full - 0.05) {
    return 'full';
  }

  if (projectile.length >= combatTuning.secondaryProjectileLengths.mid - 0.05) {
    return 'mid';
  }

  return 'partial';
}

export class GameAudioEngine {
  private readonly loops: Record<LoopChannelName, LoopChannel> = {
    boost: { element: null, variants: audioAssets.spaceEngineLow },
    charge: { element: null, variants: audioAssets.spaceEngineSmall },
    engine: { element: null, variants: audioAssets.spaceEngine },
    spool: { element: null, variants: audioAssets.engineCircular },
    thruster: { element: null, variants: audioAssets.thrusterFire },
  };

  private readonly activeOneShots = new Set<HTMLAudioElement>();
  private readonly oneShotCursor = new Map<string, number>();
  private readonly preloadedElements = new Map<string, HTMLAudioElement>();

  private unsubscribe: (() => void) | null = null;
  private running = false;
  private unlocked = false;
  private lastState: GameStore | null = null;
  private lastTelegraphAtMs = 0;

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastState = useGameStore.getState();
    this.preloadAllAudio();
    this.addUnlockListeners();
    this.unsubscribe = useGameStore.subscribe((state, previousState) => {
      this.lastState = state;
      this.handleStateChange(state, previousState);
    });
    this.updateLoopMix(this.lastState);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.removeUnlockListeners();

    for (const channel of Object.values(this.loops)) {
      if (channel.element !== null) {
        channel.element.pause();
        channel.element.currentTime = 0;
        channel.element.volume = 0;
      }
    }

    for (const element of this.activeOneShots) {
      element.pause();
      element.currentTime = 0;
    }

    this.activeOneShots.clear();
    this.lastState = null;
  }

  private readonly unlockAudio = (): void => {
    this.unlocked = true;
    this.removeUnlockListeners();

    if (this.lastState !== null) {
      this.updateLoopMix(this.lastState);
    }
  };

  private handleStateChange(state: GameStore, previousState: GameStore): void {
    if (this.unlocked) {
      this.playStateTransitions(state, previousState);
    }

    this.updateLoopMix(state);
  }

  private playStateTransitions(state: GameStore, previousState: GameStore): void {
    if (!previousState.galaxyMapOpen && state.galaxyMapOpen) {
      this.playOneShot(audioAssets.doorOpen, {
        playbackRate: 1,
        volume: audioTuning.uiVolume * 0.95,
      });
    } else if (previousState.galaxyMapOpen && !state.galaxyMapOpen) {
      this.playOneShot(audioAssets.doorClose, {
        playbackRate: 1,
        volume: audioTuning.uiVolume * 0.9,
      });
    }

    if (
      state.galaxyMapOpen &&
      !areCoordinatesEqual(previousState.snapshot.travel.targetSystem, state.snapshot.travel.targetSystem)
    ) {
      this.playOneShot(audioAssets.forceField, {
        playbackRate: 1.08,
        playbackVariance: 0.01,
        volume: audioTuning.uiVolume * 0.55,
      });
    }

    const previousTravelMode = previousState.snapshot.travel.mode;
    const travelMode = state.snapshot.travel.mode;
    if (previousTravelMode !== 'spooling' && travelMode === 'spooling') {
      this.playOneShot(audioAssets.forceField, {
        playbackRate: 0.88,
        volume: audioTuning.travelVolume * 0.65,
      });
    }

    if (
      previousTravelMode === 'spooling' &&
      travelMode === 'local' &&
      previousState.snapshot.travel.targetSystem !== null &&
      state.snapshot.travel.targetSystem === null
    ) {
      this.playOneShot(audioAssets.lowFrequencyExplosion, {
        playbackRate: 0.9,
        volume: audioTuning.travelVolume * 0.8,
      });
      this.playOneShot(audioAssets.forceField, {
        playbackRate: 1.12,
        volume: audioTuning.travelVolume * 0.5,
      });
    }

    for (const projectile of getNewEntries(
      state.snapshot.projectiles,
      previousState.snapshot.projectiles,
    )) {
      this.playProjectile(projectile);
    }

    for (const event of getNewEntries(
      state.snapshot.combatEvents,
      previousState.snapshot.combatEvents,
    )) {
      this.playCombatEvent(event);
    }

    for (const impact of getNewEntries(state.snapshot.impacts, previousState.snapshot.impacts)) {
      this.playImpact(impact.id);
    }

    if (
      previousState.snapshot.ship.secondaryChargeSeconds <= 0 &&
      state.snapshot.ship.secondaryChargeSeconds > 0
    ) {
      this.playOneShot(audioAssets.forceField, {
        playbackRate: 0.78,
        playbackVariance: 0.01,
        volume: audioTuning.chargeStartVolume,
      });
    }
  }

  private playProjectile(projectile: ProjectileState): void {
    if (projectile.owner === 'enemy') {
      this.playOneShot(audioAssets.laserRetro, {
        playbackRate: 1,
        playbackVariance: 0.01,
        volume: audioTuning.enemyWeaponVolume,
      });
      return;
    }

    if (projectile.kind === 'secondary') {
      const chargeMix = getSecondaryChargeMix(projectile);
      const volumeScale = chargeMix === 'full' ? 1.25 : chargeMix === 'mid' ? 1.05 : 0.9;
      const rate = chargeMix === 'full' ? 0.84 : chargeMix === 'mid' ? 0.92 : 1;

      this.playOneShot(audioAssets.laserLarge, {
        playbackRate: rate,
        playbackVariance: 0.01,
        volume: audioTuning.secondaryWeaponVolume * volumeScale,
      });

      if (chargeMix === 'full') {
        this.playOneShot(audioAssets.lowFrequencyExplosion, {
          playbackRate: 1.02,
          volume: audioTuning.secondaryWeaponVolume * 0.42,
        });
      }

      return;
    }

    this.playOneShot(audioAssets.laserSmall, {
      playbackRate: 1,
      playbackVariance: 0.005,
      volume: audioTuning.primaryWeaponVolume,
    });
  }

  private playCombatEvent(event: CombatEventState): void {
    switch (event.kind) {
      case 'death':
        this.playOneShot(audioAssets.explosionCrunch, {
          playbackRate: 1,
          playbackVariance: 0.03,
          volume: audioTuning.explosionVolume,
        });
        this.playOneShot(audioAssets.lowFrequencyExplosion, {
          playbackRate: 0.94,
          volume: audioTuning.explosionVolume * 0.55,
        });
        return;
      case 'shield-break':
        this.playOneShot(audioAssets.forceField, {
          playbackRate: 0.92,
          playbackVariance: 0.01,
          volume: audioTuning.impactVolume * 1.05,
        });
        return;
      case 'stagger':
        this.playOneShot(audioAssets.forceField, {
          playbackRate: 1.02,
          playbackVariance: 0.01,
          volume: audioTuning.impactVolume * 0.72,
        });
        return;
      case 'telegraph':
        this.playTelegraphCue();
        return;
      case 'hit':
      default:
        if (event.targetId === 'player-ship') {
          this.playOneShot(audioAssets.impactMetal, {
            playbackRate: 0.95,
            playbackVariance: 0.02,
            volume: audioTuning.impactVolume * 1.05,
          });
        } else {
          this.playOneShot(audioAssets.impactMetal, {
            playbackRate: 1.02,
            playbackVariance: 0.02,
            volume: audioTuning.impactVolume * 0.78,
          });
        }
    }
  }

  private playTelegraphCue(): void {
    const now = performance.now();

    if (now - this.lastTelegraphAtMs < audioTuning.telegraphCooldownMs) {
      return;
    }

    this.lastTelegraphAtMs = now;
    this.playOneShot(audioAssets.forceField, {
      playbackRate: 0.84,
      playbackVariance: 0.01,
      volume: audioTuning.telegraphVolume,
    });
  }

  private playImpact(impactId: string): void {
    if (!impactId.startsWith('impact-')) {
      return;
    }

    this.playOneShot(audioAssets.impactMetal, {
      playbackRate: 1.04,
      playbackVariance: 0.02,
      volume: audioTuning.beamImpactVolume,
    });
  }

  private updateLoopMix(state: GameStore): void {
    const runtimeActive = state.isRuntimeRunning;
    const speed = getSpeed(state);
    const speedMix = clamp(speed / audioTuning.speedForMaxMix, 0, 1);
    const thrustMix = getDirectionalThrust(state.input);
    const engineActive = runtimeActive && (thrustMix > 0.04 || speed > audioTuning.engineWakeSpeed);
    const boostActive = state.input.boost && state.snapshot.ship.resources.boostEnergy > 0;
    const chargeMix = clamp(
      state.snapshot.ship.secondaryChargeSeconds / combatTuning.secondaryChargeFullSeconds,
      0,
      1,
    );
    const spoolProgress = state.snapshot.travel.mode === 'spooling' ? state.snapshot.travel.progress : 0;
    const uiDuck = state.galaxyMapOpen ? audioTuning.navigationDuck : 1;

    this.syncLoopChannel(
      'engine',
      engineActive,
      uiDuck * clamp(audioTuning.engineBaseVolume + speedMix * 0.15 + Number(state.input.thrustForward) * 0.1, 0, 1),
      audioTuning.engineBasePlaybackRate + speedMix * audioTuning.enginePlaybackRange + thrustMix * 0.08 + (boostActive ? 0.06 : 0),
    );
    this.syncLoopChannel(
      'thruster',
      runtimeActive && thrustMix > 0.03,
      uiDuck * clamp(thrustMix * audioTuning.thrusterBaseVolume + (boostActive ? 0.06 : 0), 0, 1),
      0.92 + thrustMix * 0.24 + (boostActive ? 0.08 : 0),
    );
    this.syncLoopChannel(
      'boost',
      runtimeActive && boostActive,
      uiDuck * clamp(audioTuning.boostLoopVolume + speedMix * 0.08, 0, 1),
      0.94 + speedMix * 0.22,
    );
    this.syncLoopChannel(
      'charge',
      runtimeActive && chargeMix > 0.02,
      uiDuck * clamp(audioTuning.chargeLoopVolume * (0.24 + chargeMix * 0.92), 0, 1),
      0.62 + chargeMix * 0.42,
    );
    this.syncLoopChannel(
      'spool',
      runtimeActive && spoolProgress > 0,
      uiDuck * clamp(audioTuning.spoolLoopVolume * (0.3 + spoolProgress * 0.95), 0, 1),
      0.74 + spoolProgress * 0.64,
    );
  }

  private syncLoopChannel(
    name: LoopChannelName,
    active: boolean,
    targetVolume: number,
    targetPlaybackRate: number,
  ): void {
    const channel = this.loops[name];

    if (!this.unlocked) {
      if (!active && channel.element !== null) {
        channel.element.pause();
      }
      return;
    }

    channel.element ??= this.createLoopElement(channel.variants);
    const element = channel.element;

    if (active && element.paused) {
      if (!element.src) {
        element.src = channel.variants[0] ?? '';
      }

      void element.play().catch(() => undefined);
    }

    const nextVolume = active
      ? element.volume + (clamp(targetVolume * audioTuning.masterVolume, 0, 1) - element.volume) * audioTuning.loopSmoothing
      : element.volume * (1 - audioTuning.loopSmoothing);
    const nextPlaybackRate = element.playbackRate + (targetPlaybackRate - element.playbackRate) * audioTuning.loopSmoothing;

    element.volume = clamp(nextVolume, 0, 1);
    element.playbackRate = clamp(nextPlaybackRate, 0.5, 1.75);

    if (!active && element.volume <= 0.01) {
      element.pause();
      element.currentTime = 0;
    }
  }

  private playOneShot(variants: readonly string[], options: OneShotOptions): void {
    if (!this.unlocked) {
      return;
    }

    const url = this.getNextOneShotUrl(variants);
    const element = new Audio(url);
    const finalPlaybackRate = clamp(
      options.playbackRate + (Math.random() * 2 - 1) * (options.playbackVariance ?? 0),
      0.55,
      1.7,
    );

    element.preload = 'auto';
    element.volume = clamp(options.volume * audioTuning.masterVolume, 0, 1);
    element.playbackRate = finalPlaybackRate;

    const cleanup = () => {
      element.removeEventListener('ended', cleanup);
      element.removeEventListener('error', cleanup);
      this.activeOneShots.delete(element);
    };

    element.addEventListener('ended', cleanup);
    element.addEventListener('error', cleanup);
    this.activeOneShots.add(element);
    void element.play().catch(cleanup);
  }

  private createLoopElement(variants: readonly string[]): HTMLAudioElement {
    const element = new Audio(variants[0] ?? '');
    element.loop = true;
    element.preload = 'auto';
    element.volume = 0;
    return element;
  }

  private preloadAllAudio(): void {
    for (const variants of Object.values(audioAssets)) {
      for (const url of variants) {
        if (this.preloadedElements.has(url)) {
          continue;
        }

        const element = new Audio(url);
        element.preload = 'auto';
        element.load();
        this.preloadedElements.set(url, element);
      }
    }
  }

  private getNextOneShotUrl(variants: readonly string[]): string {
    const key = variants.join('|');
    const nextIndex = this.oneShotCursor.get(key) ?? 0;
    const url = variants[nextIndex % variants.length] ?? variants[0] ?? '';
    this.oneShotCursor.set(key, (nextIndex + 1) % variants.length);
    return url;
  }

  private addUnlockListeners(): void {
    window.addEventListener('keydown', this.unlockAudio, { passive: true });
    window.addEventListener('mousedown', this.unlockAudio, { passive: true });
    window.addEventListener('pointerdown', this.unlockAudio, { passive: true });
    window.addEventListener('touchstart', this.unlockAudio, { passive: true });
  }

  private removeUnlockListeners(): void {
    window.removeEventListener('keydown', this.unlockAudio);
    window.removeEventListener('mousedown', this.unlockAudio);
    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('touchstart', this.unlockAudio);
  }
}

export const gameAudio = new GameAudioEngine();
