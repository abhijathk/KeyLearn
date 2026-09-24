/** Apparent size relative to the road, for the fixed orthographic camera. */
export function depthScale(z: number, eye: number, laneZ = 0): number {
  const distance = Math.max(1, eye - z);
  const laneDistance = Math.max(1, eye - laneZ);
  return 1 - 0.7 * (1 - laneDistance / distance);
}
