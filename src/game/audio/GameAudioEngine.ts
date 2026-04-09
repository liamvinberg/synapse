import { audioAssets } from '@/game/audio/audioAssets';
import { audioTuning, combatTuning, enemyTuning } from '@/game/config/tuning';
import type { CombatEventState, ImpactState, ProjectileState, SectorCoordinate } from '@/game/sim/types';
import type { GameStore } from '@/game/state/gameStore';
import { useGameStore } from '@/game/state/gameStore';

type LayerName = 'charge';

type SpatialPoint = { x: number; y: number; z: number };

type AssetLoopName = 'engine' | 'spool' | 'thruster';

interface ProceduralLayer {
  gain: GainNode;
  noiseFilter?: BiquadFilterNode;
  noiseGain?: GainNode;
  noiseSource?: AudioBufferSourceNode;
  oscA: OscillatorNode;
  oscB?: OscillatorNode;
}

interface OneShotOptions {
  position?: SpatialPoint;
  playbackRate: number;
  playbackVariance?: number;
  volume: number;
}

class SeamlessLoopLayer {
  private buffer: AudioBuffer | null = null;
  private readonly output: GainNode;
  private segmentTimer: number | null = null;
  private activeSources: Array<{ gain: GainNode; source: AudioBufferSourceNode }> = [];
  private isActive = false;
  private playbackRate = 1;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly crossfadeSeconds: number,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
  }

  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  setState(active: boolean, volume: number, playbackRate: number): void {
    this.playbackRate = playbackRate;
    this.output.gain.setTargetAtTime(volume, this.context.currentTime, 0.06);

    for (const entry of this.activeSources) {
      entry.source.playbackRate.setTargetAtTime(playbackRate, this.context.currentTime, 0.08);
    }

    if (active && !this.isActive) {
      this.start();
      return;
    }

    if (!active && this.isActive) {
      this.stop();
    }
  }

  dispose(): void {
    this.stop();
    this.output.disconnect();
  }

  private start(): void {
    if (this.buffer === null) {
      return;
    }

    this.isActive = true;
    this.scheduleSegment(this.context.currentTime);
  }

  private stop(): void {
    this.isActive = false;

    if (this.segmentTimer !== null) {
      window.clearTimeout(this.segmentTimer);
      this.segmentTimer = null;
    }

    const stopAt = this.context.currentTime + 0.12;
    for (const entry of this.activeSources) {
      entry.gain.gain.cancelScheduledValues(this.context.currentTime);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, this.context.currentTime);
      entry.gain.gain.linearRampToValueAtTime(0, stopAt);
      entry.source.stop(stopAt + 0.02);
    }
  }

  private scheduleSegment(startTime: number): void {
    if (!this.isActive || this.buffer === null) {
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.playbackRate;

    const gain = this.context.createGain();
    const duration = this.buffer.duration / this.playbackRate;
    const overlap = Math.min(this.crossfadeSeconds, Math.max(0.05, duration * 0.18));
    const fadeInEnd = startTime + overlap;
    const fadeOutStart = startTime + duration - overlap;
    const stopAt = startTime + duration + 0.02;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, fadeInEnd);
    gain.gain.setValueAtTime(1, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    source.connect(gain);
    gain.connect(this.output);
    source.start(startTime);
    source.stop(stopAt);

    const entry = { gain, source };
    this.activeSources.push(entry);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((candidate) => candidate !== entry);
      source.disconnect();
      gain.disconnect();
    };

    const nextStartDelayMs = Math.max(0, (duration - overlap) * 1000);
    this.segmentTimer = window.setTimeout(() => {
      this.scheduleSegment(this.context.currentTime);
    }, nextStartDelayMs);
  }
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
      (Number(input.strafeLeft) + Number(input.strafeRight)) * 0.82 +
      (Number(input.thrustUp) + Number(input.thrustDown)) * 0.72 +
      Number(input.brake) * 0.55,
    0,
    1.9,
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

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const durationSeconds = 2;
  const length = Math.floor(context.sampleRate * durationSeconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

export class GameAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: Partial<Record<LayerName, ProceduralLayer>> = {};
  private loopLayers: Partial<Record<AssetLoopName, SeamlessLoopLayer>> = {};
  private readonly bufferPromises = new Map<string, Promise<AudioBuffer>>();
  private readonly oneShotCursor = new Map<string, number>();

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
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.removeUnlockListeners();
    for (const loopLayer of Object.values(this.loopLayers)) {
      loopLayer?.dispose();
    }
    this.layers = {};
    this.loopLayers = {};
    this.bufferPromises.clear();
    this.oneShotCursor.clear();
    this.lastState = null;
    this.unlocked = false;

    if (this.audioContext !== null) {
      const context = this.audioContext;
      this.audioContext = null;
      this.masterGain = null;
      void context.close();
    }
  }

  private readonly unlockAudio = (): void => {
    void this.unlockAndWarm();
  };

  private async unlockAndWarm(): Promise<void> {
    if (this.audioContext === null) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;
      this.masterGain.gain.value = audioTuning.masterVolume;
      this.masterGain.connect(compressor);
      compressor.connect(this.audioContext.destination);
      this.layers = this.createProceduralLayers(this.audioContext, this.masterGain);
      this.loopLayers = this.createAssetLoopLayers(this.audioContext, this.masterGain);
    }

    await this.audioContext.resume();
    this.unlocked = true;
    this.removeUnlockListeners();
    void this.preloadAllAudio();

    if (this.lastState !== null) {
      void this.preloadAllAudio();
      this.updateMix(this.lastState);
    }
  }

  private handleStateChange(state: GameStore, previousState: GameStore): void {
    if (this.unlocked) {
      this.playStateTransitions(state, previousState);
      this.updateMix(state);
    }
  }

  private playStateTransitions(state: GameStore, previousState: GameStore): void {
    const previousBoostActive = this.isBoostAudible(previousState);
    const boostActive = this.isBoostAudible(state);

    if (!previousState.galaxyMapOpen && state.galaxyMapOpen) {
      this.playOneShot(audioAssets.doorOpen, { playbackRate: 1, volume: audioTuning.uiVolume * 0.95 });
    } else if (previousState.galaxyMapOpen && !state.galaxyMapOpen) {
      this.playOneShot(audioAssets.doorClose, { playbackRate: 1, volume: audioTuning.uiVolume * 0.9 });
    }

    if (!previousBoostActive && boostActive) {
      this.playOneShot(audioAssets.boostThruster, {
        position: state.snapshot.ship.position,
        playbackRate: 1,
        playbackVariance: 0.01,
        volume: audioTuning.boostOnsetVolume,
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
      this.playImpact(impact);
    }

    this.playShipDamageCues(state, previousState);

    if (
      previousState.snapshot.ship.secondaryChargeSeconds <= 0 &&
      state.snapshot.ship.secondaryChargeSeconds > 0
    ) {
      this.playOneShot(audioAssets.forceField, {
        playbackRate: 0.72,
        playbackVariance: 0.01,
        volume: audioTuning.chargeStartVolume,
      });
    }
  }

  private playProjectile(projectile: ProjectileState): void {
    if (projectile.owner === 'enemy') {
      this.playOneShot(audioAssets.laserRetro, {
        position: projectile.position,
        playbackRate: 1,
        playbackVariance: 0.01,
        volume: audioTuning.enemyWeaponVolume,
      });
      return;
    }

    if (projectile.kind === 'secondary') {
      const chargeMix = getSecondaryChargeMix(projectile);
      const volumeScale = chargeMix === 'full' ? 1.25 : chargeMix === 'mid' ? 1.08 : 0.92;
      const rate = chargeMix === 'full' ? 0.82 : chargeMix === 'mid' ? 0.9 : 0.98;

      this.playOneShot(audioAssets.laserLarge, {
        position: projectile.position,
        playbackRate: rate,
        playbackVariance: 0.008,
        volume: audioTuning.secondaryWeaponVolume * volumeScale,
      });

      if (chargeMix !== 'partial') {
        this.playOneShot(audioAssets.forceField, {
          position: projectile.position,
          playbackRate: chargeMix === 'full' ? 0.76 : 0.88,
          playbackVariance: 0.01,
          volume: audioTuning.secondaryWeaponVolume * (chargeMix === 'full' ? 0.26 : 0.16),
        });
      }

      return;
    }

    this.playOneShot(audioAssets.laserSmall, {
      position: projectile.position,
      playbackRate: 1,
      playbackVariance: 0.004,
      volume: audioTuning.primaryWeaponVolume,
    });
  }

  private playCombatEvent(event: CombatEventState): void {
    switch (event.kind) {
      case 'death':
        this.playOneShot(audioAssets.explosionCrunch, {
          position: event.position,
          playbackRate: 1,
          playbackVariance: 0.03,
          volume: audioTuning.explosionVolume,
        });
        this.playOneShot(audioAssets.lowFrequencyExplosion, {
          position: event.position,
          playbackRate: 0.94,
          volume: audioTuning.explosionVolume * 0.55,
        });
        return;
      case 'shield-break':
        this.playOneShot(audioAssets.forceField, {
          position: event.position,
          playbackRate: 0.9,
          playbackVariance: 0.01,
          volume: audioTuning.impactVolume * 1.05,
        });
        return;
      case 'stagger':
        this.playOneShot(audioAssets.forceField, {
          position: event.position,
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
        return;
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

  private playImpact(impact: ImpactState): void {
    const isPlanetImpact = impact.anchorPlanetId !== undefined;
    const isLarge = impact.radius >= combatTuning.secondaryProjectileImpactRadius.partial;
    const isShieldLike =
      impact.color === enemyTuning.fighterShieldGlowColor ||
      impact.color === combatTuning.secondaryProjectileGlowColor;

    if (isPlanetImpact) {
      this.playOneShot(audioAssets.planetImpact, {
        position: impact.position,
        playbackRate: isLarge ? 0.92 : 1,
        playbackVariance: 0.02,
        volume: audioTuning.planetImpactVolume,
      });
      return;
    }

    this.playOneShot(audioAssets.hullImpact, {
      position: impact.position,
      playbackRate: isLarge ? 0.96 : 1.02,
      playbackVariance: 0.02,
      volume: audioTuning.beamImpactVolume * (isLarge ? 1.08 : 1),
    });

    if (isLarge || isShieldLike) {
      this.playOneShot(audioAssets.forceField, {
        position: impact.position,
        playbackRate: isLarge ? 0.86 : 1.04,
        playbackVariance: 0.01,
        volume: audioTuning.beamImpactVolume * 0.82,
      });
    }
  }

  private playShipDamageCues(state: GameStore, previousState: GameStore): void {
    const previousShip = previousState.snapshot.ship;
    const ship = state.snapshot.ship;
    const shieldLoss = Math.max(0, previousShip.resources.shield - ship.resources.shield);
    const hullLoss = Math.max(0, previousShip.resources.hull - ship.resources.hull);
    const startedCollision =
      previousShip.collisionCooldownSeconds <= 0 && ship.collisionCooldownSeconds > 0;

    if (startedCollision) {
      this.playOneShot(audioAssets.planetImpact, {
        position: ship.position,
        playbackRate: 0.82,
        playbackVariance: 0.02,
        volume: audioTuning.collisionVolume * 0.95,
      });
      this.playOneShot(audioAssets.lowFrequencyExplosion, {
        position: ship.position,
        playbackRate: 0.9,
        volume: audioTuning.collisionVolume * 0.28,
      });

      if (shieldLoss > 0) {
        this.playOneShot(audioAssets.forceField, {
          position: ship.position,
          playbackRate: 0.86,
          playbackVariance: 0.01,
          volume: audioTuning.collisionVolume * 0.42,
        });
      }

      return;
    }

    if (shieldLoss > 0) {
      this.playOneShot(audioAssets.forceField, {
        position: ship.position,
        playbackRate: 0.92,
        playbackVariance: 0.01,
        volume: audioTuning.playerShieldVolume,
      });
    }

    if (hullLoss > 0) {
      this.playOneShot(audioAssets.hullImpact, {
        position: ship.position,
        playbackRate: 0.88,
        playbackVariance: 0.02,
        volume: audioTuning.playerHullVolume,
      });
    }
  }

  private updateProceduralMix(state: GameStore): void {
    const context = this.audioContext;
    if (context === null) {
      return;
    }

    const runtimeActive = state.isRuntimeRunning;
    const chargeMix = runtimeActive
      ? clamp(state.snapshot.ship.secondaryChargeSeconds / combatTuning.secondaryChargeFullSeconds, 0, 1)
      : 0;
    const uiDuck = state.galaxyMapOpen ? audioTuning.navigationDuck : 1;
    const master = audioTuning.masterVolume * uiDuck;

    if (this.masterGain !== null) {
      this.masterGain.gain.setTargetAtTime(master, context.currentTime, 0.045);
    }

    const charge = this.layers.charge;
    if (charge !== undefined) {
      charge.gain.gain.setTargetAtTime(chargeMix * 0.18, context.currentTime, 0.035);
      charge.oscA.frequency.setTargetAtTime(160 + chargeMix * 520, context.currentTime, 0.035);
      charge.oscB?.frequency.setTargetAtTime(240 + chargeMix * 860, context.currentTime, 0.035);
      charge.noiseFilter?.frequency.setTargetAtTime(220 + chargeMix * 2400, context.currentTime, 0.035);
      charge.noiseGain?.gain.setTargetAtTime(0.01 + chargeMix * 0.08, context.currentTime, 0.035);
    }
  }

  private updateAssetLoopMix(state: GameStore): void {
    const context = this.audioContext;
    if (context === null) {
      return;
    }

    const runtimeActive = state.isRuntimeRunning;
    const speed = getSpeed(state);
    const speedMix = clamp(speed / audioTuning.speedForMaxMix, 0, 1);
    const thrustMix = getDirectionalThrust(state.input);
    const boostMix = this.isBoostAudible(state) ? 1 : 0;
    const engineMix = runtimeActive ? clamp(thrustMix * 0.78 + speedMix * 0.58 + boostMix * 0.24, 0, 1) : 0;
    const spoolMix = runtimeActive && state.snapshot.travel.mode === 'spooling'
      ? clamp(state.snapshot.travel.progress, 0, 1)
      : 0;
    const thrusterMix = runtimeActive ? clamp(thrustMix, 0, 1) : 0;

    this.loopLayers.engine?.setState(
      engineMix > 0.03,
      audioTuning.engineBaseVolume + engineMix * 0.17,
      audioTuning.engineBasePlaybackRate + speedMix * audioTuning.enginePlaybackRange + thrustMix * 0.04 + boostMix * 0.05,
    );
    this.loopLayers.thruster?.setState(
      thrusterMix > 0.04,
      audioTuning.thrusterBaseVolume + thrusterMix * 0.1 + boostMix * 0.03,
      0.92 + thrusterMix * 0.12 + boostMix * 0.04,
    );
    this.loopLayers.spool?.setState(
      spoolMix > 0,
      audioTuning.spoolLoopVolume * (0.28 + spoolMix * 0.92),
      0.78 + spoolMix * 0.28,
    );
  }

  private updateMix(state: GameStore): void {
    this.updateAssetLoopMix(state);
    this.updateProceduralMix(state);
  }

  private async playOneShot(variants: readonly string[], options: OneShotOptions): Promise<void> {
    const context = this.audioContext;
    const masterGain = this.masterGain;

    if (!this.unlocked || context === null || masterGain === null) {
      return;
    }

    const url = this.getNextOneShotUrl(variants);
    const buffer = await this.ensureBuffer(url);

    if (this.audioContext !== context || this.masterGain !== masterGain) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clamp(
      options.playbackRate + (Math.random() * 2 - 1) * (options.playbackVariance ?? 0),
      0.55,
      1.7,
    );

    const gain = context.createGain();
    gain.gain.value = clamp(
      options.volume * this.getSpatialAttenuation(options.position),
      0,
      1,
    );

    source.connect(gain);

    if (options.position !== undefined) {
      const panner = context.createStereoPanner();
      panner.pan.value = this.getStereoPan(options.position);
      gain.connect(panner);
      panner.connect(masterGain);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
      };
    } else {
      gain.connect(masterGain);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    }

    source.start();
  }

  private async preloadAllAudio(): Promise<void> {
    const urls = new Set(Object.values(audioAssets).flat());
    await Promise.all([...urls].map((url) => this.ensureBuffer(url)));

    await Promise.all([
      this.attachLoopBuffer('engine', audioAssets.engineAmbience[0]),
      this.attachLoopBuffer('thruster', audioAssets.thrusterFire[0]),
      this.attachLoopBuffer('spool', audioAssets.engineCircular[0]),
    ]);
  }

  private ensureBuffer(url: string): Promise<AudioBuffer> {
    const existing = this.bufferPromises.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const context = this.audioContext;
    if (context === null) {
      return Promise.reject(new Error('Audio context is not ready'));
    }

    const promise = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load audio asset: ${url}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return context.decodeAudioData(arrayBuffer.slice(0));
      });

    this.bufferPromises.set(url, promise);
    return promise;
  }

  private getNextOneShotUrl(variants: readonly string[]): string {
    const key = variants.join('|');
    const nextIndex = this.oneShotCursor.get(key) ?? 0;
    const url = variants[nextIndex % variants.length] ?? variants[0] ?? '';
    this.oneShotCursor.set(key, (nextIndex + 1) % variants.length);
    return url;
  }

  private createProceduralLayers(
    context: AudioContext,
    destination: GainNode,
  ): Partial<Record<LayerName, ProceduralLayer>> {
    const noiseBuffer = createNoiseBuffer(context);

    return {
      charge: this.createLayer(context, destination, noiseBuffer, {
        noiseFrequency: 320,
        noiseQ: 2.2,
        oscAFrequency: 160,
        oscAType: 'sine',
        oscBFrequency: 240,
        oscBType: 'sawtooth',
      }),
    };
  }

  private createAssetLoopLayers(
    context: AudioContext,
    destination: GainNode,
  ): Partial<Record<AssetLoopName, SeamlessLoopLayer>> {
    return {
      engine: new SeamlessLoopLayer(context, destination, audioTuning.loopCrossfadeSeconds),
      spool: new SeamlessLoopLayer(context, destination, audioTuning.loopCrossfadeSeconds),
      thruster: new SeamlessLoopLayer(context, destination, audioTuning.loopCrossfadeSeconds),
    };
  }

  private async attachLoopBuffer(name: AssetLoopName, url: string): Promise<void> {
    const loopLayer = this.loopLayers[name];
    if (loopLayer === undefined) {
      return;
    }

    const buffer = await this.ensureBuffer(url);
    loopLayer.setBuffer(buffer);
  }

  private getSpatialAttenuation(position: SpatialPoint | undefined): number {
    if (position === undefined || this.lastState === null) {
      return 1;
    }

    const shipPosition = this.lastState.snapshot.ship.position;
    const distance = Math.hypot(
      position.x - shipPosition.x,
      position.y - shipPosition.y,
      position.z - shipPosition.z,
    );

    if (distance <= audioTuning.spatialMinDistance) {
      return 1;
    }

    if (distance >= audioTuning.spatialMaxDistance) {
      return audioTuning.spatialFloor;
    }

    const normalized = (distance - audioTuning.spatialMinDistance) /
      (audioTuning.spatialMaxDistance - audioTuning.spatialMinDistance);
    return Math.max(audioTuning.spatialFloor, 1 - normalized * 0.72);
  }

  private isBoostAudible(state: GameStore): boolean {
    return (
      state.isRuntimeRunning &&
      state.input.boost &&
      state.input.thrustForward &&
      state.snapshot.ship.resources.boostEnergy > 0
    );
  }

  private getStereoPan(position: SpatialPoint): number {
    if (this.lastState === null) {
      return 0;
    }

    const shipPosition = this.lastState.snapshot.ship.position;
    const relativeX = position.x - shipPosition.x;
    return clamp(relativeX / audioTuning.spatialPanDistance, -1, 1);
  }

  private createLayer(
    context: AudioContext,
    destination: GainNode,
    noiseBuffer: AudioBuffer,
    options: {
      noiseFrequency: number;
      noiseQ: number;
      oscAFrequency: number;
      oscAType: OscillatorType;
      oscBFrequency?: number;
      oscBType?: OscillatorType;
    },
  ): ProceduralLayer {
    const gain = context.createGain();
    gain.gain.value = 0;

    const oscA = context.createOscillator();
    const oscAGain = context.createGain();
    oscA.type = options.oscAType;
    oscA.frequency.value = options.oscAFrequency;
    oscAGain.gain.value = 0.22;
    oscA.connect(oscAGain);
    oscAGain.connect(gain);
    oscA.start();

    let oscB: OscillatorNode | undefined;
    if (options.oscBFrequency !== undefined && options.oscBType !== undefined) {
      oscB = context.createOscillator();
      const oscBGain = context.createGain();
      oscB.type = options.oscBType;
      oscB.frequency.value = options.oscBFrequency;
      oscBGain.gain.value = 0.08;
      oscB.connect(oscBGain);
      oscBGain.connect(gain);
      oscB.start();
    }

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = options.noiseFrequency;
    noiseFilter.Q.value = options.noiseQ;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);
    noiseSource.start();

    gain.connect(destination);

    return {
      gain,
      noiseFilter,
      noiseGain,
      noiseSource,
      oscA,
      oscB,
    };
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
