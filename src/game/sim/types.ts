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
  position: Vec3;
  radius: number;
  surface: PlanetSurfaceStyle;
}

export type PlanetBiome = 'rocky' | 'desert' | 'lush' | 'ice' | 'lava' | 'gas';

export interface PlanetRingStyle {
  color: string;
  detailColor: string;
  innerRadiusScale: number;
  opacity: number;
  outerRadiusScale: number;
  tiltRadians: number;
}

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
  ring: PlanetRingStyle | null;
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

export interface ProjectileState {
  color: string;
  damage: DamagePacket;
  id: string;
  impactRadius: number;
  kind: 'primary' | 'secondary';
  length: number;
  position: Vec3;
  radius: number;
  ttlSeconds: number;
  velocity: Vec3;
}

export interface ImpactState {
  color: string;
  id: string;
  maxTtlSeconds: number;
  position: Vec3;
  radius: number;
  ttlSeconds: number;
}

export interface ShipResources {
  boostEnergy: number;
  boostEnergyMax: number;
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

export interface GameSnapshot {
  activeSector: SectorCoordinate;
  activeSectorDescriptor: SectorDescriptor;
  activeSystem: SectorCoordinate;
  aimTarget: Vec3;
  elapsedSeconds: number;
  impacts: ImpactState[];
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

export interface DamageResolution {
  appliedHullDamage: number;
  appliedShieldDamage: number;
  destroyed: boolean;
  nextResources: ShipResources;
}
