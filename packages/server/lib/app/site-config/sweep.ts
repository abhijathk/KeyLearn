import { injectable } from "@fastr/invert";
import { SiteConfigHistory } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import {
  leaderboardOverrideUntil,
  maintenanceEnabled,
  maintenanceRevertAfter,
} from "./readers.ts";
import { SiteConfigService } from "./service.ts";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * The two settings that undo themselves: maintenance mode after its chosen
 * window, and the leaderboard override once its moment has passed. Both
 * revert as a system change in the history (actor null), so the trail
 * shows why the value moved and the other admins are emailed the same as
 * for a human change.
 *
 * Runs once a minute in the cluster's primary, like the other sweeps, and
 * takes an injectable clock so tests never sleep.
 */
@injectable({ singleton: true })
export class SiteConfigSweep {
  #timer: NodeJS.Timeout | null = null;

  constructor(readonly siteConfig: SiteConfigService) {}

  start(): void {
    if (this.#timer != null) {
      return;
    }
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, MINUTE_MS);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  async runOnce(
    now: number = Date.now(),
  ): Promise<{ maintenanceReverted: boolean; overrideExpired: boolean }> {
    const result = { maintenanceReverted: false, overrideExpired: false };
    try {
      result.maintenanceReverted = await this.#revertMaintenance(now);
    } catch (err: any) {
      Logger.warn(err, "Maintenance auto-revert failed");
    }
    try {
      result.overrideExpired = await this.#expireOverride(now);
    } catch (err: any) {
      Logger.warn(err, "Leaderboard override expiry failed");
    }
    return result;
  }

  /**
   * The window counts from the moment maintenance was switched on — the
   * latest history row that set it true — so changing "revert after" while
   * the site is down re-times the same start, and switching it off and on
   * again starts afresh.
   */
  async #revertMaintenance(now: number): Promise<boolean> {
    if (!maintenanceEnabled()) {
      return false;
    }
    const after = maintenanceRevertAfter();
    if (after === "never") {
      return false;
    }
    const rows = await SiteConfigHistory.listRecent(20, "maintenance.enabled");
    const switchedOn = rows.find((row) => row.newDecoded === true);
    if (switchedOn?.createdAt == null) {
      return false;
    }
    const since = new Date(switchedOn.createdAt).getTime();
    if (now < maintenanceDeadline(since, after)) {
      return false;
    }
    await this.siteConfig.set("maintenance.enabled", false, {
      userId: null,
      reason: `switched back on automatically (${describe(after)})`,
    });
    Logger.info("Maintenance mode reverted automatically");
    return true;
  }

  async #expireOverride(now: number): Promise<boolean> {
    const until = leaderboardOverrideUntil();
    if (until == null || until.getTime() > now) {
      return false;
    }
    await this.siteConfig.set("leaderboard.override.until", undefined, {
      userId: null,
      reason: "override expired",
    });
    Logger.info("Leaderboard override expired");
    return true;
  }
}

function describe(after: "1h" | "4h" | "tomorrow06"): string {
  switch (after) {
    case "1h":
      return "after 1 hour";
    case "4h":
      return "after 4 hours";
    case "tomorrow06":
      return "at 06:00";
  }
}

/** When a maintenance window that opened at `since` ends. */
export function maintenanceDeadline(
  since: number,
  after: "1h" | "4h" | "tomorrow06",
): number {
  switch (after) {
    case "1h":
      return since + HOUR_MS;
    case "4h":
      return since + 4 * HOUR_MS;
    case "tomorrow06": {
      // The next 06:00 in the server's local time after the switch-on; a
      // switch at 23:00 reverts seven hours later, one at 05:00 an hour later.
      const at = new Date(since);
      at.setHours(6, 0, 0, 0);
      if (at.getTime() <= since) {
        at.setDate(at.getDate() + 1);
      }
      return at.getTime();
    }
  }
}
