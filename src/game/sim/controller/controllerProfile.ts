import { flightTuning } from '@/game/config/tuning';

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
  bankResponse: flightTuning.bankResponse,
  boostDrainPerSecond: flightTuning.boostDrainPerSecond,
  boostMultiplier: flightTuning.boostMultiplier,
  boostRechargePerSecond: flightTuning.boostRechargePerSecond,
  brakeFactor: flightTuning.brakeFactor,
  cursorPitchRate: 0.9,
  cursorYawRate: 1.35,
  linearDamping: flightTuning.linearDamping,
  maxBankRadians: flightTuning.maxBankRadians,
  maxPitchRadians: flightTuning.maxPitchRadians,
  reverseThrust: flightTuning.reverseThrust,
  strafeThrust: flightTuning.strafeThrust,
  thrustForward: flightTuning.thrustForward,
};
