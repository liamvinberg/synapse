import { audioAssets } from '@/game/audio/audioAssets';
import { audioTuning, combatTuning } from '@/game/config/tuning';
import type { CombatEventState, ProjectileState, SectorCoordinate } from '@/game/sim/types';
import type { GameStore } from '@/game/state/gameStore';
import { useGameStore } from '@/game/state/gameStore';

type LoopChannelName = 'boost' | 'engine' | 'spool' | 'thruster';

interface LoopChannel {
  element: HTMLAudioElement | null;
  variants: readonly string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomFrom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0]!;
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
    boost: { element: null, variants: audioAssets.spaceEngineLarge },
    engine: { element: null, variants: audioAssets.spaceEngineLow },
    spool: { element: null, variants: audioAssets.engineCircular },
    thruster: { element: null, variants: audioAssets.thrusterFire },
  };

  private readonly activeOneShots = new Set<HTMLAudioElement>();

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
      this.playOneShot(audioAssets.doorOpen, audioTuning.uiVolume * 0.95, 1);
    } else if (previousState.galaxyMapOpen && !state.galaxyMapOpen) {
      this.playOneShot(audioAssets.doorClose, audioTuning.uiVolume * 0.9, 1);
    }

    if (
      state.galaxyMapOpen &&
      !areCoordinatesEqual(previousState.snapshot.travel.targetSystem, state.snapshot.travel.targetSystem)
    ) {
      this.playOneShot(audioAssets.computerNoise, audioTuning.uiVolume * 0.8, 1.05, 0.04);
    }

    const previousTravelMode = previousState.snapshot.travel.mode;
    const travelMode = state.snapshot.travel.mode;
    if (previousTravelMode !== 'spooling' && travelMode === 'spooling') {
      this.playOneShot(audioAssets.forceField, audioTuning.travelVolume * 0.65, 0.88);
    }

    if (
      previousTravelMode === 'spooling' &&
      travelMode === 'local' &&
      previousState.snapshot.travel.targetSystem !== null &&
      state.snapshot.travel.targetSystem === null
    ) {
      this.playOneShot(audioAssets.lowFrequencyExplosion, audioTuning.travelVolume * 0.8, 0.9);
      this.playOneShot(audioAssets.forceField, audioTuning.travelVolume * 0.5, 1.12);
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
  }

  private playProjectile(projectile: ProjectileState): void {
    if (projectile.owner === 'enemy') {
      this.playOneShot(audioAssets.laserRetro, audioTuning.enemyWeaponVolume, 1.02, 0.03);
      return;
    }

    if (projectile.kind === 'secondary') {
      const chargeMix = getSecondaryChargeMix(projectile);
      const volumeScale = chargeMix === 'full' ? 1.25 : chargeMix === 'mid' ? 1.05 : 0.9;
      const rate = chargeMix === 'full' ? 0.84 : chargeMix === 'mid' ? 0.92 : 1;

      this.playOneShot(audioAssets.laserLarge, audioTuning.weaponVolume * volumeScale, rate, 0.02);

      if (chargeMix === 'full') {
        this.playOneShot(audioAssets.lowFrequencyExplosion, audioTuning.weaponVolume * 0.45, 1.04);
      }

      return;
    }

    this.playOneShot(audioAssets.laserSmall, audioTuning.weaponVolume, 1.08, 0.05);
  }

  private playCombatEvent(event: CombatEventState): void {
    switch (event.kind) {
      case 'death':
        this.playOneShot(audioAssets.explosionCrunch, audioTuning.explosionVolume, 1, 0.05);
        this.playOneShot(audioAssets.lowFrequencyExplosion, audioTuning.explosionVolume * 0.55, 0.94);
        return;
      case 'shield-break':
        this.playOneShot(audioAssets.forceField, audioTuning.impactVolume * 1.05, 0.92, 0.03);
        return;
      case 'stagger':
        this.playOneShot(audioAssets.forceField, audioTuning.impactVolume * 0.72, 1.04, 0.04);
        return;
      case 'telegraph':
        this.playTelegraphCue();
        return;
      case 'hit':
      default:
        if (event.targetId === 'player-ship') {
          this.playOneShot(audioAssets.impactMetal, audioTuning.impactVolume * 1.05, 0.95, 0.04);
        } else {
          this.playOneShot(audioAssets.impactMetal, audioTuning.impactVolume * 0.78, 1.04, 0.05);
        }
    }
  }

  private playTelegraphCue(): void {
    const now = performance.now();

    if (now - this.lastTelegraphAtMs < audioTuning.telegraphCooldownMs) {
      return;
    }

    this.lastTelegraphAtMs = now;
    this.playOneShot(audioAssets.forceField, audioTuning.telegraphVolume, 0.84, 0.02);
  }

  private playImpact(impactId: string): void {
    if (!impactId.startsWith('impact-')) {
      return;
    }

    this.playOneShot(audioAssets.impactMetal, audioTuning.impactVolume * 0.35, 1.08, 0.08);
  }

  private updateLoopMix(state: GameStore): void {
    const runtimeActive = state.isRuntimeRunning;
    const speed = getSpeed(state);
    const speedMix = clamp(speed / audioTuning.speedForMaxMix, 0, 1);
    const thrustMix = getDirectionalThrust(state.input);
    const boostActive = state.input.boost && state.snapshot.ship.resources.boostEnergy > 0;
    const spoolProgress = state.snapshot.travel.mode === 'spooling' ? state.snapshot.travel.progress : 0;
    const uiDuck = state.galaxyMapOpen ? audioTuning.navigationDuck : 1;

    this.syncLoopChannel(
      'engine',
      runtimeActive,
      uiDuck * clamp(audioTuning.engineBaseVolume + speedMix * 0.13 + Number(state.input.thrustForward) * 0.08, 0, 1),
      audioTuning.engineBasePlaybackRate + speedMix * audioTuning.enginePlaybackRange + (boostActive ? 0.06 : 0),
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
        element.src = randomFrom(channel.variants);
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
      element.src = randomFrom(channel.variants);
    }
  }

  private playOneShot(
    variants: readonly string[],
    volume: number,
    playbackRate: number,
    playbackVariance = 0,
  ): void {
    if (!this.unlocked) {
      return;
    }

    const element = new Audio(randomFrom(variants));
    const finalPlaybackRate = clamp(
      playbackRate + (Math.random() * 2 - 1) * playbackVariance,
      0.55,
      1.7,
    );

    element.preload = 'auto';
    element.volume = clamp(volume * audioTuning.masterVolume, 0, 1);
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
    const element = new Audio(randomFrom(variants));
    element.loop = true;
    element.preload = 'auto';
    element.volume = 0;
    return element;
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
