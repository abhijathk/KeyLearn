/**
 * WHERE KUTTICHATHAN GOES AND WHAT HE DOES THERE.
 *
 * Its own module for the same reason as `stone-x.ts`: this is a catalogue and
 * a state machine with no scene, no renderer and no DOM behind it, and the
 * part that decides whether he reads as a spirit or as a character on a timer
 * is exactly the part worth testing.
 *
 * He is not scenery and he is not a villager. A villager stands where it was
 * put and idles; an animal has a field and a mind about the child crossing it.
 * He has neither — he has HAUNTS, and a haunt is a place with a reason. The
 * folklore is specific about which places those are, and the village already
 * has every one of them standing in it: the banyan and the peepal he lives in,
 * the well he hides down, the lamp at the shrine he is drawn to and cannot
 * leave alone, the wall he watches the road from, and the great house whose
 * roof the stones land on out of a clear evening.
 *
 * So the routines below are not a shuffled clip list. Each one is something a
 * particular place makes sense of, and the place it belongs to is named on it.
 */

/**
 * A clip's name in the shipped file, and what it costs in seconds.
 *
 * Durations are the authored ones, measured off the GLB rather than typed
 * from the brief — `kuttichathan.test.ts` checks the table against
 * `Kuttichathan_clips.json`, so a retimed clip cannot quietly leave this
 * table saying the old number and a routine budgeting against it.
 */
export type ClipFact = {
  readonly seconds: number;
  readonly loop: boolean;
  /**
   * The pose the clip begins and ends in.
   *
   * This is the whole reason `routineIsSound` exists. Every clip was authored
   * from a known standing, squatting or perched pose, and playing a squat idle
   * straight into a run does not blend — it pops, because there is no path
   * between a pelvis at 0.25 and one at 0.47 for a crossfade to take. The
   * enter/exit clips are what carry a body between poses, and a routine that
   * skips them is a bug whether or not anybody notices it on the road.
   */
  readonly from: Pose;
  readonly to: Pose;
};

/** The body states the clips actually begin and end in. */
export type Pose =
  | "stand"
  | "squat" // the deep signature squat, pelvis between the heels
  | "perch" // balanced on a wall top or a rock
  | "gone"; // the dust heap, held still for the VFX

/**
 * EVERY CLIP HE HAS, AND WHAT EACH ONE IS FOR.
 *
 * The six climb and vault clips came with the rigged model and are kept
 * because the village has walls: nothing else in his own set gets him onto
 * one. They carry no `from`/`to` of their own that was authored to match his,
 * so they are marked by what they plainly do.
 */
