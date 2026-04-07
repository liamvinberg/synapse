export interface ControllerProfile {
  bankResponse: number;
  boostDrainPerSecond: number;
  boostMultiplier: number;
  boostRechargePerSecond: number;
  brakeFactor: number;
  cursorPitchRate: number;
  cursorYawRate: number;
  linearDamping: number;
  maxBankRadians: number;
  maxPitchRadians: number;
  reverseThrust: number;
  strafeThrust: number;
  thrustForward: number;
}

export const actionChaseControllerProfile: ControllerProfile = {
  bankResponse: 14,
  boostDrainPerSecond: 30,
  boostMultiplier: 3.1,
  boostRechargePerSecond: 18,
  brakeFactor: 0.64,
  cursorPitchRate: 0.9,
  cursorYawRate: 1.35,
  linearDamping: 0.9,
  maxBankRadians: Math.PI / 4,
  maxPitchRadians: Math.PI / 3.25,
  reverseThrust: 10,
  strafeThrust: 14,
  thrustForward: 24,
};
