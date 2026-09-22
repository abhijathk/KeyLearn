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
| 27 | Playground | Tree, walls, well, stalls, house edge, cart and four route-node types |
| 28 | Quiet Houses | Initial tree/wall carry-over, quieter compounds and opening grass |
| 29 | Edge Gardens | Separated houses, bamboo boundary, banana/taro and open ground |
| 30 | Quiet Road | One departing distant roof, grass/ferns and a clear endpoint |

All ten segments share one road, the existing camera and horizon, milestone family, 22% planting blend, and the live game clock. The same architecture and interaction props exist by day and night. Market occupancy reduces between 19:00 and 21:00.

## Mystery behaviour

The chapter has its own brief-appearance controller rather than inheriting earlier chapters' long road routines. Fixed route nodes stay behind the playable lane. Wall/well/tree appearances use measured loaded-model bounds; unsupported or offscreen placements are skipped.

- Daytime: ordinary village activity, no visible spirit.
- Evening: occasional household-object movement. Normal ambience continues between events.
- Deep night, 22:00–04:00: first brief recognition at lesson 24; lessons 26–27 permit clear appearances lasting at most two seconds. The market's mystery is conveyed through props.
- Lesson 28: activity immediately fades, with at most one farewell event and no activity in the second half.
- Lesson 29: at most one ambiguous evening object event; no visible spirit or deep-night event.
- Lesson 30: no supernatural events at any hour.

Events use 35–80 second spacing after the initial opportunity, honour reduced motion, and never change lighting or spawn a chase. The quiet pot cue reuses the existing compressed recording and respects the world-audio mute control. It adds 8,821 bytes; existing 3D assets are reused.

## Verification

- `chapter3.test.ts`: shipped asset references, ten continuous segments, all age-band placement lengths, road setbacks, clock boundaries, fading mystery, four peak route-node types and market closing.
- `chapters.test.ts`: the milestone-20 hand-off, lessons 21–30, final lesson clamp and existing chapter addressing.
- TypeScript compilation, development build and asset-manifest consistency checks.
- Browser visual review is recorded separately once captures are available; automated checks alone do not certify visual fidelity.

Review URLs use the existing `/kids?lesson=21&hour=12&band=5-6` interface. Select Time Keepers/village and use the existing night control when reviewing a deep-night hour. No query flag changes saved progression.
