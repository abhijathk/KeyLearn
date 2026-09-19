/**
 * CHAPTER 2 — THE OUTER FIELDS. Ten lessons, Milestone 10 to Milestone 20.
 *
 * Chapter 1 was the village itself. This is the land that feeds it: property
 * boundaries, orchard lanes, a roadside shrine, a working clearing, a river,
 * an estate wall, the road the produce travels, and grazing country. Same
 * road, same camera, same milestone family — the reference is explicit that
 * this is a WIDENING rather than a new place, and that nothing about the
 * framing may change.
 *
 * WRITTEN IN THE SAME TERMS AS CHAPTER 1 and read by the same code: three
 * planting layers, a density, a split between the layers, a depth band, fixed
 * props in segment-relative coordinates, a herd list and a folk list. See
 * `chapter1.ts` for what each field means and why.
 *
 * READ DOWN THE `density` COLUMN and the chapter's shape is visible on its
 * own: it opens at 1.2 leaving the village, thickens to 3.2 in the orchard
 * lane, thins through the shrine grove and the clearing, tightens again along
 * the estate wall and the produce route, then opens out to 0.9 across the
 * grazing land and ends at 1.0 on empty meadow. Lesson 20 deliberately
 * echoes Lesson 11 the way Chapter 1's tenth echoed its first.
 *
 * WHERE AN ASSET DOES NOT EXIST, THE SPACE IS LEFT. Four things this chapter
 * asks for have not been made yet — a haystack, a stone idol, a formal estate
 * gate, and stacked baskets and sacks. Each is marked below with what is
 * missing and what is standing in until it arrives. Filling those holes with
 * whatever happens to be in the folder is how a shrine ends up with a washing
 * stone for a god.
 *
 * A SECOND KUTTICHATHAN CORRIDOR, L5–L8, PEAKING AT L7.
 *
 * The reference says plainly that this chapter does not require him, and this
 * is a deliberate departure from it on the owner's instruction — worth knowing
 * before anybody "corrects" it back.
 *
 * L7 is the peak and it is not an arbitrary choice: Estate Wall is the only
 * lesson in the chapter holding BOTH a laterite wall, which is the one thing
 * in this village he can climb and the place he throws from, and the Mana —
 * the great house whose roof the stones land on out of an empty evening,
 * which is the story everyone who knows his name knows. L5 and L6 build to
 * it and L8 lets it fall away, which is Chapter 1's shape and the difference
 * between a haunted stretch of road and a flag on four lessons.
 *
 * NO TRACES HERE. Chapter 1 opens with things moved in the night because the
 * child has not met him; by this chapter they have, so this corridor starts
 * at SIGHTINGS and the traces phase is skipped.
 *
 * L4 is Shrine Grove and is deliberately NOT in the corridor: nothing of his
 * happens at or near a temple, a shrine or an idol.
 */

import type { Lesson } from "./chapter1.ts";

const PLANTS = "village-plants";
const UTIL = "village-util";
const STONE = "village-stone";

