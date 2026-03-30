export interface Vec3 {
  x: number;
  y: number;
  z: number;
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
  position: Vec3;
  velocity: Vec3;
  yawRadians: number;
}

export interface GameSnapshot {
  activeSector: SectorCoordinate;
  activeSectorDescriptor: SectorDescriptor;
  elapsedSeconds: number;
  ship: ShipState;
  universeSeed: string;
}

export interface InputState {
  boost: boolean;
  thrustBackward: boolean;
  thrustForward: boolean;
  yawLeft: boolean;
  yawRight: boolean;
}
