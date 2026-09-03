/**
 * The shape of one controllable thing.
 *
 * This is the contract the control centre spec (§2, principle 1) asks for:
 * every switch is a data entry here, the page renders from it, "restore
 * defaults" is a comparison against `default`, and every one-way rule lives
 * in the one validator next door. Nothing in this package reads a database
 * or a request; it is pure data plus pure functions, so it can be imported
 * from the server, the database layer and the browser alike.
 */

/** Which section of the control centre the row is shown under. */
export type SectionId =
  | "pages"
  | "languages"
  | "registration"
  | "maintenance"
  | "leaderboard"
  | "profiles"
  | "accounts"
  | "privacy"
  | "security"
  | "integrity"
  | "moderation"
  | "retention"
  | "practice"
  | "kids"
  | "braille"
  | "typingTest"
  | "certificates"
  | "multiplayer"
  | "schools"
  | "premium"
  | "ads"
  | "a11y"
  | "ops"
  | "email"
  | "admin";

/**
 * How a value is shaped.
 *
 *  - `switch`      on or off.
 *  - `choice`      exactly one of `choices`.
 *  - `number`      a number inside `bounds`, optionally on a `step`; when
 *                  `choices` is also given the number must be one of them.
 *  - `set`         a subset of `choices` (or of the list `choicesRef` names),
 *                  with `immovable` members that can never be removed.
 *  - `text`        a string of at most `maxLength` characters.
 *  - `textList`    a list of such strings.
 *  - `numberList`  exactly `length` numbers, each inside `bounds`, and
 *                  non-decreasing when `nonDecreasing` is set.
 *  - `datetime`    an ISO instant, or null for "none".
 *  - `info`        a read-only row: shown with its shipped value, never
 *                  written. Always `locked` or env-protected.
 */
export type SettingType =
  | "switch"
  | "choice"
  | "number"
  | "set"
  | "text"
  | "textList"
  | "numberList"
  | "datetime"
  | "info";

/**
 * Whether a change may go in either direction.
 *
 * `raise-only` accepts a value at or above the current one (a minimum age
 * can go up, never down). `tighten-only` accepts a value at or below the
 * current one — every tighten-only row today is a number where smaller is
 * stricter (attempts per minute, a PIN window, a retention window), so
 * "tighter" means "lower" and the validator says so in one place.
 */
export type Direction = "free" | "raise-only" | "tighten-only";

/**
 * Who may change the row.
 *
 *  - `free`          the control centre, after confirmation.
 *  - `{ env }`       the named environment variable wins while it is set;
 *                    the row is shown locked with that reason. Env is the
 *                    permanent escape hatch (spec §2, principle 2).
 *  - `locked`        never writable. Listed under Protected with its reason.
 *  - `new`           nothing in KeyLearn enforces this yet. Shown, but a
 *                    write is refused until the enforcement lands, because
 *                    the page must never display a value it is not applying.
 */
export type Protection = "free" | { readonly env: string } | "locked" | "new";

export type Bounds = {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly unit?: string;
};

/** Lists that live elsewhere and are supplied to the validator at run time. */
export type ChoicesRef = "siteLocales" | "typingLanguages";

export type SettingDef = {
  /** Dotted, stable, never renamed: "pages.kids.state". */
  readonly key: string;
  readonly section: SectionId;
  /** Short human label for the row; the page and the audit line use it. */
  readonly label: string;
  readonly type: SettingType;
  /**
   * One line under the label saying what the row does.
   *
   * Deliberately not `warning` and not `reason`: those answer "what should
   * I think about before changing this?" and "why can I not change this?",
   * and a row that has neither used to show nothing at all. The text lives
   * in `descriptions.ts` and is attached here when the registry is built,
   * so the prose is written and reviewed in one place.
   */
  readonly description?: string;
  /**
   * The shipped value. Where the enforcing code exports its constant the
   * contract test in the server package asserts the two are equal, so this
   * cannot drift from what the code actually does.
   */
  readonly default: unknown;
  readonly choices?: readonly (string | number)[];
  readonly choicesRef?: ChoicesRef;
  /** Members of a `set` that can never be removed ("en" is always on). */
  readonly immovable?: readonly string[];
  readonly bounds?: Bounds;
  readonly maxLength?: number;
  /** For `numberList`: the exact number of entries. */
  readonly length?: number;
  readonly nonDecreasing?: boolean;
  readonly direction: Direction;
  readonly protection: Protection;
  /** Drives the confirmation wording on the page. */
  readonly impact?: "hides" | "refuses" | "tunes";
  /** The row's own warning, shown in the confirmation dialog. */
  readonly warning?: string;
  /** Why a locked row is locked; shown under Protected. */
  readonly reason?: string;
  /**
   * Where the code that must read this key lives, from the registry
   * document. Informational; the contract test checks the path exists.
   */
  readonly enforcedAt?: string;
  /**
   * How to read the env override, when the variable's spelling differs from
   * the stored value (MULTIPLAYER_ENABLED=false means state "404"). Absent
   * means the default parse for the type: "true"/"false" for a switch, a
   * number for a number, the raw string for a choice or text.
   */
  readonly envParse?: (raw: string) => unknown;
  /**
   * For a learner-override row (phase 3.4): the learner default it governs.
   * The page shows such rows beside their base row, not as a row of their own.
   */
  readonly overrideOf?: string;
};
