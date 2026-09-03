import { Env } from "@keylearn/config";
import { SiteConfig } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { setSiteConfigValues } from "@keylearn/site-config";

/**
 * Keeps each process's synchronous view of `site_config` in step with the
 * database. The same shape as the staff roster cache, for the same reasons:
 * the code that applies a setting must not await a query on every call, so
 * the values live in this process's memory, and this is what stops them
 * from being a snapshot of whatever was true when the process started.
 *
 * Started in every process — the workers, because they answer requests,
 * and the primary too, because the sweeps that run there read settings
 * (staff audit retention, for one). The interval is the propagation window
 * the control centre promises ("goes live within 30 seconds"); the page's
 * status bar reads it from `siteConfigRefreshSeconds()` rather than typing
 * the number, so the promise and the timer cannot drift (spec §12.7).
 */
export function siteConfigRefreshSeconds(): number {
  return Env.getNumber("SITE_CONFIG_REFRESH_SECONDS", 30);
}

let timer: NodeJS.Timeout | null = null;

/**
 * Loads the stored values once.
 *
 * A failure keeps the previous values in place rather than emptying them:
 * a database blip must not silently return every setting to its default,
 * and the next tick will pick the table up anyway. On the very first call
 * there is nothing previous, and every read keeps answering with the env
 * override or the shipped default until a load arrives — which is exactly
 * what a fresh install means.
 */
export async function refreshSiteConfigCache(): Promise<void> {
  try {
    setSiteConfigValues(await SiteConfig.all());
  } catch (err) {
    Logger.warn("site-config: could not refresh, keeping the last values", {
      err,
    });
  }
}

export function startSiteConfigCache(): void {
  if (timer != null) {
    return;
  }
  void refreshSiteConfigCache();
  timer = setInterval(
    () => void refreshSiteConfigCache(),
    siteConfigRefreshSeconds() * 1000,
  );
  // Never a reason to hold the process open.
  timer.unref?.();
}

export function stopSiteConfigCache(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
