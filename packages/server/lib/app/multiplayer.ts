import { Env } from "@keylearn/config";

/**
 * Whether multiplayer is switched on.
 *
 * One reader for one flag. Before this, `MULTIPLAYER_ENABLED=false` hid only
 * the menu link: the page, the sitemap entry and the game socket all stayed
 * reachable by URL, so "off" was a matter of not being told the address. Now
 * every surface asks the same question, and off means the URL is gone too.
 *
 * Read live rather than cached at boot, so a test can flip it per case and
 * so the control centre can drive it later (spec phase 1.3) without a restart.
 */
export function multiplayerEnabled(): boolean {
  return Env.getBoolean("MULTIPLAYER_ENABLED", false);
}