export const CLIPS: ReadonlyMap<string, ClipFact> = new Map([
  [
    "kutti_01_mischievous_idle",
    { seconds: 6.0, loop: true, from: "stand", to: "stand" },
  ],
  [
    "kutti_02_alert_idle",
    { seconds: 5.0, loop: true, from: "stand", to: "stand" },
  ],
  [
    "kutti_03_natural_walk",
    { seconds: 5.0, loop: true, from: "stand", to: "stand" },
  ],
  [
    "kutti_04_sneaky_walk",
    { seconds: 5.0, loop: true, from: "stand", to: "stand" },
  ],
  [
    "kutti_05_scampering_run",
    { seconds: 4.0, loop: true, from: "stand", to: "stand" },
  ],
  [
    "kutti_06_squat_enter",
    { seconds: 2.0, loop: false, from: "stand", to: "squat" },
  ],
  [
    "kutti_07_squat_idle",
    { seconds: 6.0, loop: true, from: "squat", to: "squat" },
  ],
  [
    "kutti_08_squat_exit",
    { seconds: 2.0, loop: false, from: "squat", to: "stand" },
  ],
  [
    "kutti_09_vanish_standing",
    { seconds: 1.0, loop: false, from: "stand", to: "gone" },
  ],
  [
    "kutti_10_reappear_standing",
    { seconds: 1.4, loop: false, from: "gone", to: "stand" },
  ],
  [
    "kutti_11_vanish_from_squat",
    { seconds: 1.0, loop: false, from: "squat", to: "gone" },
  ],
  [
    "kutti_12_reappear_into_squat",
    { seconds: 1.2, loop: false, from: "gone", to: "squat" },
  ],
  [
    "kutti_13_trickster_laugh",
    { seconds: 4.0, loop: false, from: "stand", to: "stand" },
  ],
  ["kutti_14_taunt", { seconds: 4.0, loop: false, from: "stand", to: "stand" }],
  [
    "kutti_15_peek_left",
    { seconds: 3.0, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_16_peek_right",
    { seconds: 3.0, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_17_pick_up_and_throw_stone",
    { seconds: 4.25, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_19_dodge_left",
    { seconds: 1.2, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_20_dodge_right",
    { seconds: 1.2, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_21_mischief_hop",
    { seconds: 2.0, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_22_perched_crouch",
    { seconds: 5.0, loop: true, from: "perch", to: "perch" },
  ],
  [
    "kutti_23_jump_down",
    { seconds: 2.0, loop: false, from: "perch", to: "stand" },
  ],
  [
    "kutti_24_hear_something",
    { seconds: 2.0, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_25_light_hit",
    { seconds: 2.0, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_26_turn_left_90",
    { seconds: 1.2, loop: false, from: "stand", to: "stand" },
  ],
  [
    "kutti_27_turn_right_90",
    { seconds: 1.2, loop: false, from: "stand", to: "stand" },
  ],
  // Came with the rig. The only way onto a wall he has.
  [
    "climbing_up_wall",
    { seconds: 2.0, loop: false, from: "stand", to: "perch" },
  ],
  [
    "Vault_and_Land",
    { seconds: 3.07, loop: false, from: "stand", to: "stand" },
  ],
  [
    "Dive_Down_and_Land_2",
    { seconds: 3.1, loop: false, from: "perch", to: "stand" },
  ],
]);

/**
 * THE ONE CLIP DELIBERATELY LEFT OUT OF EVERY ROUTINE.
 *
 * `light_hit` is a reaction to being hit, and nothing on an empty road hits
 * him. Giving it to an ambient routine would mean inventing an attacker to
 * justify it, which is the opposite of what these routines are for. It is
 * held for what he does when he notices the child — a separate question, and
 * one worth answering on its own rather than by finding a slot for a clip.
 */
export const RESERVED_CLIPS: ReadonlySet<string> = new Set([
  "kutti_25_light_hit",
]);

/**
 * A PLACE WITH A REASON.
 *
 * Nothing here is a spot on the road: each is a thing the village actually
 * builds, matched by the model that builds it. `road` is the exception and
 * names the absence — where he is between two haunts, which is the only time
 * he is out in the open.
 */
export type Haunt = "tree" | "wall" | "well" | "lamp" | "house" | "road";

/**
 * Which models anchor which haunt.
 *
 * Matched against `placements()` output, so these are the file names the
 * chapters actually write, and a haunt with nothing standing for it in a
 * chapter simply produces no anchors there rather than a hole to handle.
 *
 * The peepal and the banyan are one haunt and not two: both are his tree in
 * the folklore, both are planted by the chapters, and a child does not need
 * to know which is which to understand that he came out of it.
 */
export const HAUNT_MODELS: ReadonlyMap<Haunt, readonly RegExp[]> = new Map([
  ["tree", [/Banyan_Almaram/i, /Peepal_Arayal/i]],
  ["wall", [/Laterite_Wall/i]],
  ["well", [/Village_Well/i]],
  ["lamp", [/Shrine_Idol/i, /Nilavilakku/i, /Petromax_Lamp/i]],
  [
    "house",
    [
      /(?:^|\/)Mana$/i,
      /ManaPortico/i,
      /HouseThatch/i,
      /HouseHearth/i,
      /HouseMoss/i,
    ],
  ],
]);

/** When a routine is allowed to run. */
export type When =
  /** Only after dark. The bold things: stones on a roof, laughing out loud. */
  | "night"
  /** Any hour, but he is twice as likely to pick it after dark. */
  | "prefers-night"
  /** Any hour. The shy things — a look round a trunk, and gone. */
  | "any";

export type Routine = {
  readonly id: string;
  readonly haunt: Haunt;
  /** Clip names in order. Loops are held for `holds[i]` seconds. */
  readonly beats: readonly string[];
  /**
   * How long each LOOPING beat is held, in seconds. One entry per beat; the
   * entry for a one-shot is ignored, because a one-shot is as long as it is.
   */
  readonly holds: readonly number[];
  readonly when: When;
  /**
   * WHERE HE COMES BACK, when this routine has a vanish in it.
   *
   * The dust is the only moment he can be moved — it is the one piece of
   * travel a child sees the ends of and not the middle — and until now that
   * was a note in the code rather than something that happened. Left unset he
   * comes back exactly where he went, which is right for a taunt and wrong
   * for a spirit.
   *
   *   "haunt"         another spot in the corridor, chosen at random
   *   "behind-child"  out of the ground behind the walking group
   *
   * `behind-child` is the one place he is not a creature of a PLACE, and it is
   * deliberately rare for that reason: a spirit that turns up behind you every
   * time has stopped haunting the road and started following you.
   */
  readonly moves?: "haunt" | "behind-child";
  /**
   * Beats that actually release a stone, by index, and where it goes.
   *
   * `kutti_17_pick_up_and_throw_stone` is one clip whether he is aiming at a
   * roof or at the children, so the target cannot be read off the animation.
   *
   *   "roof"   onto the great house, which is the story everyone knows
   *   "short"  toward the children and DELIBERATELY SHORT - it skitters across
   *            the road at their feet. Aimed, unmistakably; never a hit. The
   *            kids ship without any reaction clip at all, and `world.ts`
   *            refuses to depict something striking a child.
   */
  readonly throws?: {
    readonly beats: readonly number[];
    readonly at: "roof" | "short";
  };
  /**
   * HE DOES THIS ON TOP OF THE THING, not beside it.
   *
   * Only meaningful on a haunt the chapter gives a height to — a house. The
   * world lifts him to the roof for the beats he is in the perch pose for and
   * puts him back on the ground when he comes off it, so `jump_down` is a real
   * drop rather than a clip played at ankle height.
   */
  readonly onRoof?: boolean;
  /**
   * HOW LONG HE STAYS GONE, in seconds, after each beat.
   *
   * A vanish runs 1.0s and a reappear 1.4s, and `isGone` only counts the last
   * fifth of one and the first fifth of the other — so a routine that puts
   * them back to back leaves him absent for FOUR TENTHS OF A SECOND. He
   * disappears and is already back, which reads as a glitch rather than as
   * going into the ground.
   *
   * The gap extends the beat it follows rather than becoming a beat of its
   * own: the vanish clip has clamped on its last frame by then, `isGone` is
   * already true, and it simply stays true. Nothing else has to know.
   */
  readonly gaps?: readonly number[];
  /**
   * What the routine is, in the words someone reading the road would use.
   * Carried because a routine that cannot be described in one line is usually
   * a clip list wearing a name.
   */
  readonly says: string;
};

/**
 * WHAT HE DOES, PLACE BY PLACE.
 *
 * Read these as scenes rather than as sequences. Each one starts standing and
 * ends standing — see `routineIsSound` — so any routine can follow any other
 * without a pose to reconcile, and the enter/exit clips are present wherever
 * the body actually changes state rather than being skipped to save a beat.
 */
export const ROUTINES: readonly Routine[] = [
  // ── HIS TREE ────────────────────────────────────────────────────────
  //
  // Where he is when he is not doing anything to anybody. The long squat is
  // the point: it is the pose the character is known for, and holding it for
  // most of a minute at the foot of a banyan is what makes the tree his.
  {
    id: "tree-settle",
    haunt: "tree",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
      "kutti_01_mischievous_idle",
    ],
    holds: [3.4, 0, 22, 0, 8],
    when: "any",
    says: "creeps up to his tree, settles into the squat, sits a while, gets up",
  },
  {
    // The one that makes him a spirit rather than a boy: he goes INTO the
    // tree. The vanish and reappear are both from the squat, so the pose he
    // leaves in is the pose he comes back in, and the world can move him
    // between two trees while nothing is visible.
    id: "tree-vanish",
    haunt: "tree",
    beats: [
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_11_vanish_from_squat",
      "kutti_12_reappear_into_squat",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
    ],
    holds: [0, 14, 0, 0, 10, 0],
    when: "prefers-night",
    says: "sits under the tree, goes into it, comes out of another one",
  },
  {
    id: "tree-peek",
    haunt: "tree",
    beats: [
      "kutti_15_peek_left",
      "kutti_02_alert_idle",
      "kutti_16_peek_right",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
    ],
    holds: [0, 4, 0, 0, 0],
    when: "any",
    says: "looks round the trunk one way, then the other, then is not there",
  },

  // ── THE WALL ────────────────────────────────────────────────────────
  //
  // A laterite wall is the one thing in the village he can get on top of, and
  // the climb is the only clip he has that gets him there. Everything he does
  // up there is watching; the way down is a jump, never a climb.
  {
    id: "wall-watch",
    haunt: "wall",
    beats: [
      "kutti_04_sneaky_walk",
      "climbing_up_wall",
      "kutti_22_perched_crouch",
      "kutti_23_jump_down",
      "kutti_02_alert_idle",
      "kutti_05_scampering_run",
    ],
    holds: [2.6, 0, 18, 0, 3, 2.4],
    when: "prefers-night",
    says: "climbs the wall, crouches on it watching the road, drops off and runs",
  },
  {
    // The climb is here for the same reason it is in `wall-watch` and not
    // because the routine wants a sixth beat: he cannot be found already on
    // the wall. Every routine starts standing on the ground, because that is
    // the only pose the world can hand him over in.
    id: "wall-startled",
    haunt: "wall",
    beats: [
      "climbing_up_wall",
      "kutti_22_perched_crouch",
      "kutti_23_jump_down",
      "kutti_19_dodge_left",
      "kutti_05_scampering_run",
    ],
    // The startle itself is IN the perch. `hear_something` was written for a
    // body standing on the ground and there is no version of it up on a wall;
    // the perched crouch already scans and reacts, and a drop that comes out
    // of the middle of that scanning reads as having heard something without
    // needing a clip that says so.
    holds: [0, 9, 0, 0, 3.2],
    when: "any",
    says: "up on the wall, drops off it mid-scan, dodges and goes",
  },

  // ── THE WELL ────────────────────────────────────────────────────────
  //
  // He goes down it. The vanish ends as a heap on the ground with the VFX
  // taking over, which is exactly what going down a well looks like from the
  // outside, and it is the reason the vanish was authored as a collapse into
  // the earth rather than a fade.
  {
    id: "well-hide",
    haunt: "well",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_16_peek_right",
      "kutti_15_peek_left",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
      "kutti_21_mischief_hop",
    ],
    holds: [3.0, 0, 0, 0, 0, 0],
    when: "any",
    says: "creeps to the well, checks both ways, drops into it, comes back up pleased",
  },

  // ── THE LAMP ────────────────────────────────────────────────────────
  //
  // The shrine lamp and the petromax are the only lit things on the road
  // after dark, and he cannot leave a light alone. He never touches it — he
  // has no clip that would — he sits in front of it, which is worse.
  {
    id: "lamp-watch",
    haunt: "lamp",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
      "kutti_24_hear_something",
      "kutti_05_scampering_run",
    ],
    holds: [3.6, 0, 16, 0, 0, 2.6],
    when: "night",
    says: "creeps up to the lamp, squats in front of it, is caught at it and bolts",
  },

  // ── THE GREAT HOUSE ─────────────────────────────────────────────────
  //
  // The story everyone who knows the name knows: stones landing on a roof
  // out of an empty evening, and nobody in the yard. It is one clip, because
  // picking the stone up and throwing it is one action, and the laugh after
  // it lands is what says the stone was not an accident.
  {
    id: "house-stones",
    haunt: "house",
    beats: [
      "kutti_02_alert_idle",
      "kutti_17_pick_up_and_throw_stone",
      "kutti_13_trickster_laugh",
      "kutti_17_pick_up_and_throw_stone",
      "kutti_21_mischief_hop",
      "kutti_05_scampering_run",
    ],
    holds: [3.2, 0, 0, 0, 0, 3.0],
    when: "night",
    throws: { beats: [1, 3], at: "roof" },
    says: "throws a stone on the roof, laughs, throws another, and is gone",
  },
  {
    id: "house-taunt",
    haunt: "house",
    beats: [
      "kutti_14_taunt",
      "kutti_13_trickster_laugh",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
    ],
    holds: [0, 0, 0, 0],
    // He is not in the yard any more, and it takes a moment to notice.
    gaps: [0, 0, 3.0, 0],
    when: "night",
    moves: "haunt",
    says: "taunts the house, laughs at it, and vanishes before anyone comes out",
  },

  // ── THE OPEN ROAD ───────────────────────────────────────────────────
  //
  // Only ever between two haunts, and only ever briefly: the turns are here
  // because a spirit crossing a road changes its mind about where it was
  // going, and a character that only ever walks in straight lines does not.
  // ── THE ONE THAT IS NOT ABOUT A PLACE ───────────────────────────────
  //
  // He goes into the ground wherever he is and comes out BEHIND the walking
  // group, laughs at their backs, and strolls away. The children never see
  // him: the camera sits behind them, so reappearing behind them puts him
  // between the player and the children — large, lit, and facing a pair of
  // backs. The player knows he is there and they do not, which is the best
  // staging this character gets and costs no reaction clip.
  //
  // Held out of the ordinary pool and spent rarely. See `moves`.
  {
    id: "road-behind",
    haunt: "road",
    beats: [
      // SEEN FIRST, on the right of the picture and out on the road. This
      // routine used to open on the vanish, so the first thing that ever
      // happened was a figure disappearing — and a child cannot register
      // something going if they never saw it there.
      "kutti_02_alert_idle",
      "kutti_17_pick_up_and_throw_stone",
      "kutti_13_trickster_laugh",
      // Then gone, and the world moves him to the LEFT while nothing is
      // visible. The whole point of the beat is that he crosses the scene
      // without crossing it.
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
      "kutti_13_trickster_laugh",
      "kutti_14_taunt",
      "kutti_01_mischievous_idle",
      "kutti_15_peek_left",
      "kutti_03_natural_walk",
    ],
    // HE STAYS. Cut to a laugh and a walk this was over in about ten seconds,
    // and a child who has deliberately sat down to watch the road had barely
    // registered him before he was gone.
    //
    // He can afford to linger precisely BECAUSE they cannot see him: he is
    // behind their backs, so laughing, then taunting, then simply standing
    // there enjoying himself for ten seconds is not him waiting to be noticed
    // — it is him getting away with it. The peek before he leaves is the one
    // beat that admits he knows exactly where they are.
    //
    // Visible for about twenty-eight seconds, against ten.
    holds: [3.5, 0, 0, 0, 0, 0, 0, 10, 0, 6],
    // Gone for two and a half seconds between going in and coming out. Long
    // enough that the road is empty and they have stopped looking at where he
    // was, which is the whole trick.
    gaps: [0, 0, 0, 2.5, 0, 0, 0, 0, 0, 0],
    when: "prefers-night",
    moves: "behind-child",
    throws: { beats: [1], at: "short" },
    says: "vanishes, steps out of the ground behind them, laughs, walks away",
  },

  // ── ON THE ROOF ─────────────────────────────────────────────────────
  //
  // Sat on the front slope facing the road, which is where the story puts
  // him: the stones land on a roof and when anybody finally looks up there is
  // something on it. The long hold is the whole routine — he is not doing
  // anything up there, and that is the point.
  //
  // `climbing_up_wall` is the only way into the perch pose he owns, so it
  // plays on the roof itself and reads as him clambering up the slope to the
  // ridge. The way down is a drop, never a climb.
  {
    id: "house-roof",
    haunt: "house",
    beats: [
      "climbing_up_wall",
      "kutti_22_perched_crouch",
      "kutti_23_jump_down",
      "kutti_05_scampering_run",
    ],
    holds: [0, 20, 0, 2.6],
    when: "night",
    onRoof: true,
    says: "sits on the front of the roof facing the road, then drops off it",
  },

  // ── ON THE WELL WALL ────────────────────────────────────────────────
  //
  // The picture everybody has of him: a small figure squatting on the round
  // parapet of a village well in the dark, under its little canopy, with his
  // knees up by his ears.
  //
  // No climb in it. The rim is half the well's height — about a unit and a
  // half, which is knee-high on him — and `climbing_up_wall` is authored
  // against a laterite boundary twice that. He is simply there when the beat
  // starts, which is also the more unsettling of the two: a thing that has to
  // climb somewhere got there, and a thing that is just sitting on your well
  // did not.
  //
  // He leaves by going into the ground rather than by getting down, because
  // there is no clip for stepping off a low wall and because dissolving off
  // the rim is better anyway. `moves` then brings him up somewhere along the
  // road, which is where the world puts his lift back to zero.
  {
    id: "well-sit",
    haunt: "well",
    beats: [
      "kutti_02_alert_idle",
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
      "kutti_13_trickster_laugh",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
      "kutti_05_scampering_run",
    ],
    holds: [2.6, 0, 13, 0, 0, 0, 0, 2.8],
    gaps: [0, 0, 0, 0, 0, 1.7, 0, 0],
    when: "night",
    onRoof: true,
    moves: "haunt",
    says: "sits on the well wall, laughs, and goes into the ground off it",
  },

  // ── STONES FROM THE WALL ────────────────────────────────────────────
  //
  // He throws from BESIDE the wall, not from on top of it: the throw is
  // authored standing and there is no version of it crouched, so a perched
  // throw would be a stand-up clip played on a body that is kneeling. He
  // climbs afterwards instead, which also reads better - throw, then get up
  // out of reach to watch what happens.
  {
    id: "wall-stones",
    haunt: "wall",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_17_pick_up_and_throw_stone",
      "kutti_13_trickster_laugh",
      "climbing_up_wall",
      "kutti_22_perched_crouch",
      "kutti_23_jump_down",
      "kutti_05_scampering_run",
    ],
    holds: [2.2, 0, 0, 0, 7, 0, 2.6],
    when: "night",
    throws: { beats: [1], at: "short" },
    says: "throws a stone across the road at them, laughs, and climbs out of reach",
  },

  {
    id: "road-cross",
    haunt: "road",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_26_turn_left_90",
      "kutti_04_sneaky_walk",
      "kutti_27_turn_right_90",
      "kutti_03_natural_walk",
    ],
    holds: [3.2, 0, 2.4, 0, 3.0],
    when: "any",
    says: "crosses, changes his mind twice on the way",
  },

  // ── THE SQUAT, OUT IN THE OPEN ──────────────────────────────────────
  //
  // His signature pose, and until now it only ever happened under a tree or
  // beside a lamp — two haunts out of six, on a corridor where he mostly ends
  // up on the road. The squat vanish and the squat reappearance had it worse
  // still: ONE routine in the whole table used them, `tree-vanish`, so a
  // session that never put him under a banyan never saw either clip.
  //
  // Out in the middle of the road there is nothing to explain him — no trunk
  // to be beside, no lamp to be drawn to — so the pose has to carry it, which
  // is exactly what a signature pose is for. He drops into it, sits there long
  // enough to be looked at, goes into the ground from it without standing up
  // first, and comes back up out of the ground already squatting somewhere
  // else down the road. Going in and coming out in the same pose is what makes
  // the two ends read as one move rather than as two disappearances.
  {
    id: "road-squat",
    haunt: "road",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_11_vanish_from_squat",
      "kutti_12_reappear_into_squat",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
      "kutti_13_trickster_laugh",
      "kutti_05_scampering_run",
    ],
    holds: [2.4, 0, 8, 0, 0, 7, 0, 0, 2.6],
    // Gone for the best part of two seconds between the two, which is what
    // makes the reappearance a reappearance: long enough that the road is
    // empty and the eye has left the place he was.
    gaps: [0, 0, 0, 1.8, 0, 0, 0, 0, 0],
    when: "prefers-night",
    moves: "haunt",
    says: "squats in the road, drops into the ground, comes up squatting elsewhere",
  },

  // ── THE SQUAT AT THE WALL, AND THE STANDING VANISH ──────────────────
  //
  // The standing pair had the opposite problem to the squat pair: plenty of
  // routines vanish, but almost all of them vanish as the LAST thing they do,
  // where it is an exit rather than a trick. Here it is in the middle — he
  // settles by the wall, stands up out of it, goes, comes back standing, and
  // laughs — so both halves are seen and neither is the end of him.
  {
    id: "wall-squat",
    haunt: "wall",
    beats: [
      "kutti_04_sneaky_walk",
      "kutti_06_squat_enter",
      "kutti_07_squat_idle",
      "kutti_08_squat_exit",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
      "kutti_13_trickster_laugh",
      "kutti_05_scampering_run",
    ],
    holds: [2.2, 0, 9, 0, 0, 0, 0, 2.8],
    gaps: [0, 0, 0, 0, 2.2, 0, 0, 0],
    when: "prefers-night",
    moves: "haunt",
    says: "squats by the wall, stands, goes into the ground and comes back up",
  },

  // ── STONES FROM THE ROAD ITSELF ─────────────────────────────────────
  //
  // The road is where he most often is, and until now not one road routine
  // threw anything: the three that did were all at a house or a wall, which
  // between them are a minority of the haunts in any lesson. So the stones
  // asked for could only ever arrive on the minority of nights when the
  // corridor happened to put him beside masonry.
  //
  // Stood in the open to do it, which is the cheeky version — no wall to duck
  // behind and no roof to be out of reach on, just a small boy in the middle
  // of the road throwing stones at you and laughing. He turns away to leave
  // rather than vanishing, so the road keeps one exit that is not magic.
  {
    id: "road-stones",
    haunt: "road",
    beats: [
      "kutti_02_alert_idle",
      "kutti_17_pick_up_and_throw_stone",
      "kutti_13_trickster_laugh",
      // A SECOND THROW IS A SECOND CLIP. A burst of three stones out of one
      // play of a four-second pick-up-and-throw is one arm motion firing a
      // machine gun; the animation is the throw, so the number of stones is
      // the number of times it runs.
      "kutti_17_pick_up_and_throw_stone",
      "kutti_21_mischief_hop",
      "kutti_05_scampering_run",
    ],
    holds: [2.4, 0, 0, 0, 0, 2.8],
    when: "prefers-night",
    throws: { beats: [1, 3], at: "short" },
    says: "stands in the road, throws stones at them, laughs, and scampers off",
  },
  {
    id: "road-startled",
    haunt: "road",
    beats: [
      "kutti_24_hear_something",
      "kutti_20_dodge_right",
      "kutti_09_vanish_standing",
      "kutti_10_reappear_standing",
      "kutti_05_scampering_run",
    ],
    holds: [0, 0, 0, 0, 2.6],
    when: "any",
    says: "caught in the open, dodges, vanishes and reappears running",
  },
];

/**
 * Is this routine playable as written?
 *
 * Three things, each of which has a way of going wrong that nobody spots on
 * the road until it has been there a week:
 *
 * 1. Every clip named exists. A typo produces a beat that silently does
 *    nothing, which reads as a pause rather than as a fault.
 * 2. The poses join up. A squat idle followed by a run is a pop no crossfade
 *    can hide — see `ClipFact.from`.
 * 3. He is never left invisible. `gone` is a held pose for a VFX handoff, so
 *    a routine that ends there leaves a dust heap on the road until something
 *    else happens to it.
 */
export function routineIsSound(r: Routine): string | null {
  if (r.beats.length === 0) return `${r.id}: no beats`;
  if (r.beats.length !== r.holds.length) {
    return `${r.id}: ${r.beats.length} beats but ${r.holds.length} holds`;
  }
  let pose: Pose = "stand";
  for (const [i, name] of r.beats.entries()) {
    const c = CLIPS.get(name);
    if (c == null) return `${r.id}: no clip called ${name}`;
    if (c.from !== pose) {
      return `${r.id}: beat ${i} (${name}) starts ${c.from} but he is ${pose}`;
    }
    pose = c.to;
  }
  if (pose !== "stand") return `${r.id}: ends ${pose}, not standing`;
  return null;
}

/** How long a routine takes, holds included. */
export function routineSeconds(r: Routine): number {
  return r.beats.reduce((sum, name, i) => {
    const c = CLIPS.get(name)!;
    return (
      sum +
      (c.loop ? Math.max(c.seconds, r.holds[i]!) : c.seconds) +
      (r.gaps?.[i] ?? 0)
    );
  }, 0);
}

/** Anything placed that anchors a haunt, with the haunt it anchors. */
export type Anchor = {
  readonly haunt: Haunt;
  readonly x: number;
  readonly z: number;
  readonly model: string;
  /**
   * How tall and how deep the thing is, where the chapter says so.
   *
   * Carried for ONE reason: a roof. Standing him beside a house needs nothing
   * but the position, but putting him on top of it needs to know where the top
   * is, and the chapter already writes both numbers for every building it
   * stands up. Undefined for a tree or a lamp, which have no roof to sit on.
   */
  readonly h?: number;
  readonly depth?: number;
};

/**
 * Which of the things this chapter stands up are places he would go.
 *
 * Takes `placements()` output rather than the chapter, so it cannot fall out
 * of step with what is actually built — the same reasoning that puts the
 * shrine's worn ground where the shrine really is rather than where a second
 * table says it should be.
 */
export function anchorsFrom(
  placed: readonly {
    readonly model: string;
    readonly x: number;
    readonly z: number;
    readonly h?: number;
    readonly depth?: number;
  }[],
): readonly Anchor[] {
  const out: Anchor[] = [];
  for (const p of placed) {
    for (const [haunt, tests] of HAUNT_MODELS) {
      if (tests.some((t) => t.test(p.model))) {
        out.push({
          haunt,
          x: p.x,
          z: p.z,
          model: p.model,
          h: p.h,
          depth: p.depth,
        });
        break;
      }
    }
  }
  return out;
}

/**
 * A HAUNT IS NOT A CROWD.
 *
 * Chapter 1 writes its estate boundary as twelve panels of laterite wall, and
 * every panel is a separate placement. Left alone that is twelve wall haunts
 * in a row and a spirit who climbs one, drops off it, walks four metres and
 * climbs the next — which is a character on a loop, not a haunting.
 *
 * So anchors of the same kind standing within `gap` of each other along the
 * road count as ONE place, kept at the first of them.
 */
export function thinAnchors(
  anchors: readonly Anchor[],
  gap = 14,
): readonly Anchor[] {
  const kept: Anchor[] = [];
  for (const a of [...anchors].sort((p, q) => p.x - q.x)) {
    const near = kept.some(
      (k) => k.haunt === a.haunt && Math.abs(k.x - a.x) < gap,
    );
    if (!near) kept.push(a);
  }
  return kept;
}

/**
 * Which routines this place and this hour allow.
 *
 * Returns them in the table's own order; the caller picks. Deterministic on
 * purpose — the world seeds its own choice from the anchor's position, the
 * same way everything else in the chapter is placed, so the same tree does
 * not do something different every time the page is reloaded.
 */
export function routinesFor(haunt: Haunt, night: boolean): readonly Routine[] {
  return ROUTINES.filter(
    (r) => r.haunt === haunt && (r.when !== "night" || night),
  );
}

/**
 * Pick one, leaning towards the after-dark routines after dark.
 *
 * `roll` is a caller-supplied 0..1 — the world passes a value derived from
 * where the anchor stands, so the choice is a fact about the place rather
 * than about the moment the page happened to load.
 */
export function chooseRoutine(
  haunt: Haunt,
  night: boolean,
  roll: number,
): Routine | null {
  const pool = routinesFor(haunt, night);
  if (pool.length === 0) return null;
  // After dark the mischief is the point, so the routines that actually DO
  // something to the children carry more of the weight than the ones where he
  // is only present. Without this a haunt that can throw threw on a third of
  // its visits at best, which — against how seldom a routine runs at all — is
  // most of a session with no stone in it.
  const weights = pool.map(
    (r) =>
      (night && r.when === "prefers-night" ? 2 : 1) *
      (night && r.throws != null ? 1.8 : 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let t = Math.min(0.999999, Math.max(0, roll)) * total;
  for (const [i, w] of weights.entries()) {
    if (t < w) return pool[i]!;
    t -= w;
  }
  return pool[pool.length - 1]!;
}

/** Where a routine has got to, `elapsed` seconds in. */
export type BeatAt = {
  readonly index: number;
  readonly clip: string;
  /** Seconds since this beat began. */
  readonly into: number;
  /** How long this beat runs in total. */
  readonly length: number;
  readonly done: boolean;
};

/**
 * Which beat is playing, and how far into it.
 *
 * The world ticks with a clock rather than being told when a clip ends: an
 * action that never fires its finished event — because the tab was hidden,
 * or because the mixer was paused mid-fade — would otherwise strand him
 * mid-routine forever. See `kids-hidden-tab-stalls-build`: the same failure
 * already cost this page a whole build once.
 */
export function beatAt(r: Routine, elapsed: number): BeatAt {
  let t = Math.max(0, elapsed);
  for (const [i, name] of r.beats.entries()) {
    const c = CLIPS.get(name)!;
    const len =
      (c.loop ? Math.max(c.seconds, r.holds[i]!) : c.seconds) +
      (r.gaps?.[i] ?? 0);
    if (t < len || i === r.beats.length - 1) {
      return {
        index: i,
        clip: name,
        into: t,
        length: len,
        done: i === r.beats.length - 1 && t >= len,
      };
    }
    t -= len;
  }
  const last = r.beats.length - 1;
  return {
    index: last,
    clip: r.beats[last]!,
    into: 0,
    length: 0,
    done: true,
  };
}

/**
 * Is he visible right now?
 *
 * `gone` is the held dust pose. The world hides the model and runs the VFX
 * across it rather than leaving a heap lying in the lane, and this is the one
 * question it has to ask every frame to know which.
 */
export function isGone(r: Routine, elapsed: number): boolean {
  const at = beatAt(r, elapsed);
  const c = CLIPS.get(at.clip)!;
  // The vanish has BECOME gone only once it has played out; the reappear is
  // gone at its first frame and not after. Asking the clip rather than the
  // beat index is what keeps that true when a routine is reordered.
  if (c.to === "gone") return at.into >= c.seconds * 0.82;
  if (c.from === "gone") return at.into < c.seconds * 0.18;
  return false;
}
