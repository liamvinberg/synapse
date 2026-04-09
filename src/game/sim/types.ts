export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface SectorCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface TravelState {
  mode: 'local' | 'spooling';
  progress: number;
  targetSystem: SectorCoordinate | null;
}

export interface PlanetDescriptor {
  color: string;
  id: string;
  orbitAngularSpeed: number;
  orbitDistance: number;
  orbitEccentricity: number;
  orbitPhaseRadians: number;
  orbitTiltRadians: number;
  position: Vec3;
  radius: number;
  spinSpeed: number;
  surface: PlanetSurfaceStyle;
  velocity: Vec3;
}

export type PlanetBiome = 'rocky' | 'desert' | 'lush' | 'ice' | 'lava' | 'gas';

export interface PlanetSurfaceStyle {
  atmosphereColor: string | null;
  atmosphereOpacity: number;
  atmosphereScale: number;
  banding: number;
  biome: PlanetBiome;
  cloudColor: string | null;
  cloudDensity: number;
  craterDensity: number;
  detailColor: string;
  emissiveColor: string | null;
  oceanLevel: number;
  polarCapAmount: number;
  primaryColor: string;
  roughness: number;
  secondaryColor: string;
  seed: number;
  specularStrength: number;
  terrainSharpness: number;
  textureScale: number;
  variant: number;
  warpAmount: number;
}

export interface SectorDescriptor {
  density: number;
  key: string;
  planets: PlanetDescriptor[];
  seed: number;
  starColor: string;
}

export interface ShipState {
  bankRadians: number;
  cameraShakeSeconds: number;
  cameraShakeStrength: number;
  collisionCooldownSeconds: number;
  controlMode: 'action-chase';
  pitchRadians: number;
  position: Vec3;
  resources: ShipResources;
  secondaryChargeSeconds: number;
  secondaryCooldownSeconds: number;
  velocity: Vec3;
  weaponCooldownSeconds: number;
  yawRadians: number;
}

export type CombatTeam = 'player' | 'enemy';

export interface CombatResources {
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  shieldRegenDelaySeconds: number;
  shieldRegenRate: number;
  shieldRegenTimeoutSeconds: number;
  stagger: number;
  staggerMax: number;
  staggerRecoveryPerSecond: number;
}

export interface ProjectileState {
  color: string;
  damage: DamagePacket;
  id: string;
  impactRadius: number;
  kind: 'primary' | 'secondary' | 'enemy';
  length: number;
  owner: CombatTeam;
  position: Vec3;
  radius: number;
  ttlSeconds: number;
  velocity: Vec3;
}

export interface ImpactState {
  anchorLocalOffset?: Vec3;
  anchorPlanetId?: string;
  color: string;
  id: string;
  maxTtlSeconds: number;
  position: Vec3;
  radius: number;
  ttlSeconds: number;
}

export type CombatEventKind = 'hit' | 'shield-break' | 'stagger' | 'death' | 'telegraph';

export interface CombatEventState {
  color: string;
  id: string;
  kind: CombatEventKind;
  maxTtlSeconds: number;
  position: Vec3;
  radius: number;
  targetId: string;
  ttlSeconds: number;
}

export interface ShipResources extends CombatResources {
  boostEnergy: number;
  boostEnergyMax: number;
}

export interface EnemyResources extends CombatResources {}

export type EnemyKind = 'fighter';

export type EnemyPhase = 'pursuit' | 'telegraph' | 'attack' | 'recovery' | 'staggered' | 'dead';

export interface EnemyAiState {
  phase: EnemyPhase;
  phaseSecondsRemaining: number;
  weaponCooldownSeconds: number;
}

export interface EnemyFeedbackState {
  deathFadeSeconds: number;
  hitFlashSeconds: number;
  shieldFlashSeconds: number;
}

export interface EnemyState {
  ai: EnemyAiState;
  feedback: EnemyFeedbackState;
  id: string;
  kind: EnemyKind;
  pitchRadians: number;
  position: Vec3;
  radius: number;
  resources: EnemyResources;
  velocity: Vec3;
  yawRadians: number;
}

export interface GameSnapshot {
  activeSector: SectorCoordinate;
  activeSectorDescriptor: SectorDescriptor;
  activeSystem: SectorCoordinate;
  aimTarget: Vec3;
  combatEvents: CombatEventState[];
  elapsedSeconds: number;
  enemies: EnemyState[];
  impacts: ImpactState[];
  nextCombatEventId: number;
  nextImpactId: number;
  nextProjectileId: number;
  projectiles: ProjectileState[];
  ship: ShipState;
  travel: TravelState;
  universeSeed: string;
}

export interface InputState {
  aim: Vec2;
  aimDownSights: boolean;
  boost: boolean;
  brake: boolean;
  fire: boolean;
  hyperCommit: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  thrustBackward: boolean;
  thrustForward: boolean;
  thrustDown: boolean;
  thrustUp: boolean;
}

export interface DamagePacket {
  amount: number;
  shieldMultiplier: number;
  stagger: number;
}

export interface DamageResolution<TResources extends CombatResources = CombatResources> {
  appliedHullDamage: number;
  appliedShieldDamage: number;
  destroyed: boolean;
  nextResources: TResources;
}
