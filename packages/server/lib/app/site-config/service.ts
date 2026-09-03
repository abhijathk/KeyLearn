import { ApplicationError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { adminEmails, Env } from "@keylearn/config";
import {
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
  User,
} from "@keylearn/database";
import { allLocales } from "@keylearn/intl";
import { Language } from "@keylearn/keyboard";
import { Logger } from "@keylearn/logger";
import {
  type ChoicesRef,
  effectiveValue,
  envSetFor,
  type RefusalCode,
  REGISTRY,
  type SettingDef,
  settingDef,
  validateChange,
  type ValueSource,
  type Verdict,
  writability,
} from "@keylearn/site-config";
import { Mailer } from "../mail/index.ts";
import { refreshSiteConfigCache, siteConfigRefreshSeconds } from "./cache.ts";
import { isWired } from "./wired.ts";

/** One row as the control centre sees it. */
export type SiteConfigEntry = {
  readonly key: string;
  readonly section: SettingDef["section"];
  readonly label: string;
  readonly type: SettingDef["type"];
  readonly default: unknown;
  readonly choices: readonly (string | number)[] | null;
  readonly immovable: readonly string[] | null;
  readonly bounds: SettingDef["bounds"] | null;
  readonly maxLength: number | null;
  readonly length: number | null;
  readonly direction: SettingDef["direction"];
  readonly protection: "free" | "env" | "locked" | "new";
  readonly env: string | null;
  readonly impact: SettingDef["impact"] | null;
  /** One line saying what the row does; see site-config/descriptions.ts. */
  readonly description: string | null;
  readonly warning: string | null;
  readonly reason: string | null;
  readonly enforcedAt: string | null;
  /** The value in force right now. */
  readonly value: unknown;
  readonly source: ValueSource;
  /** Null when the row can be written; otherwise why not, as the page shows it. */
  readonly locked: {
    readonly code: RefusalCode;
    readonly message: string;
  } | null;
  readonly updatedAt: string | null;
  readonly updatedBy: number | null;
  /**
   * True when a release moved the shipped default after this value was
   * written: the admin's value still wins, and the Defaults section
   * flags the row (spec 1.10).
   */
  readonly driftedDefault: boolean;
  /**
   * True when the stored value lies outside the registry bounds — an
   * operations number tuned beyond bounds with a reason (phase 3.4).
   */
  readonly beyondBounds: boolean;
  /** For a learner-override row: the learner default it governs. */
  readonly overrideOf: string | null;
};

export type SiteConfigHistoryEntry = {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  /** `null` means "the shipped default". */
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly actorUserId: number | null;
  readonly actorName: string | null;
  readonly reason: string | null;
  readonly revertOf: number | null;
  readonly createdAt: string;
};

export type Actor = {
  /** The acting admin's KeyLearn user id, or null for a system change (a sweep, a used invite code). */
  readonly userId: number | null;
  readonly ip?: string | null;
  readonly reason?: string | null;
};

/** How a refusal code maps to an HTTP status. */
function statusFor(code: RefusalCode): number {
  switch (code) {
    case "unknown-key":
      return 404;
    case "read-only":
    case "locked":
    case "env":
    case "new":
    case "unwired":
      return 403;
    case "direction":
      return 409;
    default:
      return 400;
  }
}

/**
 * A refused change. Carries the registry's own code and sentence so the
 * page can show exactly why, and the status the code implies.
 */
export class SiteConfigRefused extends ApplicationError {
  constructor(key: string, code: RefusalCode, message: string) {
    super(message, {
      status: statusFor(code),
      body: { error: { message, code, key } },
    });
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Everything the control centre does to the site configuration, in one
 * place: describe the rows, change one, revert one, list the history. The
 * validator decides; this class only carries out what it allows, inside a
 * transaction, and refreshes this worker's cache so the caller can read
 * back what it just wrote without racing the timer.
 */
@injectable({ singleton: true })
export class SiteConfigService {
  constructor(readonly mailer: Mailer) {}

  readonly #choicesFor = (ref: ChoicesRef): readonly string[] => {
    switch (ref) {
      case "siteLocales":
        return allLocales;
      case "typingLanguages":
        return Language.ALL.map((language) => language.id);
    }
  };

  #context(def: SettingDef) {
    return {
      current: effectiveValue(def).value,
      envSet: (name: string) => process.env[name] != null,
      wired: isWired,
      choicesFor: this.#choicesFor,
    };
  }

  #def(key: string): SettingDef {
    const def = settingDef(key);
    if (def == null) {
      throw new SiteConfigRefused(
        key,
        "unknown-key",
        `"${key}" is not a site setting.`,
      );
    }
    return def;
  }

  /**
   * Whether premium can be sold: both Paddle keys set. `partial` is the
   * misconfiguration worth a warning at boot — one key without the other.
   */
  paddleStatus(): { configured: boolean; partial: boolean } {
    const api = Env.getString("PADDLE_API_KEY", "") !== "";
    const secret = Env.getString("PADDLE_SECRET_KEY", "") !== "";
    return { configured: api && secret, partial: api !== secret };
  }

  #entry(def: SettingDef, row: SiteConfig | null): SiteConfigEntry {
    const { value, source } = effectiveValue(def);
    let may = writability(def, this.#context(def));
    // Phase 3.3: the premium switch is enabled once the Paddle keys exist.
    // Until then the row is locked with that reason, so the page never
    // offers a switch that would refuse on touch.
    if (
      may.ok &&
      def.key === "premium.sell" &&
      value !== true &&
      !this.paddleStatus().configured
    ) {
      may = {
        ok: false,
        code: "env",
        message:
          "Sell premium turns on once PADDLE_API_KEY and PADDLE_SECRET_KEY are set in the environment.",
      };
    }
    const beyondBounds =
      def.type === "number" &&
      def.bounds != null &&
      typeof value === "number" &&
      (value < def.bounds.min || value > def.bounds.max);
    const choices =
      def.choicesRef != null
        ? this.#choicesFor(def.choicesRef)
        : (def.choices ?? null);
    return {
      key: def.key,
      section: def.section,
      label: def.label,
      type: def.type,
      default:
        def.type === "set" && def.default === "all" ? choices : def.default,
      choices,
      immovable: def.immovable ?? null,
      bounds: def.bounds ?? null,
      maxLength: def.maxLength ?? null,
      length: def.length ?? null,
      direction: def.direction,
      protection: typeof def.protection === "object" ? "env" : def.protection,
      env: typeof def.protection === "object" ? def.protection.env : null,
      impact: def.impact ?? null,
      description: def.description ?? null,
      warning: def.warning ?? null,
      reason: def.reason ?? null,
      enforcedAt: def.enforcedAt ?? null,
      value: def.type === "set" && value === "all" ? choices : value,
      source,
      locked: may.ok ? null : { code: may.code, message: may.message },
      updatedAt: row?.updatedAt != null ? row.updatedAt.toISOString() : null,
      updatedBy: row?.updatedBy ?? null,
      driftedDefault:
        row?.defaultAtWriteDecoded !== undefined &&
        !sameValue(row.defaultAtWriteDecoded, def.default),
      beyondBounds,
      overrideOf: def.overrideOf ?? null,
    };
  }

  /** The propagation window, for the status bar. */
  refreshSeconds(): number {
    return siteConfigRefreshSeconds();
  }

  /** Every row, with its live value and why it is locked if it is. */
  async describe(): Promise<SiteConfigEntry[]> {
    // Fresh from the table, so the desk always sees what is stored even if
    // this worker's timer has not ticked since another worker wrote.
    await refreshSiteConfigCache();
    const rows = new Map<string, SiteConfig>();
    for (const row of await SiteConfig.query()) {
      rows.set(row.key!, row);
    }
    return REGISTRY.map((def) => this.#entry(def, rows.get(def.key) ?? null));
  }

  async entry(key: string): Promise<SiteConfigEntry> {
    const def = this.#def(key);
    await refreshSiteConfigCache();
    return this.#entry(def, await SiteConfig.find(key));
  }

  /**
   * Changes one key. `value === undefined` means "back to the shipped
   * default", which removes the row. Returns the entry as it now stands and
   * the history row written, or `null` for the history when nothing
   * actually changed (the same value written twice is not a change).
   */
  async set(
    key: string,
    value: unknown,
    actor: Actor,
    revertOf: number | null = null,
    options: { readonly beyondBounds?: boolean } = {},
  ): Promise<{
    entry: SiteConfigEntry;
    history: SiteConfigHistoryEntry | null;
  }> {
    const def = this.#def(key);
    const target = value === undefined ? def.default : value;
    let verdict: Verdict;
    if (options.beyondBounds === true) {
      // Phase 3.4: operational tuning beyond bounds. Only an operations
      // number, only with a reason, and only up to a sanity ceiling — the
      // bounds are advice for a two-person team, not a law of physics, but
      // a retry window of a year is a typo, not a decision.
      verdict = this.#beyondBoundsVerdict(def, target, actor);
    } else {
      verdict = validateChange(def, target, this.#context(def));
    }
    // Premium refuses to turn on until the Paddle keys are set (spec §6.3):
    // a switch that sells nothing would only show a broken upgrade button.
    if (
      verdict.ok &&
      key === "premium.sell" &&
      verdict.value === true &&
      (Env.getString("PADDLE_API_KEY", "") === "" ||
        Env.getString("PADDLE_SECRET_KEY", "") === "")
    ) {
      verdict = {
        ok: false,
        code: "env",
        message:
          "Sell premium refuses to turn on until PADDLE_API_KEY and PADDLE_SECRET_KEY are set in the environment.",
      };
    }
    if (!verdict.ok) {
      void StaffAuditEvent.record({
        userId: actor.userId,
        action: "site-config-refused",
        detail: `${key}: ${verdict.code} (via ops app)`,
        ip: actor.ip ?? null,
      });
      throw new SiteConfigRefused(key, verdict.code, verdict.message);
    }

    const written = await SiteConfig.transaction(async (trx) => {
      const existing = await SiteConfig.find(key, trx);
      const oldValue = existing == null ? undefined : existing.decoded;
      const restoring = value === undefined;
      const newValue = restoring ? undefined : verdict.value;
      if (restoring ? existing == null : sameValue(oldValue, newValue)) {
        return null;
      }
      if (restoring) {
        await SiteConfig.remove(key, trx);
      } else {
        await SiteConfig.put(key, newValue, actor.userId, trx, def.default);
      }
      return await SiteConfigHistory.record(
        {
          key,
          oldValue,
          newValue,
          actorUserId: actor.userId,
          reason: actor.reason ?? null,
          revertOf,
        },
        trx,
      );
    });

    // This worker answers correctly straight away; the others follow on
    // their own timer, inside the promised window.
    await refreshSiteConfigCache();

    if (written != null) {
      void this.#notifyAdmins(def, written, actor);
      void StaffAuditEvent.record({
        userId: actor.userId,
        action:
          revertOf != null ? "site-config-reverted" : "site-config-changed",
        // The field, not the value: values may be sensitive, and the
        // history table has them anyway.
        detail: `${key}${value === undefined ? " → default" : ""} (via ops app)`,
        ip: actor.ip ?? null,
      });
    }

    return {
      entry: this.#entry(def, await SiteConfig.find(key)),
      history: written == null ? null : await this.#historyEntry(written),
    };
  }

  #beyondBoundsVerdict(
    def: SettingDef,
    target: unknown,
    actor: Actor,
  ): Verdict {
    if (
      def.section !== "ops" ||
      def.type !== "number" ||
      def.bounds == null ||
      def.choices != null
    ) {
      return {
        ok: false,
        code: "beyond",
        message: `${def.label} cannot be tuned beyond its bounds; only an operations number can.`,
      };
    }
    if (actor.reason == null || actor.reason.trim() === "") {
      return {
        ok: false,
        code: "reason",
        message: `Tuning ${def.label} beyond its bounds needs a reason.`,
      };
    }
    const { bounds } = def;
    const widened: SettingDef = {
      ...def,
      bounds: {
        min: Math.min(bounds.min, bounds.min > 0 ? 1 : 0),
        max: bounds.max * 100,
        unit: bounds.unit,
      },
    };
    return validateChange(widened, target, this.#context(def));
  }

  /**
   * Decision 5 (2 Sep 2026): every change emails the other admins at once
   * with who, what, from, to and a revert link; the admin who made the
   * change is not emailed. A system change (a sweep, a used invite code)
   * goes to every admin. Never throws into the write.
   */
  async #notifyAdmins(
    def: SettingDef,
    history: SiteConfigHistory,
    actor: Actor,
  ): Promise<void> {
    try {
      const actorUser =
        actor.userId != null ? await User.findById(actor.userId) : null;
      const actorEmail = actorUser?.email?.toLowerCase() ?? null;
      const who = actorUser?.name ?? actorUser?.email ?? "KeyLearn (automatic)";
      const recipients = adminEmails().filter((email) => email !== actorEmail);
      if (recipients.length === 0) {
        return;
      }
      const desk = Env.getString("QDESK_URL", "");
      const revertLink =
        desk === ""
          ? null
          : String(new URL(`/control-centre?revert=${history.id}`, desk));
      const message = messageSiteConfigChanged({
        label: def.label,
        key: def.key,
        who,
        when: new Date(history.createdAt ?? Date.now()).toISOString(),
        from:
          history.oldDecoded === undefined
            ? "the shipped default"
            : JSON.stringify(history.oldDecoded),
        to:
          history.newDecoded === undefined
            ? "the shipped default"
            : JSON.stringify(history.newDecoded),
        reason: history.reason ?? null,
        revertLink,
      });
      await Promise.all(
        recipients.map((to) =>
          this.mailer.sendMail({ ...message, to }).catch((err: any) => {
            Logger.warn(
              err,
              "Could not email an admin about a site setting change",
            );
          }),
        ),
      );
    } catch (err: any) {
      Logger.warn(err, "Admin change notification failed");
    }
  }

  /** Puts a key back to what it was before the given history row. */
  async revert(
    historyId: number,
    actor: Actor,
  ): Promise<{
    entry: SiteConfigEntry;
    history: SiteConfigHistoryEntry | null;
  }> {
    const row = await SiteConfigHistory.findById(historyId);
    if (row == null) {
      throw new ApplicationError("That change is not in the history.", {
        status: 404,
        body: {
          error: {
            message: "That change is not in the history.",
            code: "unknown-history",
          },
        },
      });
    }
    return await this.set(row.key!, row.oldDecoded, actor, row.id!);
  }

  async history(limit = 100, key?: string): Promise<SiteConfigHistoryEntry[]> {
    const rows = await SiteConfigHistory.listRecent(limit, key);
    const actorIds = [
      ...new Set(rows.map((row) => row.actorUserId).filter((id) => id != null)),
    ];
    const names = new Map<number, string | null>();
    for (const id of actorIds) {
      const user = await User.findById(id!);
      names.set(id!, user?.name ?? null);
    }
    return rows.map((row) => this.#toHistoryEntry(row, names));
  }

  async #historyEntry(row: SiteConfigHistory): Promise<SiteConfigHistoryEntry> {
    const names = new Map<number, string | null>();
    if (row.actorUserId != null) {
      const user = await User.findById(row.actorUserId);
      names.set(row.actorUserId, user?.name ?? null);
    }
    return this.#toHistoryEntry(row, names);
  }

  #toHistoryEntry(
    row: SiteConfigHistory,
    names: ReadonlyMap<number, string | null>,
  ): SiteConfigHistoryEntry {
    const def = settingDef(row.key!);
    return {
      id: row.id!,
      key: row.key!,
      label: def?.label ?? row.key!,
      oldValue: row.oldDecoded === undefined ? null : row.oldDecoded,
      newValue: row.newDecoded === undefined ? null : row.newDecoded,
      actorUserId: row.actorUserId ?? null,
      actorName:
        row.actorUserId != null ? (names.get(row.actorUserId) ?? null) : null,
      reason: row.reason ?? null,
      revertOf: row.revertOf ?? null,
      createdAt: row.createdAt!.toISOString(),
    };
  }
}

