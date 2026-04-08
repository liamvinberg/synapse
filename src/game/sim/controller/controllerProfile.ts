import { flightTuning } from '@/game/config/tuning';

export interface ControllerProfile {
  bankResponse: number;
  bankPitchSuppression: number;
  boostDrainPerSecond: number;
  boostMultiplier: number;
  boostReverseDamping: number;
  boostStrafeDamping: number;
  boostStrafeFactor: number;
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
  bankPitchSuppression: flightTuning.bankPitchSuppression,
  boostDrainPerSecond: flightTuning.boostDrainPerSecond,
  boostMultiplier: flightTuning.boostMultiplier,
  boostReverseDamping: flightTuning.boostReverseDamping,
  boostStrafeDamping: flightTuning.boostStrafeDamping,
  boostStrafeFactor: flightTuning.boostStrafeFactor,
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
