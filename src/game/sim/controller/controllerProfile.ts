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
  bankResponse: 8,
  boostDrainPerSecond: 30,
  boostMultiplier: 2.2,
  boostRechargePerSecond: 18,
  brakeFactor: 0.78,
  cursorPitchRate: 1.3,
  cursorYawRate: 1.9,
  linearDamping: 0.965,
  maxBankRadians: Math.PI / 4,
  maxPitchRadians: Math.PI / 3.25,
  reverseThrust: 9,
  strafeThrust: 14,
  thrustForward: 18,
};