/** Whether the env variable behind a row is set. Exported for the page's status bar. */
export function envOverrideCount(): number {
  return REGISTRY.filter((def) => envSetFor(def)).length;
}

/** The email the other admins get on every change (decision 5). */
export function messageSiteConfigChanged({
  label,
  key,
  who,
  when,
  from,
  to,
  reason,
  revertLink,
}: {
  readonly label: string;
  readonly key: string;
  readonly who: string;
  readonly when: string;
  readonly from: string;
  readonly to: string;
  readonly reason: string | null;
  readonly revertLink: string | null;
}): Omit<Mailer.Message, "to"> {
  const subject = `KeyLearn setting changed: ${label}`;
  const lines = [
    `${who} changed a KeyLearn site setting.`,
    ``,
    `Setting: ${label} (${key})`,
    `From: ${from}`,
    `To: ${to}`,
    `When: ${when}`,
    ...(reason != null ? [`Reason: ${reason}`] : []),
    ``,
    ...(revertLink != null
      ? [
          `To put it back in one click, open the control centre:`,
          revertLink,
          ``,
        ]
      : []),
    `You are getting this because you are a KeyLearn admin. Every change made in the control centre is sent to the other admins at once; the admin who made it is not emailed.`,
  ];
  const text = lines.join("\n");
  const esc = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<p>${esc(who)} changed a KeyLearn site setting.</p>` +
    `<table style="border-collapse:collapse">` +
    `<tr><td style="padding:2px 12px 2px 0;color:#687280">Setting</td><td>${esc(label)} <code>${esc(key)}</code></td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#687280">From</td><td>${esc(from)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#687280">To</td><td><b>${esc(to)}</b></td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#687280">When</td><td>${esc(when)}</td></tr>` +
    (reason != null
      ? `<tr><td style="padding:2px 12px 2px 0;color:#687280">Reason</td><td>${esc(reason)}</td></tr>`
      : "") +
    `</table>` +
    (revertLink != null
      ? `<p><a href="${esc(revertLink)}">Revert this change in the control centre</a></p>`
      : "") +
    `<p style="color:#687280;font-size:13px">You are getting this because you are a KeyLearn admin. Every change made in the control centre is sent to the other admins at once; the admin who made it is not emailed.</p>`;
  return { subject, text, html };
}
