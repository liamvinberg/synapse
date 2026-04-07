export const mouseLookTuning = {
  pitchDirection: 1,
  pitchSensitivity: 0.014,
  yawDirection: -1,
  yawSensitivity: 0.014,
} as const;

export const chaseCameraTuning = {
  distanceBase: 9,
  distanceSpeedMax: 3,
  distanceSpeedScale: 0.1,
  followSharpness: 10,
  height: 2.4,
  lookAheadDistance: 16,
  lookAheadHeight: 0.85,
  pitchLift: 0.9,
} as const;

export const motionFeedbackTuning = {
  boostFovBonus: 4,
  engineGlowBase: 0.55,
  engineGlowBoost: 0.95,
  engineGlowSpeedScale: 0.03,
  engineLengthBase: 0.75,
  engineLengthBoost: 1.1,
  engineLengthSpeedScale: 0.05,
  maxFovBoost: 9,
  speedForMaxFov: 42,
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
