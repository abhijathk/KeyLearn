import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { inject, injectable } from "@fastr/invert";
import { DataDir } from "@keylearn/config";
import { Profile } from "@keylearn/database";
import { Logger } from "@keylearn/logger";

/** The per-learner stores, each laid out `<root>/<a>/<b>/<account>/<pid>…`. */
const ROOTS = [
  "profile_stats",
  "profile_settings",
  "braille_progress",
  "a11y_prefs",
  "profile_doc",
] as const;

/**
 * Moves an organisation-owned learner's files out of whichever account's
 * folder they were written into and into the organisation's own.
 *
 * Until `learnerOwner` existed, a mode-A learner's practice was stored under
 * the account whose device they used — so a child who moved between
 * classroom machines had their history in several places, and the
 * organisation that owns it could read none of it. This puts each file where
 * the routes now look for it.
 *
 * Idempotent and safe to run on every boot: it only ever moves a file whose
 * name leads with a mode-A learner's id, and only when the organisation has
 * no file of that name yet. Where it has one — a device that kept writing
 * after the fix — the stray is left in place and reported, never merged over
 * or deleted, so nothing a learner typed is lost to it.
 */
@injectable()
export class OrgLearnerFiles {
  constructor(@inject(DataDir) readonly dataDir: DataDir) {}

  async relocate(): Promise<{ moved: number; kept: number }> {
    const rows = await Profile.query()
      .whereNull("userId")
      .whereNotNull("organizationId")
      .select("id", "organizationId");
    let moved = 0;
    let kept = 0;
    if (rows.length === 0) {
      return { moved, kept };
    }
    const orgOf = new Map(rows.map((p) => [p.id!, p.organizationId!]));
    for (const root of ROOTS) {
      const base = this.dataDir.dataPath(root);
      for (const dir of await accountDirs(base)) {
        for (const name of await list(dir)) {
          const pid = Number(/^(\d+)(?=$|[.~])/.exec(name)?.[1]);
          const org = orgOf.get(pid);
          if (org == null) {
            continue;
          }
          const to = join(base, "org", String(org).padStart(9, "0"));
          if (await exists(join(to, name))) {
            kept++;
            Logger.warn(
              "Mode-A learner file left in place, the organisation already has one: %s",
              join(dir, name),
            );
            continue;
          }
          await mkdir(to, { recursive: true });
          await rename(join(dir, name), join(to, name));
          moved++;
        }
      }
    }
    return { moved, kept };
  }
}

/** Every `<root>/<a>/<b>/<account>` folder, skipping the organisations' own. */
async function accountDirs(base: string): Promise<string[]> {
  const out: string[] = [];
  for (const a of await list(base)) {
    if (a === "org") {
      continue;
    }
    for (const b of await list(join(base, a))) {
      for (const account of await list(join(base, a, b))) {
        out.push(join(base, a, b, account));
      }
    }
  }
  return out;
}

async function list(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
