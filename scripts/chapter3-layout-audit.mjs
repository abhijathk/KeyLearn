// Run with node --experimental-strip-types scripts/chapter3-layout-audit.mjs.
import fs from "node:fs";
import {
  boundsForBand,
  lessonAt,
  placements,
  setChapterLessons,
} from "../packages/page-kids/lib/chapter1.ts";
import { LESSONS_3 } from "../packages/page-kids/lib/chapter3.ts";
import {
  reserveWhisperProps,
  resolveChapter3Layout,
  smithFootprint,
  villageFootprint,
} from "../packages/page-kids/lib/chapter3-layout.ts";
import { depthScale } from "../packages/page-kids/lib/depth-scale.ts";
setChapterLessons(LESSONS_3);
const report = [];
for (const band of ["5-6", "7-8", "9-10", "11+"]) {
  const bounds = boundsForBand(band),
    perspective = (z) => depthScale(z, 42, 2);
  const r = resolveChapter3Layout(
    placements(bounds, perspective),
    bounds,
    perspective,
  );
  report.push({
    band,
    unresolved: r.unresolved,
    placements: r.placements.map((p) => ({
      lesson: lessonAt(p.x, bounds).n + 20,
      model: p.model,
      ...villageFootprint(p, perspective),
    })),
    seatedBlacksmith: smithFootprint(r.placements, perspective),
    animatedProps: reserveWhisperProps(r.placements, bounds, perspective),
  });
  if (r.unresolved.length)
    throw new Error(
      band + ": unresolved placements " + r.unresolved.join(", "),
    );
  console.log(
    band +
      ": " +
      r.placements.length +
      " placements and " +
      report.at(-1).animatedProps.length +
      " animated prop sweeps audited",
  );
}
fs.writeFileSync(
  new URL("../docs/chapter3-qa/placement-audit.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
