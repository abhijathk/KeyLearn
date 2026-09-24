# Chapter 3 reference audit

Reference: `/Users/abhijathkottikkal/Downloads/chapter3_the_village_of_whispers_day_night_reference_with_images.html`.

The reference defines one continuous road from milestone 20 through 30, with ten lessons and a gradual mystery arc. Its text controls timing and scene identity; the current-game image controls framing. Concept paintings are not exact mesh-placement blueprints.

**User override:** Lesson 27 has no market at its beginning. Its former market-remnant asset has been removed. Market-to-temple continuity remains in Lessons 25–26. This intentionally supersedes the reference's request for market remnants in the playground.

**Shopkeeper placement:** The seated blacksmith belongs only to the forge frontage in the nearest market row. He is excluded from generic lesson crowds and road walkers; the distant market copy does not spawn another smith. The dedicated shopkeeper follows the existing 08:00–21:00 work hours.

| Lesson | Reference requirement | Implementation and verification |
| --- | --- | --- |
| 21 | Meadow opening, distant settlement, a short wall and side path; almost no mystery | Sparse grass/fern approach, a set-back cottage, wall fragment and tree. No clear spirit appearance. |
| 22 | Several separated compounds, wells, gates, gardens and side paths | Three house placements at different setbacks; actual footprints determine separation. A well, gate and garden plants remain. Gates are preserved on the shortest age band. |
| 23 | More enclosed walls and roofs, mango/jackfruit canopy, side-lane hiding points | Continuous gated boundary, a house with neighbouring roof carry-over, mango/jackfruit trees and a well. No clear spirit reveal. Redundant overlapping house copy removed. |
| 24 | Major banyan junction, well, resting stones, devotional detail and branching paths | Supplied banyan, well, stones, oil lamp and side lanes. Edge-house placement is kept clear of the tree's trunk/root area. First brief deep-night recognition. |
| 25 | Market larger than Chapter 1, carts/goods, busy day, progressive closing, temple adjacency | Two full-scale shop rows with depth separation. Cart, well and produce are outside shop footprints. Six authored villagers; progressive departure 19:00–21:00. Deep-night rolling coconut and rocking-pot events. Temple continues in the adjacent segment. |
| 26 | Market carry-over, temple boundary, trees, well, lamps, side paths; clear brief appearances | Temple/peepal/well/gated boundary and oil lamp. Actual Lesson 25 market remains behind the start. Deep-night appearances are limited to 1.5 seconds. |
| 27 | Peak around tree, walls, well, cart, house edges and at least four route-node types | Root, wall, side-path and well nodes; strongest event rate, maximum two-second appearances. Cart and movable props have clear space. **No market at the opening, per user override.** |
| 28 | Quieter houses, initial wall/tree carry-over, final early disturbance, opening space | Gated Mana compound, well and garden; actual gate and entrance align. At most one farewell event, and none after the halfway point. |
| 29 | Separated houses, kitchen gardens, low fence, open grass; almost no mystery | Two houses, garden planting, bamboo boundary and well. No visible spirit and no deep-night disturbance; at most one evening trace. |
| 30 | Open grass/ferns, fading village early, unobstructed final milestone, completely calm | One early distant house, sparse vegetation, no new herd, no mystery events. Existing neutral road continues beyond milestone 30. |

## Shared requirements

- The camera, road/player framing and live lighting system remain in control. Depth comes from the existing road-relative scale function and scene layering.
- Buildings and props use the same geometry day and night. Time changes occupancy and brief object/character behaviour.
- Vegetation retains the existing 22% transition blend, within the reference's 15–25% interval.
- Evening disturbances use 19:00–21:00; direct sightings use 22:00–04:00. No chase routine is used in Chapter 3.
- Layout resolution preserves original lesson membership, physical height, perspective scale and complete assets. It does not conceal intersecting objects to make the audit pass.

## Checks and limits

`node --experimental-strip-types scripts/chapter3-dimensions.mjs` checks the stored ratios against decoded model vertex positions and node transforms. `chapter3-layout.test.ts` checks every pair of authored footprints in every age band, road/ground limits, gates and animation sweeps. Connected wall panels are allowed to meet; foliage overhang is intentional and tree trunks/roots use conservative proxy footprints.

`node --experimental-strip-types scripts/chapter3-layout-audit.mjs` writes the [placement audit](chapter3-qa/placement-audit.json). The [browser gallery](chapter3-qa/README.md) contains real day/night captures, with page exceptions and failed asset requests recorded separately.

The document offers alternative example actions: basket shifting, hanging objects, flower movement, footprints, cart sitting and root-to-wall hopping. The current event set implements pot rocking, coconut rolling, wall crouching and peeking, rather than every example animation. Static captures sample scene composition; they are not proof of every animation frame or every view along the road. The documented scene progression and timing are checked separately from visual judgement.