export const LESSONS_2: readonly Lesson[] = [
  {
    n: 1,
    name: "Back Road",
    from: 0,
    to: 1,
    // "The player should still recognise the village for a short distance,
    // but the built environment gradually falls away." The canopy is the
    // village's own — coconut and mango — so the eye carries the last lesson
    // of Chapter 1 forward, and the ground opens underneath it.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`, `${PLANTS}/Drumstick_Muringa`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.2,
    mix: [0.2, 0.15, 0.65],
    depth: [8, 24],
    props: [
      // THE LAST OF THE VILLAGE, in the first fifth and then not again. A
      // broken wall with no run and no gate: a boundary that has stopped
      // being maintained is the clearest way to say the houses are behind
      // you, and it costs one prop rather than a lesson of masonry.
      { model: `${UTIL}/Laterite_Wall`, at: 0.12, z: -12, h: 2.1, clear: 4 },
      { model: `${STONE}/Mossy_Stone`, at: 0.22, z: -8.5, h: 0.9 },
      // A roof, far enough back to be the last one rather than a house on
      // this road. Depth does the work: at -30 it is scenery.
      { model: "ak-3d-pack/HouseThatch", at: 0.3, z: -30, h: 10, clear: 11 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.78, z: -16, h: 25 },
      { model: `${STONE}/Laterite_Rock`, at: 0.86, z: -9, h: 0.7 },
    ],
    herd: ["Cow"],
    // NOBODY STANDING IN THIS FIELD. The reference wants "one villager
    // returning from the village" — a person on the ROAD, walking back the
    // way the child came — and the road walkers already carry that. A
    // figure posted in a plot beside it is a farmer at work, which is the
    // opposite of the departure this segment is for.
    folk: [],
    corridor: false,
  },
  {
    n: 2,
    name: "Field Walls",
    from: 1,
    to: 2,
    // "Longer stretches of weathered laterite moss wall than in Chapter 1,
    // but break them occasionally with gates, openings, vegetation or eroded
    // sections." Useful trees behind the boundary: this is worked land.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Jackfruit_Tree`,
      `${PLANTS}/Mango_Tree`,
    ],
    mid: [`${PLANTS}/Drumstick_Muringa`, `${PLANTS}/Banana_Plant`],
    ground: [
      `${PLANTS}/Kerala_Grass_Tuft`,
      `${PLANTS}/Kerala_Fern`,
      `${PLANTS}/Tapioca_Cassava`,
    ],
    density: 1.7,
    mix: [0.24, 0.2, 0.56],
    depth: [9, 26],
    props: [
      // TEN PANELS AND TWO WAYS IN. Chapter 1's boundaries are five and six
      // panels with a single gap; this is the lesson whose whole subject is
      // the boundary, so it runs longer — and a run that long with one
      // opening reads as a prison wall rather than as somebody's field.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.1,
        z: -11,
        h: 2.1,
        clear: 5,
        run: { count: 10, aspect: 2.61, gapAt: 4 },
        skirt: true,
      },
      { model: `${STONE}/Granite_Boulder`, at: 0.55, z: -8, h: 1.1 },
      { model: `${UTIL}/Cattle_Tether_Post`, at: 0.72, z: -13, h: 1.4 },
    ],
    herd: ["Cow", "Buffalo"],
    // "A farmer, farm worker or one animal near a boundary opening can
    // provide life without turning the scene into a settlement." She stands
    // at the boundary and works — which on this road means she IDLES, using
    // the four loops she ships with. Nobody walks on their own land here;
    // the road is where walking happens.
    folk: ["FarmerWoman"],
    corridor: false,
  },
  {
    n: 3,
    name: "Orchard Lane",
    from: 2,
    to: 3,
    // The densest lesson in the chapter, and the only one with three full
    // layers. "Making the player feel enclosed by productive vegetation
    // while still moving forward" — a travel corridor, not a homestead, so
    // the fencing is short dividers rather than an enclosed compound.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Arecanut_Palm`,
      `${PLANTS}/Jackfruit_Tree`,
      `${PLANTS}/Mango_Tree`,
    ],
    mid: [
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Drumstick_Muringa`,
      `${PLANTS}/Papaya_Tree`,
    ],
    ground: [
      `${PLANTS}/Tapioca_Cassava`,
      `${PLANTS}/Taro_Chembu`,
      `${PLANTS}/Kerala_Fern`,
      `${PLANTS}/Kerala_Grass_Tuft`,
    ],
    density: 3.2,
    mix: [0.3, 0.3, 0.4],
    depth: [7, 27],
    props: [
      // A DIVIDER, NOT A COMPOUND. Six panels with a gap, and nothing else
      // enclosing: "do not create a full enclosed compound".
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.18,
        z: -9,
        h: 2.4,
        clear: 4,
        run: { count: 6, aspect: 1.75, gapAt: 3 },
        skirt: true,
      },
      { model: `${STONE}/Stepping_Stone`, at: 0.5, z: -10, h: 0.35 },
      { model: `${STONE}/Stepping_Stone`, at: 0.53, z: -12.5, h: 0.35 },
      { model: `${STONE}/Stepping_Stone`, at: 0.56, z: -15, h: 0.35 },
      // "Allow the dense planting to open around one exceptional mature
      // tree" near the end — the grove of Lesson 4 announcing itself.
      { model: `${PLANTS}/Banyan_Almaram`, at: 0.9, z: -19, h: 17, clear: 9 },
    ],
    herd: [],
    // "The emphasis is on movement through the landscape" — so the life in
    // this lane is somebody passing along it, not somebody planted in it.
    folk: [],
    corridor: false,
  },
  {
    n: 4,
    name: "Shrine Grove",
    from: 3,
    to: 4,
    // "Intimate, old and naturally integrated into the landscape: a place
    // travellers and nearby villagers recognise and respect, not a large
    // architectural destination." So: one great tree, a platform at its
    // roots, somewhere to sit, and open ground around it. The planting drops
    // away from the orchard's 3.2 so the tree has air to stand in.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Tamarind_Tree`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Fern`, `${PLANTS}/Kerala_Grass_Tuft`],
    // DEEP FERN AND GRASS UNDER THE TREE, which is what the floor of a grove
    // actually is. The density was 1.4 to give the banyan air to stand in,
    // and that was the right instinct applied to the wrong layer: it thinned
    // the GROUND cover as well as the canopy, and left the one tree standing
    // on mown lawn.
    //
    // Air comes from the canopy and mid shares being almost nothing — 0.09
    // and 0.09 — so nothing grows up to compete with the banyan. The 0.82
    // goes to fern and grass, and the density can be the chapter's highest
    // because none of it is taller than a knee. Depth runs to 30 so it
    // carries right to the back of the grove rather than stopping short of
    // the tree.
    density: 3.4,
    mix: [0.09, 0.09, 0.82],
    depth: [8, 30],
    props: [
      // A BANYAN, AND THE SAME ONE THE VILLAGE IS ARRANGED AROUND — 24,
      // which is the height it stands at on the althara in Chapter 1.
      //
      // Not a peepal. Both are sacred and both would be right in a grove,
      // but the banyan is the tree this world has already taught the child
      // to read: they have walked past the one in the village heart for ten
      // lessons, and meeting the same species out in the fields says "this
      // is a place like that one" without a word. A second, different
      // sacred tree says only that there are two kinds of tree.
      //
      // NO ALTHARA. The village's banyan stands on a platform because that
      // platform is furniture — the place a village sits all afternoon —
      // and this one is not in a village. It is a roadside grove, and the
      // reference is explicit that it should read as old and naturally
      // integrated rather than built: the tree goes straight into the soil
      // and its roots are the only masonry there is. `lift` goes with the
      // platform, since the base is no longer riding on anything.
      {
        model: `${PLANTS}/Banyan_Almaram`,
        at: 0.52,
        z: -14,
        h: 24,
        clear: 10,
      },
      // AND A SECOND ONE, FAR BACK. A grove is not one tree with a clear
      // sky behind it — the great banyan reads as the oldest thing here
      // only if something of its own kind stands further off for the eye to
      // measure it against, and a lone canopy against the horizon reads as
      // planted rather than grown.
      //
      // At -29 it is behind the whole planting band (which stops at 26) and
      // well short of where the ground ends at -38, so it stands on soil
      // with open field in front of it. Height stays near the near tree's:
      // distance is what makes it small, not a smaller tree, which is the
      // whole point of the depth scaling — shrink it here as well and it
      // reads as a sapling standing much closer.
      {
        model: `${PLANTS}/Banyan_Almaram`,
        at: 0.78,
        z: -29,
        h: 22,
        clear: 8,
      },
      // ── THE IDOL, AMONG THE ROOTS ─────────────────────────────────────
      //
      // This space was held empty for a long time. The reference asks for "a
      // small weathered stone idol at the base of the tree ... among the
      // exposed roots", and nothing in any folder was one — the nearest
      // things that existed were a washing stone and a milestone, which
      // would have put a laundry slab or a road marker where a god goes.
      // That is worse than an empty root, so the root stayed empty until
      // there was an idol to put in it.
      //
      // 1.5 units is about knee height on a grown villager, which is the
      // size the brief asks for: "intimate, old and naturally integrated",
      // not an architectural destination. It sits just off the trunk at
      // -13.4 rather than against it, because a shrine is approached.
      //
      // NO PLATFORM, for the same reason the banyan lost its althara: this
      // grove is not a built place. The idol goes into the soil among the
      // roots and its own plinth is the only masonry here.
      // AND IT HAS TO BE IN FRONT OF THE ROOTS, not among them.
      //
      // "Among the exposed roots" is the reference's phrase and it reads
      // beautifully — and a banyan's base is not a trunk. MEASURED on the
      // model: at this height the lowest sixth of the tree is a RING of prop
      // roots, dense from 2 to 6 units out and running to 10, with almost
      // nothing within a unit of the axis. So the axis is the one place at
      // the foot of this tree that is hidden: at z -13.4 the idol stood
      // five units behind the near root wall, correctly facing a road that
      // could not see it.
      //
      // SO IT COMES RIGHT FORWARD, to the front prop band with the laterite
      // rock, nearer the road than anything else in the grove. Moving it
      // just clear of the roots was not enough: at -11.4 it was still
      // behind the mossy stone and the resting stone, a knee-high object
      // three quarters of the way back in a lesson whose planting runs to
      // -26.
      //
      // AND IT IS STILL UNDER THE TREE, which is the part that looked like
      // a trade and is not. MEASURED: at this height the banyan spans 18.4
      // units from its axis, so its canopy reaches to z 4.4 — out over the
      // road itself. Everything in this grove is under it. The roots stay
      // behind the idol at 2 to 6 units, framing it, and the crown is
      // overhead: which is what "under the banyan" looks like from a road,
      // and the only arrangement in which a child sees either.
      //
      // 3.1 on a half-unit slab, so the whole thing stands 3.6 units — a
      // metre. It has climbed twice: 1.5 was a third of a metre and read as
      // a kerbstone, 2.4 was better and still small for the thing a lesson
      // is named after. At this depth it draws at about three units against
      // a frame twenty-four tall, which is a shrine a child notices rather
      // than one they have to be told about.
      // ON A SLAB, which is how one of these is actually set up. A god-stone
      // is not pushed into the soil — it stands on a flat cut stone so it
      // sits clear of the mud and there is somewhere to put the lamp and the
      // flowers. The washing stone's model is that slab already: measured,
      // 1.22 wide by 0.30 tall by 0.77 deep, which at h 0.5 gives a
      // platform two units across and half a unit up.
      //
      // `lift` is in the same units as `h` and takes the same depth
      // falloff, so the idol stays standing ON the slab however far back
      // the pair are drawn — the two do not drift apart with distance.
      { model: `${UTIL}/Washing_Stone`, at: 0.52, z: -8.8, h: 0.5, clear: 3 },
      {
        model: `${STONE}/Shrine_Idol`,
        at: 0.52,
        z: -8.8,
        h: 3.1,
        lift: 0.5,
        clear: 2,
      },
      // AND THE LAMP IN FRONT OF IT, which is what says somebody was here
      // this evening rather than that somebody was here once. A nilavilakku
      // — bell foot, knopped stem, five-spouted bowl — set on the ground
      // just off the slab, where one is actually put: in front of the god
      // and to the side, so it is not between the deity and whoever is
      // standing there.
      //
      // `lit` gives it the shrine's own hours. It goes on when the light
      // goes, the same rule the temple lamps follow — not a lamp burning at
      // noon, which is the bug the whole lamp gate exists to prevent.
      {
        model: `${UTIL}/Nilavilakku`,
        at: 0.535,
        z: -8.55,
        h: 1.5,
        lit: 21,
        // The flame is in the bowl at the top of the stem, not halfway up
        // the leg — and it is a wick, which moves, rather than a pressure
        // mantle, which does not. See `litUp` and `litKind`.
        litUp: 0.88,
        litKind: "oil",
      },
      { model: `${STONE}/Mossy_Stone`, at: 0.58, z: -11.5, h: 0.8 },
      // "One simple resting stone, bench or low sitting edge nearby."
      { model: `${UTIL}/Washing_Stone`, at: 0.64, z: -11, h: 0.55, clear: 2 },
      { model: `${STONE}/Laterite_Rock`, at: 0.3, z: -9, h: 0.7 },
    ],
    herd: [],
    // "A single visitor may pause briefly" — a traveller who stops at the
    // grove, which is a person on the road doing something, not a resident
    // standing in it. Left to the walkers until the shrine has an idol for
    // somebody to be visiting.
    folk: [],
    corridor: false,
  },
  {
    n: 5,
    name: "Farm Clearing",
    from: 4,
    to: 5,
    // "Simple and spacious, with a small number of large readable props."
    // The lowest canopy weight in the chapter: this lesson is open ground
    // with things standing ON it, and trees would close it in.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Drumstick_Muringa`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 0.9,
    mix: [0.16, 0.1, 0.74],
    depth: [11, 28],
    props: [
      // ── SPACE LEFT: THE HAYSTACK ──────────────────────────────────────
      //
      // The landmark of this lesson and the one thing that says "harvest"
      // at a glance. It exists nowhere — it was wanted in Chapter 1 too —
      // and there is no honest stand-in: a haystack is a specific silhouette
      // and anything else in the folder would just be a lump. The cart and
      // the tether post carry the working read until it is made.
      // THE LANDMARK OF THE LESSON, and it was missing. "Place a haystack
      // off the road as the main landmark, with the wooden cart nearby but
      // not blocking player movement" — the cart has been here on its own,
      // carrying a clearing that is supposed to be built around something
      // else. At 4.6 units it stands about a third again the height of the
      // farmer working beside it, which is what a season's straw looks like.
      //
      // AND CLEAR OF MILESTONE 15. The brief asks for that by name — "keep
      // Milestone 15 visually separate from the haystack and cart so the
      // progress marker remains readable" — so it sits at 0.22, well short
      // of the stone at the far end, with the cart beyond it.
      { model: `${UTIL}/Haystack`, at: 0.22, z: -15, h: 4.6, clear: 6 },
      { model: `${UTIL}/Village_Cart`, at: 0.36, z: -13, h: 2.2, clear: 5 },
      { model: `${UTIL}/Cattle_Tether_Post`, at: 0.46, z: -15, h: 1.4 },
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.62,
        z: -17,
        h: 2.2,
        clear: 3,
        run: { count: 4, aspect: 1.75, gapAt: 2 },
        skirt: true,
      },
      { model: `${STONE}/Granite_Boulder`, at: 0.82, z: -10, h: 1 },
    ],
    // "This is an active working space." The fullest herd in the chapter.
    herd: ["Buffalo", "Cow"],
    // THE ONE PLACE PEOPLE STAND STILL IN THIS CHAPTER. "This is an active
    // working space: one farmer can tend animals, move hay, or stand near
    // the cart" — a work site, where standing IS the activity. Kept.
    folk: ["FarmerWoman"],
    corridor: true,
  },
  {
    n: 6,
    name: "River Crossing",
    from: 5,
    to: 6,
    // THE CHAPTER'S CENTREPIECE. The bridge and the channel are not placed
    // from this table — they are cut into the terrain and built by the world
    // (see `setRiver`), because a river is a shape in the ground rather than
    // an object standing on it. What IS authored here is the bank: wet-edge
    // planting, stones at the water line, and trees set back far enough to
    // frame the crossing without hiding it.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Hibiscus_Chemparathi`],
    // TARO CARRIES THIS LESSON. Elephant-ear leaves are what a Kerala
    // riverbank looks like from a boat and from this camera, and they are
    // the strongest signal available that the ground here is wet.
    ground: [
      `${PLANTS}/Taro_Chembu`,
      `${PLANTS}/Kerala_Fern`,
      `${PLANTS}/Kerala_Grass_Tuft`,
    ],
    density: 1.9,
    mix: [0.18, 0.14, 0.68],
    depth: [7, 24],
    props: [
      // THE STONES AT THE WATER LINE ARE NOT IN THIS TABLE — see the river
      // block in world.ts, which stands them off the channel's own banks.
      // As lesson fractions they landed on the bank of an eleven-year-old's
      // road and in the middle of the water on a five-year-old's: on the
      // shortest band the river is 16 units wide in a 27.6-unit lesson, so
      // "a third of the way along" IS the river. A stone at the water line
      // is a fact about the river, and the river is the thing that knows
      // where its edge is.
      //
      // Set well back: "keep large foliage away from the bridge deck so the
      // player, milestone and movement path remain readable".
      { model: `${PLANTS}/Tamarind_Tree`, at: 0.16, z: -20, h: 13, clear: 7 },
      { model: `${PLANTS}/Tamarind_Tree`, at: 0.86, z: -21, h: 12, clear: 7 },
    ],
    herd: [],
    folk: [],
    corridor: true,
    // HALFWAY ALONG, EIGHT UNITS WIDE, THREE DEEP. Halfway so the child
    // walks up to it, crosses, and walks away again inside one lesson — the
    // reference's "road, bridge deck, road" — rather than meeting it at a
    // stone.
    //
    // Eight across, down from sixteen. At sixteen it was a river you ferry
    // across, and on the shortest band it was most of the lesson: 16 units
    // of water in a 27.6-unit segment left the crossing with no approach on
    // either side. Eight gives a twelve-unit bridge — a village footbridge,
    // which is the asset and the story — and keeps the banks the lesson is
    // actually authored around.
    //
    // Three deep with the water 0.9 below the bank leaves two units of
    // water: still plainly deep from this camera, which the reference is
    // explicit about ("should visually read as deep rather than as a
    // shallow puddle"), without becoming a gorge at the narrower width.
    river: { at: 0.5, half: 4, depth: 3 },
  },
  {
    n: 7,
    name: "Estate Wall",
    from: 6,
    to: 7,
    // "The player should sense the scale and status of the estate without
    // entering it; most of the scene is boundary, trees and glimpsed
    // architecture beyond." Tall canopy BEHIND the wall, so the canopies
    // rise above it and imply the property.
    canopy: [
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Jackfruit_Tree`,
      `${PLANTS}/Tamarind_Tree`,
    ],
    mid: [
      `${PLANTS}/Hibiscus_Chemparathi`,
      // "Allow moss, vines and ROADSIDE PLANTS to soften the wall so it
      // still belongs to the rural Kerala environment." A laterite run with
      // nothing growing at its foot reads as new masonry; this is a boundary
      // that has stood a long time.
      `${PLANTS}/Drumstick_Muringa`,
    ],
    ground: [
      `${PLANTS}/Kerala_Fern`,
      `${PLANTS}/Kerala_Grass_Tuft`,
      `${PLANTS}/Taro_Chembu`,
    ],
    // "TALL MATURE TREES BEHIND THE WALL so their canopies rise above it and
    // imply a large property" — and that is what the canopy share is for
    // here rather than the density. 0.44 of the planting is mango, jackfruit
    // and tamarind, which is the highest canopy share in the chapter: an
    // estate is a place where nobody has cut anything down for fifty years.
    density: 2.6,
    mix: [0.44, 0.14, 0.42],
    // ALL THE WAY BACK, PAST THE HOUSE. The old 30 stopped nine units short
    // of the mansion's back wall, so the great house stood against bare
    // ground with a stand of trees in front of it and nothing behind — which
    // reads as a model on a table rather than a property. The brief wants it
    // "glimpsed BETWEEN trees", and that needs trees on both sides of it.
    depth: [10, 38],
    props: [
      // THE LONGEST WALL IN EITHER CHAPTER, and one way in. Here the single
      // opening is right: an estate has A gate, and the gap in the run is
      // where it goes when there is a gate to put in it.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.08,
        z: -12,
        h: 2.4,
        clear: 5,
        // THE OPENING HAS A GATE IN IT, which is the one thing that says
        // this boundary belongs to somebody bigger than a farm — the
        // reference asks for "stronger gate pillars or a more formal gate
        // than earlier farm boundaries". Declared inside the run so it
        // lands on the gap in every age band; see `run.gate`.
        run: {
          count: 14,
          aspect: 2.61,
          gapAt: 7,
          gate: { model: `${UTIL}/Estate_Gate`, h: 3.4 },
        },
        skirt: true,
      },
      // ── SPACE LEFT: THE GATE ──────────────────────────────────────────
      //
      // "Stronger gate pillars or a more formal gate than earlier farm
      // boundaries" — ironwork between masonry piers. Neither the gate nor
      // the piers exist. The gap in the run above is the opening they belong
      // in, and it reads as a way in on its own, so the lesson works with a
      // hole in the wall until they are made.
      //
      // The house is the glimpse through it: far back, large, and never on
      // the road.
      // THE GREAT HOUSE, and what this lesson has always been about: "a
      // long laterite wall, a formal gate, tall trees, and only a partial or
      // distant glimpse of the large house beyond". A moss house stood in
      // for it because there was no mansion; there is one now.
      //
      // Its `at` is IGNORED — the build snaps it to the gate in the wall in
      // front of it, wherever the clamp put that opening.
      //
      // 16 AT -31, AND THE DEPTH IS WHAT SETS BOTH. A solid model has a
      // back to put somewhere, which the card never did: measured 1.74 deep
      // for 1.08 tall, so at this size it is seventeen units of building.
      // The estate wall stands at -12 and the ground runs out at -38.
      //
      // Pulled back three units from -28, which puts its porch at -21.5 and
      // gives the drive ten clear units from the gate instead of six — the
      // house is glimpsed ACROSS ground now rather than looming just behind
      // the wall. Its back wall goes a unit and a half past the floor's
      // edge, which the card could never have done and a solid can: the
      // building's own mass is between that edge and the road.
      //
      // It draws about twelve units against a frame of twenty-four — half of
      // it, and near twice the temple. It is the biggest building in the
      // game and it is also a field away, and the second has to read or the
      // first is a lie.
      //
      // `clear` IS SMALL ON PURPOSE. It was 16, which held a bare ring
      // twenty-one units across around the house — and the brief asks for
      // the opposite: "only a partial or distant glimpse of the large house
      // through a gate opening or BETWEEN TREES". A clearing is the one
      // arrangement in which nothing is between anything.
      //
      // Nothing is needed for the building itself: the build already records
      // its measured footprint as a blocker, and the drive from the gate to
      // the porch is held clear separately. 4 is a skirt of open ground at
      // the walls, which is what a swept house has — not a field.
      { model: "ak-3d-pack/Mana", at: 0.48, z: -31, h: 16, clear: 4 },
      // ── MATURE TREES ALONG THE WALL, IN FRONT OF THE HOUSE ──────────
      //
      // "Place tall mature trees BEHIND THE WALL so their canopies rise
      // above it and imply a large property", and "only a partial or distant
      // glimpse of the large house ... BETWEEN TREES".
      //
      // The scatter plants this lesson heavily and at random, which gives a
      // wood. What it cannot give is the one thing the brief is describing:
      // named trees standing at known places relative to the gate, so the
      // house is seen between THEM. These four are placed, not scattered.
      //
      // Just inside the wall at z -16, which puts their trunks behind the
      // masonry and their crowns well above it — a mango is 15 units here
      // against a wall of 2.4. Two flank the gate at 0.34 and 0.62 without
      // standing in it; the jackfruits at 0.2 and 0.78 carry the line on
      // down the boundary so it does not stop where the gate does.
      //
      // `clear` is small: these are meant to have undergrowth up to their
      // trunks, which is what makes a boundary look old.
      { model: `${PLANTS}/Mango_Tree`, at: 0.34, z: -16, h: 15, clear: 4 },
      { model: `${PLANTS}/Mango_Tree`, at: 0.62, z: -16.5, h: 14, clear: 4 },
      {
        model: `${PLANTS}/Jackfruit_Tree`,
        at: 0.2,
        z: -15.5,
        h: 13,
        clear: 4,
      },
      {
        model: `${PLANTS}/Jackfruit_Tree`,
        at: 0.78,
        z: -17,
        h: 13.5,
        clear: 4,
      },
      { model: `${STONE}/Mossy_Stone`, at: 0.3, z: -8.5, h: 0.9 },
    ],
    herd: [],
    // "Keep activity restrained and private" — and an estate's people are
    // inside its wall, which the child never crosses. The road carries
    // whoever is out.
    folk: [],
    corridor: true,
  },
  {
    n: 8,
    name: "Produce Route",
    from: 7,
    to: 8,
    // "It is not another market: it is the road that feeds one." No stalls,
    // no shopfronts — transport and temporary loading. Bamboo gives it a
    // silhouette of its own against the estate wall before it.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Arecanut_Palm`],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Papaya_Tree`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Tapioca_Cassava`],
    density: 2.1,
    mix: [0.26, 0.24, 0.5],
    depth: [9, 26],
    props: [
      { model: "nature/KeralaBambooGroves", at: 0.22, z: -14, h: 21, clear: 5 },
      // The cart is the major working prop, parked beside the road.
      { model: `${UTIL}/Village_Cart`, at: 0.55, z: -11, h: 2.3, clear: 5 },
      // WHAT MAKES THIS A PRODUCE ROUTE RATHER THAN A ROAD WITH A CART ON
      // IT. "Stacked coconuts, baskets, sacks or produce bundles in small
      // clusters rather than covering the full scene" — two clusters, one
      // at the cart as though being loaded onto it and one further along
      // waiting its turn, which is the "temporary loading" the brief asks
      // for rather than a shopfront.
      //
      // Small: 1.3 units is about waist height, which is what a basket a
      // woman carries on her head comes up to when it is standing on the
      // ground.
      { model: `${UTIL}/Produce_Pile`, at: 0.5, z: -10, h: 1.3, clear: 2 },
      { model: `${UTIL}/Produce_Pile`, at: 0.78, z: -12.5, h: 1.15, clear: 2 },
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.68,
        z: -13,
        h: 2.2,
        clear: 3,
        run: { count: 5, aspect: 1.75, gapAt: 2 },
        skirt: true,
      },
      // ── SPACE LEFT: THE LOAD ──────────────────────────────────────────
      //
      // Stacked coconuts, baskets, sacks and produce bundles in small
      // clusters — the whole identity of this lesson, and none of it exists.
      // The cart is parked as if being loaded, which carries some of it; the
      // rest waits. Rocks standing in for sacks would read as a rockfall.
      { model: `${STONE}/Laterite_Rock`, at: 0.86, z: -9, h: 0.7 },
    ],
    herd: [],
    // "One of Chapter 2's busier working segments": one or two workers
    // loading and preparing produce, with the cart beside them. A loading
    // crew is stationary by definition, so these two stay.
    folk: ["FarmerWoman", "TeaStall"],
    corridor: true,
  },
  {
    n: 9,
    name: "Grazing Land",
    from: 8,
    to: 9,
    // "Broader and more remote than the Chapter 1 pasture... keep fences
    // minimal; the land should read as a broad grazing stretch rather than a
    // tightly enclosed paddock." So: almost no props, the widest depth band
    // in the chapter, and the animals carry the scene.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Tamarind_Tree`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 0.9,
    mix: [0.16, 0.1, 0.74],
    depth: [12, 32],
    props: [
      { model: `${UTIL}/Cattle_Tether_Post`, at: 0.4, z: -16, h: 1.4 },
      { model: `${STONE}/Granite_Boulder`, at: 0.68, z: -12, h: 1.2 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.8, z: -20, h: 24 },
    ],
    herd: ["Buffalo", "Cow"],
    folk: [],
    corridor: false,
  },
  {
    n: 10,
    name: "Road Meadow",
    from: 9,
    to: 10,
    // THE CHAPTER CLOSES THE WAY IT OPENED, one step calmer — the same rule
    // Chapter 1's tenth lesson follows. "Do not add a large new landmark;
    // the road itself and Milestone 20 should carry the ending."
    canopy: [`${PLANTS}/Coconut_Palm`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1,
    mix: [0.12, 0.08, 0.8],
    depth: [10, 30],
    props: [
      { model: `${STONE}/Mossy_Stone`, at: 0.44, z: -8, h: 0.85 },
      { model: `${STONE}/Laterite_Rock`, at: 0.76, z: -9.5, h: 0.7 },
    ],
    herd: ["Cow"],
    folk: [],
    corridor: false,
  },
];
