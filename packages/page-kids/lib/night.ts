import { type AgeBand } from "./age.ts";

/**
 * Night on the Hero Trail.
 *
 * Day and night are meant to feel like two different games on the same road:
 * by day the party is walking home and everything is pleasant; after dark the
 * walking stops and the watch begins — mist on the ground, lanterns, and the
 * Lost Travellers out on the trail.
 *
 * The Lost Travellers are the whole tone of the night, so their rule is stated
 * here where every piece of night code can see it: they are old travellers who
 * never made it home. They are not hostile and they are not hunting — they are
 * lost, a little envious, and mostly curious about the small warm party going
 * past. They wave. They watch. They NEVER approach, never chase, and nothing
 * after dark ever threatens the hero or makes a sudden sound. "They're sad,
 * not scary" is a floor a five-year-old can stand on.
 */
export type NightStyle =
  /**
   * The calm end of a day's walking: moon, stars, fireflies, lanterns, soft
   * mist, friends close by. No Lost Travellers at all. This is not a lesser
   * night — it is its own lovely thing, and it is the only night the youngest
   * band ever sees.
   */
  | "quiet"
  /** A few Travellers, far off; eyes in the fog at a distance. */
  | "mild"
  /** The full watch: more of them, thicker mist, closer to the trail. */
  | "full";

/** The grown-up override kept in the toy-box; "auto" follows the age band. */
export type NightOverride = "auto" | NightStyle;

/**
 * Which night this child gets.
 *
 * By age unless a grown-up says otherwise. The band already drives every
 * other difficulty knob on the page, so following it here is consistent — and
 * it means the default can never surprise anyone: a five-year-old who taps the
 * moon button gets a starry evening, not skeletons.
 */
export function resolveNightStyle(
  band: AgeBand,
  override: NightOverride = "auto",
): NightStyle {
  if (override !== "auto") {
    // The override lets a grown-up move a child up or down — but the full
    // night is simply not offered for the youngest band, and enforcing that
    // here rather than only in the settings row means no stale preference or
    // hand-edited storage can reach it either. Five is five, whatever the
    // toy-box was told.
    if (band === "5-6" && override === "full") {
      return "mild";
    }
    return override;
  }
  switch (band) {
    case "5-6":
      return "quiet";
    case "7-8":
      return "mild";
    default:
      return "full";
  }
}

/** What one device can afford. The story reads the same at every tier. */
export type DeviceTier = "low" | "mid" | "high";

/**
 * A guess at the machine, from what the browser will admit.
 *
 * Deliberately coarse and deliberately conservative: this page runs on school
 * Chromebooks and hand-me-down tablets, and a dropped frame costs more than a
 * missing skeleton. Anything unknown counts against the machine, not for it.
 */
export function deviceTier({
  memoryGb,
  cores,
  dpr,
}: {
  /** navigator.deviceMemory — absent on Safari and Firefox. */
  readonly memoryGb?: number;
  /** navigator.hardwareConcurrency. */
  readonly cores?: number;
  /** devicePixelRatio. */
  readonly dpr?: number;
}): DeviceTier {
  const mem = memoryGb ?? 4;
  const cpu = cores ?? 4;
  if (mem <= 2 || cpu <= 2) {
    return "low";
  }
  if (mem >= 8 && cpu >= 8 && (dpr ?? 1) >= 1.5) {
    return "high";
  }
  return "mid";
}

/** Everything the scene builder needs to know about tonight. */
export type NightPlan = {
  /** Lost Travellers out on the trail. Zero on a quiet night, always. */
  readonly travellers: number;
  /** Pairs of distant blinking eyes in the mist. Zero on a quiet night. */
  readonly eyePairs: number;
  /** Fireflies drifting near the trail. The quiet night gets the most. */
  readonly fireflies: number;
  /** Ground-mist opacity, 0..1. */
  readonly mist: number;
  /** How near the trail a Traveller may stand, in world units. */
  readonly keepDistance: number;
  /**
   * Dense stands of bare, leafless trees — the skeleton forest.
   *
   * Groves are clusters of many dead trees along a few stretches of the
   * trail; scatter is the odd lone trunk between them. At night a share of
   * the leafy trees also goes dark (`treeThin`), so the forest itself feels
   * like it has changed and not merely the light on it.
   */
  readonly deadGroves: number;
  readonly deadScatter: number;
  /** Fraction of the leafy day trees hidden after dark, 0..1. */
  readonly treeThin: number;
  /**
   * The share of day companions who turn out to be Lost Travellers by night.
   *
   * The change happens in place: the villager thins to a ghost and a matched
   * skeleton rises exactly where they stood — the same mage, the same spot,
   * a different hour. On the full night everyone ordinary turns; on the mild
   * night about half do; on the quiet night nobody does.
   */
  readonly transformShare: number;
};

/**
 * The plan for one night, from the style and the machine.
 *
 * Two dials, one meaning. The style dial changes what kind of night it is;
 * the tier dial only changes how much of it a device can afford. "They are
 * out there watching" reads the same with two Travellers as with nine, which
 * is why cutting numbers is safe and cutting the mist or the eyes is not —
 * the cheap things carry the atmosphere.
 */
export function nightPlan(style: NightStyle, tier: DeviceTier): NightPlan {
  const scale = tier === "low" ? 0.4 : tier === "mid" ? 0.75 : 1;
  if (style === "quiet") {
    return {
      travellers: 0,
      eyePairs: 0,
      fireflies: Math.max(8, Math.round(24 * scale)),
      mist: 0.3,
      keepDistance: Infinity,
      // A couple of bare trunks read as winter; a dense dead forest reads as
      // spooky, and the quiet night promises there is none of that.
      deadGroves: 0,
      deadScatter: 2,
      treeThin: 0.1,
      transformShare: 0,
    };
  }
  if (style === "mild") {
    return {
      travellers: Math.max(2, Math.round(4 * scale)),
      eyePairs: Math.max(4, Math.round(9 * scale)),
      fireflies: Math.max(6, Math.round(14 * scale)),
      mist: 0.45,
      // Far enough that a Traveller is always something seen, never met.
      keepDistance: 7,
      deadGroves: Math.max(1, Math.round(2 * scale)),
      deadScatter: Math.max(3, Math.round(6 * scale)),
      treeThin: 0.3,
      transformShare: 1,
    };
  }
  return {
    travellers: Math.max(3, Math.round(9 * scale)),
    eyePairs: Math.max(4, Math.round(12 * scale)),
    fireflies: Math.max(6, Math.round(10 * scale)),
    mist: 0.6,
    keepDistance: 4.5,
    deadGroves: Math.max(2, Math.round(4 * scale)),
    deadScatter: Math.max(4, Math.round(10 * scale)),
    treeThin: 0.45,
    transformShare: 1,
  };
}
