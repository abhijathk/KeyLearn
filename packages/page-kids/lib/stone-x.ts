/**
 * Where a milestone goes.
 *
 * Its own module so it can be tested: it is arithmetic with no scene, no
 * renderer and no DOM behind it, and importing `world.ts` to reach it drags
 * in three.js and the whole page. Same reasoning as `run-length.ts`, which is
 * the other half of this calculation.
 */

/**
 * THE CLOSEST TWO STONES MAY EVER STAND — as a preference, not a promise.
 *
 * A milestone goes in at the end of a lesson, and a lesson is only as long as
 * its passage: `runLengthFor` caps the run at 0.9 units per keystroke so short
 * passages do not make the character skate, which means an eleven character
 * passage is a NINE UNIT lesson. Two numbered stones nine units apart stand
 * shoulder to shoulder with their lamps — 6 and 7 together, then 9 and 10,
 * while 8 stands alone because its passage happened to be a long one.
 *
 * Both stones are real and both numbers are right. What was wrong is that the
 * SPACING of the markers was inherited from the length of the lesson, and
 * those are not the same measurement. A lesson is as long as its passage; a
 * milestone is a thing standing in a landscape, and two of them have to be far
 * enough apart to read as two things.
 */
export const MIN_STONE_GAP = 26;

/**
 * HOW FAR PAST THE FINISH A STONE MAY EVER STAND.
 *
 * The gap used to be applied as `max(runEnd, lastStoneX + GAP)`, measured from
 * the last STONE — and a stone only ever moves forward, so when a lesson is
 * shorter than the gap the shortfall is not paid off, it is CARRIED. The stone
 * is planted a little past the finish, the next lesson starts from the finish
 * rather than from the stone, and the next stone is pushed a little further
 * past again. The debt compounds every lesson.
 *
 * It is an age bug and it is the youngest band's alone. At 0.9 units per
 * keystroke the gap needs a passage of about twenty-nine characters. The 7-8
 * band writes 50 to 72 and runs 45 to 64 units, well clear of it; the 5-6 band
 * writes 24 to 36 and runs 21.6 to 32.4, straddling it. So a five-year-old
 * early in their curriculum loses about four units a lesson: ten past the
 * finish by their third stone, forty by their tenth — a milestone standing
 * most of a screen beyond the place it exists to mark.
 *
 * And for that child the gap is simply NOT ACHIEVABLE, which is what the
 * original rule missed. Their whole lesson is shorter than it. Pushing the
 * stone forward cannot make two stones 26 apart when the child only walks 22
 * between them — once the lead saturates, the spacing is the lesson length
 * whatever this is set to. All the pushing buys is a marker that no longer
 * marks where they stopped.
 *
 * Four units, a little under a child's height: plainly the stone being arrived
 * at rather than a separate destination, and near enough that the stone's
 * lane-alignment is still worth having.
 */
export const MAX_STONE_LEAD = 4;

/**
 * Where this lesson's stone goes, given where the child stops and where the
 * last stone went in.
 *
 * `lastStoneX` is `-Infinity` before any stone has been planted.
 */
export function stoneXFor(runEnd: number, lastStoneX: number): number {
  if (!(runEnd > lastStoneX)) {
    // THE END OF THE TRAIL, where `startRun` clamps `runStart` to
    // `TRAIL_END - RUN_LEN` and the finish stops advancing at all. There is no
    // reach left to measure a lead against, so this is left exactly as it was
    // rather than given an answer this function is not the place to invent: it
    // has its own problem — the stones march on past the end of the built road
    // — and that is a question about what happens when a child walks the whole
    // trail, not about where a marker goes.
    return lastStoneX + MIN_STONE_GAP;
  }
  return Math.min(
    Math.max(runEnd, lastStoneX + MIN_STONE_GAP),
    runEnd + MAX_STONE_LEAD,
  );
}
