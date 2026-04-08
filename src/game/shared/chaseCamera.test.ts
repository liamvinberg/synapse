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

  it('keeps a stable orbit anchor while pitching up and down', () => {
    const steepUpwardShip = {
      pitchRadians: -Math.PI / 4,
      yawRadians: Math.PI,
    };
    const steepDownwardShip = {
      pitchRadians: Math.PI / 4,
      yawRadians: Math.PI,
    };
    const neutralShip = {
      pitchRadians: 0,
      yawRadians: Math.PI,
    };

    const upwardPose = getChaseCameraPose(steepUpwardShip, 0, 0);
    const downwardPose = getChaseCameraPose(steepDownwardShip, 0, 0);
    const neutralPose = getChaseCameraPose(neutralShip, 0, 0);

    expect(Math.abs(upwardPose.position.x)).toBeCloseTo(Math.abs(downwardPose.position.x), 5);
    expect(upwardPose.position.y).toBeLessThan(neutralPose.position.y);
    expect(downwardPose.position.y).toBeGreaterThan(neutralPose.position.y);
    expect(upwardPose.lookTarget.y).toBeGreaterThan(neutralPose.lookTarget.y);
    expect(downwardPose.lookTarget.y).toBeLessThan(neutralPose.lookTarget.y);
  });
});
