# Chapter 3 — Village of Whispers

Source: `chapter3_the_village_of_whispers_day_night_reference_with_images.html`, supplied from Downloads on 22 September 2026. The document's text owns timing and progression; its embedded gameplay image owns framing. Concept-image night colours do not override the live lighting engine.

## Continuation and scene mapping

Global lesson 20 remains Chapter 2's ending. Milestone 20 opens Chapter 3, global lessons 21–30. Existing saved `roadStones` and chapter-card logic are reused without resetting progress. Local lesson numbers remain 1–10 inside the placement table.

| Global lesson | In-game short name | Authored scene |
| --- | --- | --- |
| 21 | Village Road | Meadow opening, distant roofs, first wall fragment |
| 22 | Outer Houses | Separated compounds, wells, walls and garden vegetation |
| 23 | Village Lane | Longer walls, roof glimpses, mango and jackfruit canopy |
| 24 | Banyan Junction | Major banyan, water point, resting stone and small devotional lamp |
| 25 | Great Market | Two stall rows, produce, cart, larger crowd, temple ahead |
| 26 | Temple Street | Market carry-over, temple, boundary, well and tree |
| 27 | Playground | Tree, walls, well, house edge, cart and four route-node types; no market at the opening, as requested |
| 28 | Quiet Houses | Initial tree/wall carry-over, gated old Mana house, quieter compounds and opening grass |
| 29 | Edge Gardens | Separated houses, bamboo boundary, banana/taro and open ground |
| 30 | Quiet Road | One departing distant roof, grass/ferns and a clear endpoint |

All ten segments share one road, the existing camera and horizon, milestone family, 22% planting blend, and the live game clock. The same architecture and interaction props exist by day and night. Market occupancy reduces between 19:00 and 21:00.

The two main market rows use Chapter 1's `h: 17.5` and `box: { w: 4.27, d: 1.02, span: 1.6, want: 55 }` sizing, with a shared `referenceZ: -17.5` for fitting. This keeps their physical size equal instead of enlarging the distant row to the same apparent width. Cottages and larger homes retain distinct physical heights; the existing perspective function handles their different setbacks. All seven house families appear across the chapter, including Mana. Gate assets occupy the wall-run openings, which remain correct across age-band lengths. Authored inner lanes and packed-earth resting/play areas stay clear of scattered vegetation. Kitchen gardens use banana, taro, tapioca and hibiscus; the central tree landmarks use the supplied Banyan_Almaram and Peepal_Arayal models.

Chapter 3 suppresses the legacy market's automatic bamboo decoration and camera widening: multiple shop rows must not turn the chapter into bamboo forest or reduce the player scale. The existing base camera and lighting settings are retained.

## Depth and scale

Nearby objects appear larger; equal-sized objects farther into the village become progressively smaller. Buildings, walls, gates, planted scenery, villagers and animals use the road-relative depth calculation. The small animated pots and coconuts now use it too, including the coconut's ground-contact offset. Each spirit appearance recalculates scale for its actual position rather than keeping the size of its first spawn point.

The reference requires the existing fixed camera, which is orthographic. Depth is therefore simulated through uniform object scaling, occlusion, placement and atmospheric haze, rather than changing the camera projection. The shared scale is `1 - 0.7 × (1 - roadDistance / objectDistance)`: a softened perspective falloff that preserves gameplay readability. It is not a physically exact perspective lens or a pixel-for-pixel reconstruction of the concept paintings.

## Placement safety and reference audit

The cart stands broadside in the market forecourt, outside the shops' occupied ground area. Chapter 3 now resolves the complete layout before ground painting and construction, using decoded model dimensions, rotations and depth scale. This also separates neighbouring houses, wells, garden plants and other props across lesson boundaries. Objects stay in their original lesson and keep their authored physical height. Redundant house copies in the most crowded stretches were removed; all seven house families remain represented.

The seated blacksmith is spawned only at his forge in the roadside market row. He is not a generic lesson villager or road walker, and the distant market row does not duplicate him. His shop-relative anchor follows the final fitted building dimensions.

His seated footprint is reserved separately, including leg room. The market well is farther along the forecourt, and both authored props and animated sweeps avoid the seated space. Villager placement also treats it as occupied.

Boundary runs move together and recalculate panel spacing at their final depth. Real gates remain present even on three-slot runs, and the old house aligns with its gate. Building footprints now exclude scattered vegetation and villagers across the whole structure. Animated pots and coconuts reserve their full movement area. Canopies may intentionally overhang; tree clearance uses a trunk/root proxy rather than treating the entire canopy as a solid wall.

See the [lesson-by-lesson reference audit](chapter3-reference-audit.md) and [placement measurements for all age bands](chapter3-qa/placement-audit.json). The explicit user override is removal of the market remnant at Lesson 27's opening. The original reference remains unchanged.

## Mystery behaviour

The chapter has its own brief-appearance controller rather than inheriting earlier chapters' long road routines. Fixed route nodes stay behind the playable lane. Wall/well/tree appearances use measured loaded-model bounds; unsupported or offscreen placements are skipped.

- Daytime: ordinary village activity, no visible spirit.
- Evening, 19:00–21:00: occasional household-object movement. The 21:00–22:00 interval is quiet; deep-night behaviour begins at 22:00. Normal ambience continues between events.
- Deep night, 22:00–04:00: first brief recognition at lesson 24; lessons 26–27 permit clear appearances lasting at most two seconds. The market's mystery is conveyed through props.
- Lesson 28: activity immediately fades, with at most one farewell event and no activity in the second half.
- Lesson 29: at most one ambiguous evening object event; no visible spirit or deep-night event.
- Lesson 30: no supernatural events at any hour.

Events use 35–80 second spacing after the initial opportunity, honour reduced motion, and never change lighting or spawn a chase. The quiet pot cue reuses the existing compressed recording and respects the world-audio mute control. It adds 8,821 bytes; existing 3D assets are reused.

## Verification

- `chapter3.test.ts`: shipped asset references, ten continuous segments, all age-band placement lengths, road setbacks, clock boundaries, fading mystery, four peak route-node types and market closing.
- `chapters.test.ts`: the milestone-20 hand-off, lessons 21–30, final lesson clamp and existing chapter addressing.
- `depth-scale.test.ts`: road-relative scale, continuous reduction with distance and relocation without applying the scale twice. Market-row tests cover all four age bands.
- TypeScript compilation, development build and asset-manifest consistency checks.
- `chapter3-layout.test.ts`: all four age bands, footprint separation across lesson boundaries, ground limits, road clearance, gates, old-house alignment, and full animated-prop movement areas.
- Final full-suite validation after the placement, Lesson 27 and blacksmith fixes: 219 tests passed, one skipped. TypeScript compilation and ESLint passed. The all-age placement audit reports no unresolved placements.
- After the final seated-space refinement, the all-age collision test, TypeScript and ESLint passed again. The compiled frontend contains that refinement; its final market capture is included in the gallery.
- [Day/night browser captures](chapter3-qa/README.md) cover all ten lessons, with zero page exceptions and zero failed asset requests in the captured runs. Review includes market depth, house spacing, temple adjacency and the old-house entrance. The entrance and its painted path now prefer the actual gate position over gaps between unrelated wall fragments.
- Screenshots sample one position per lesson and do not certify every transient animation or every view along the road. Timing and progression are also covered by the automated tests above.

Review URLs use the existing `/kids?lesson=21&hour=12&band=5-6` interface. Select Time Keepers/village and use the existing night control when reviewing a deep-night hour. No query flag changes saved progression.
