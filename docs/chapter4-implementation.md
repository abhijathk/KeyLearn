# Chapter 4 — The Wild Crossing

Reference: `chapter4_the_wild_crossing_day_night_reference_with_images_current_game.html` (Downloads).

## Recovered implementation

The interrupted session had authored Lessons 31–40, registered Chapter 4 in the chapter picker/progression, and integrated the wide river into the existing world. Its saved build completed successfully and its 60 chapter/layout tests passed. Browser verification had not been saved.

The route follows forest edge → shady forest → grass hills → meadow → river descent → riverbank → island crossing → river woods → uplands → open green road. The existing camera, typing UI, live clock and ecology blending remain in use. The crossing scales with the age band's lesson bounds: M36 is on the near bank, M37 is on the island, and M38 is on the far bank. Two modular wooden bridge spans connect the banks through the island. Two trees and wet-edge plants frame the island without occupying the road.

## Resume fixes

- Fixed the walking surface dipping through the bridge planks near the island. Chapter 2's landing ramp interpolated toward submerged terrain when reused for the island spans. Chapter 4 now keeps each deck at its authored level, matching its level landings.
- Added the two missing island mystery anchors: behind a tree and beside the bridge rail, in addition to the milestone anchor. Coordinates derive from the crossing geometry for every age band. The rail appearance uses the perched animation and rail height; its point is outside the character corridor.
- Made the background river reveal follow lesson lengths. A fixed 28-unit reveal left the start of Lesson 36 dry-looking on the longer roads. The far bank now begins in the last quarter of Lesson 35 while the foreground road remains dry.
- Added spatial checks for all three anchors and the river reveal across the four road lengths.

Kuttichathan remains clock-gated: evening prop clues from 19:00 to 21:00, brief figures from 22:00 to 04:00, strongest in Lesson 37. Visible appearances end in the first half of Lesson 38; Lesson 39 permits only an early evening clue; Lesson 40 is entirely calm.

## Review

Local entry: `http://localhost:4000/kids?lesson=31&hour=11&band=5-6`

Crossing: `http://localhost:4000/kids?lesson=37&hour=11&band=5-6&perf`

Use the existing night control to review 23:00 from the 11:00 entry. `band=9-10` checks the longer crossing. `?perf` exposes the existing review object with crossing geometry, walker position and sampled walking support.

Browser evidence is saved in `docs/chapter4-qa/`. The first inspection exposed the deck defect; final crossing verification is recorded separately so the original finding remains visible. The local anonymous save-sync endpoint returns 403; this is separate from asset loading and scene rendering.

## Validation results

- 60 chapter/layout/depth regression tests passed; the added river-reveal checks also pass for all four age bands.
- Chapter 4/world ESLint and package TypeScript checks passed.
- Development browser build completed. The final build reported three CSS-module export warnings in concurrently edited UI files (`pickWho`, `playingWord`, `kidsTile`); none comes from the chapter/world changes.
- All ten lessons loaded in Chrome with zero scene runtime errors and zero missing game assets.
- Real typing moved the short-road character from x=147.6 to x=179.15, crossing onto the island, and the longer-road character from x=448 to x=518.81, crossing to the far bank. All 2,776 deck samples across those layouts matched the authored deck height.
- [Screenshot gallery](chapter4-qa/index.html), [crossing results](chapter4-qa/crossing-report.json), and [river approach results](chapter4-qa/river-report.json).
