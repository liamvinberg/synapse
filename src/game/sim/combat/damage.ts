import type { DamagePacket, DamageResolution, ShipResources } from '@/game/sim/types';

export function applyDamage(
  resources: ShipResources,
  packet: DamagePacket,
): DamageResolution {
  const amplifiedShieldDamage = packet.amount * packet.shieldMultiplier;
  const appliedShieldDamage = Math.min(resources.shield, amplifiedShieldDamage);
  const remainingDamage = Math.max(0, packet.amount - appliedShieldDamage);
  const appliedHullDamage = Math.min(resources.hull, remainingDamage);
  const nextShield = Math.max(0, resources.shield - appliedShieldDamage);
  const nextHull = Math.max(0, resources.hull - appliedHullDamage);

  return {
    appliedHullDamage,
    appliedShieldDamage,
    destroyed: nextHull <= 0,
    nextResources: {
      ...resources,
      hull: nextHull,
      shield: nextShield,
      shieldRegenTimeoutSeconds: resources.shieldRegenDelaySeconds,
      stagger: Math.min(resources.staggerMax, resources.stagger + packet.stagger),
    },
  };
}
