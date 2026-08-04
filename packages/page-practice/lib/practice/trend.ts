/**
 * Whether recent lessons are actually going anywhere.
 *
 * The recap used to answer this with `last.speed - first.speed` — two endpoint
 * samples out of a twenty-lesson window, against a fixed half-a-unit
 * threshold. Typing speed swings by several units from lesson to lesson for
 * reasons that have nothing to do with skill, so a single noisy round at
 * either end flipped the verdict, and a learner watching the label saw
 * "improving" and "slight dip" alternate while nothing about them changed.
 *
 * This fits a line through the whole window and asks whether the slope is
 * distinguishable from no slope at all, using the slope's own standard error.
 * When it is not — which is most of the time, and correctly so — the answer is
 * "steady". Saying "steady" when the evidence is thin is honest; picking a
 * direction from noise is not, and it is worse than saying nothing because the
 * learner believes it.
 */

export type Trend = "improving" | "steady" | "dip";

/**
 * Lessons needed before a direction is claimed at all.
 *
 * Two points always fit a line perfectly, so a slope from a handful of rounds
 * carries no information about whether it is real.
 */
const MIN_LESSONS = 6;

/**
 * How many standard errors the slope must clear.
 *
 * Two is the usual "unlikely to be chance" bar. It is deliberately not tuned
 * down to make the label appear more often: an encouraging word that shows up
 * at random is not encouraging, it is noise the learner learns to ignore.
 */
const SIGMA = 2;

export function speedTrend(speeds: readonly number[]): Trend {
  const n = speeds.length;
  if (n < MIN_LESSONS) {
    return "steady";
  }
  // Least squares against lesson index.
  const meanX = (n - 1) / 2;
  const meanY = speeds.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    sxx += dx * dx;
    sxy += dx * (speeds[i] - meanY);
  }
  if (sxx === 0) {
    return "steady";
  }
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // How much of the movement the line failed to explain — the noise the slope
  // has to be louder than.
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const err = speeds[i] - (intercept + slope * i);
    residual += err * err;
  }
  // A perfect fit has no uncertainty, so any non-zero slope is real.
  const standardError = Math.sqrt(residual / (n - 2) / sxx);
  if (standardError === 0) {
    return slope > 0 ? "improving" : slope < 0 ? "dip" : "steady";
  }
  const t = slope / standardError;
  return t >= SIGMA ? "improving" : t <= -SIGMA ? "dip" : "steady";
}
