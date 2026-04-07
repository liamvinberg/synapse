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

export interface PlanetDescriptor {
  color: string;
  id: string;
  position: Vec3;
  radius: number;
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
  collisionCooldownSeconds: number;
  controlMode: 'action-chase';
  pitchRadians: number;
  position: Vec3;
  resources: ShipResources;
  velocity: Vec3;
  weaponCooldownSeconds: number;
  yawRadians: number;
}

export interface ProjectileState {
  damage: DamagePacket;
  id: string;
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
  aimTarget: Vec3;
  elapsedSeconds: number;
  impacts: ImpactState[];
  nextImpactId: number;
  nextProjectileId: number;
  projectiles: ProjectileState[];
  ship: ShipState;
  universeSeed: string;
}

export interface InputState {
  aim: Vec2;
  aimDownSights: boolean;
  boost: boolean;
  brake: boolean;
  fire: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  thrustBackward: boolean;
  thrustForward: boolean;
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
