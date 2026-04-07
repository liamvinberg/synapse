export const mouseLookTuning = {
  pitchDirection: 1,
  pitchSensitivity: 0.014,
  yawDirection: -1,
  yawSensitivity: 0.014,
} as const;

export const chaseCameraTuning = {
  adsDistance: 4.6,
  adsFov: 42,
  adsHeight: 1.2,
  adsLookAheadDistance: 26,
  adsLookAheadHeight: 0.2,
  adsPitchLift: 0.28,
  adsShoulderOffset: 0.42,
  distanceBase: 9,
  distanceSpeedMax: 3,
  distanceSpeedScale: 0.16,
  hipFov: 55,
  followSharpness: 10,
  height: 2.4,
  hipShoulderOffset: 1.15,
  lookAheadDistance: 16,
  lookAheadHeight: 0.85,
  pitchLift: 0.9,
  shoulderOffsetSharpness: 12,
} as const;

export const flightTuning = {
  bankResponse: 14,
  boostDrainPerSecond: 30,
  boostMultiplier: 4.35,
  boostRechargePerSecond: 18,
  brakeFactor: 0.7,
  linearDamping: 0.925,
  maxBankRadians: Math.PI / 4,
  maxPitchRadians: Math.PI / 3.25,
  reverseThrust: 14,
  strafeThrust: 21,
  thrustForward: 38,
} as const;

export const motionFeedbackTuning = {
  boostFovBonus: 4,
  engineGlowBase: 0.55,
  engineGlowBoost: 0.95,
  engineGlowSpeedScale: 0.03,
  engineLengthBase: 0.75,
  engineLengthBoost: 1.1,
  engineLengthSpeedScale: 0.05,
  maxFovBoost: 12,
  speedForMaxFov: 56,
} as const;

export const worldScaleTuning = {
  planetOrbitBaseDistance: 150,
  planetOrbitHeightRange: 24,
  planetOrbitSpacing: 135,
  planetOrbitVariance: 55,
  planetRadiusMax: 58,
  planetRadiusMin: 12,
  sectorSpan: 1400,
} as const;

export const combatTuning = {
  collisionBounceSpeed: 8,
  collisionCooldownSeconds: 0.45,
  collisionDamageShieldMultiplier: 1.4,
  collisionDamageSpeedThreshold: 18,
  collisionDamageStagger: 22,
  collisionDamageStep: 0.45,
  fireCooldownSeconds: 0.14,
  impactColor: '#7ec8ff',
  impactRadius: 1.15,
  impactTtlSeconds: 0.12,
  maxAimDistance: 1400,
  projectileDamage: {
    amount: 18,
    shieldMultiplier: 0.9,
    stagger: 16,
  },
  projectileRadius: 0.24,
  projectileSpawnOffset: 1.6,
  projectileSpeed: 120,
  projectileTtlSeconds: 1.8,
  shipCollisionRadius: 1.1,
} as const;
