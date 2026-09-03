import { siteNumber, siteSwitch } from "@keylearn/site-config";

/**
 * The site policy around the sponsor slot, read live from the control
 * centre (spec §4, phase 4).
 *
 * Campaigns themselves are database rows, not settings — what lives in the
 * registry is the policy an admin needs to reach without opening any one
 * campaign, above all the single switch that stops all of them.
 */

/** The master switch. Off means no campaign runs, whatever its dates say. */
export function adsEnabled(): boolean {
  return siteSwitch("ads.enabled");
}

/** How long one screen holds before the bar rotates to the next. */
export function adDwellSeconds(): number {
  return siteNumber("ads.dwellSeconds");
}

/** How many campaigns may share the bar at once. */
export function adMaxRotation(): number {
  return siteNumber("ads.maxRotation");
}

/** Whether a signed-out visitor sees the line. Never a signed-out child. */
export function adsShowToGuests(): boolean {
  return siteSwitch("ads.showToGuests");
}
