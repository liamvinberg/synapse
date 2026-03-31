import { describe, expect, it } from 'vitest';
import { applyDamage } from '@/game/sim/combat/damage';
import type { ShipResources } from '@/game/sim/types';

const baseResources: ShipResources = {
  boostEnergy: 100,
  boostEnergyMax: 100,
  hull: 100,
  hullMax: 100,
  shield: 60,
  shieldMax: 60,
  shieldRegenDelaySeconds: 3,
  shieldRegenRate: 8,
  shieldRegenTimeoutSeconds: 0,
  stagger: 0,
  staggerMax: 100,
  staggerRecoveryPerSecond: 18,
};

describe('applyDamage', () => {
  it('depletes shields before hull', () => {
    const result = applyDamage(baseResources, {
      amount: 20,
      shieldMultiplier: 1,
      stagger: 12,
    });

    expect(result.appliedShieldDamage).toBe(20);
    expect(result.appliedHullDamage).toBe(0);
    expect(result.nextResources.shield).toBe(40);
    expect(result.nextResources.hull).toBe(100);
  });

  it('spills overflow damage into hull', () => {
    const result = applyDamage(
      {
        ...baseResources,
        shield: 10,
      },
      {
        amount: 25,
        shieldMultiplier: 1,
        stagger: 6,
      },
    );

    expect(result.appliedShieldDamage).toBe(10);
    expect(result.appliedHullDamage).toBe(15);
    expect(result.nextResources.shield).toBe(0);
    expect(result.nextResources.hull).toBe(85);
  });
});
