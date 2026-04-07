import { describe, expect, it } from 'vitest';
import { getChaseCameraPose } from '@/game/shared/chaseCamera';

describe('getChaseCameraPose', () => {
  it('keeps the camera on the right shoulder and moves it closer during ADS', () => {
    const ship = {
      pitchRadians: 0,
      yawRadians: Math.PI,
    };

    const hipPose = getChaseCameraPose(ship, 0, 0);
    const adsPose = getChaseCameraPose(ship, 0, 1);

    expect(hipPose.position.x).toBeGreaterThan(0);
    expect(adsPose.position.x).toBeGreaterThan(0);
    expect(Math.abs(adsPose.position.z)).toBeLessThan(Math.abs(hipPose.position.z));
    expect(Math.abs(adsPose.position.x)).toBeLessThan(Math.abs(hipPose.position.x));
    expect(adsPose.position.y).toBeLessThan(hipPose.position.y);
  });
});
