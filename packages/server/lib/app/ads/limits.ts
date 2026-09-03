import { ApplicationError } from "@fastr/errors";
/**
 * The limits the advertiser pack publishes, in one place.
 *
 * The document an advertiser is sent, the composer in the control centre
 * and this validator all quote the same numbers, and they quote them from
 * here so a change to what we promise cannot leave the server accepting
 * something different. Every figure is a character count, not a byte count:
 * an accented name must not cost an advertiser two of its allowance.
 */
export const AD_LIMITS = {
  advertiser: 32,
  headline: 70,
  support: 90,
  button: 18,
  code: 16,
  /** Chips on the feature-list template. */
  chip: 14,
  screensPerCampaign: 3,
  reportRecipients: 3,
} as const;

/** The layout families a screen may use, as named in the advertiser pack. */
export const AD_TEMPLATES = [
  "offer",
  "logo",
  "sponsor",
  "ends",
  "cause",
  "house",
] as const;

/**
 * Wording we do not run, checked before a person ever sees the campaign.
 *
 * This is a first pass, not the policy: every campaign is read by a member
 * of staff before it is scheduled, and the published rules refuse far more
 * than a word list can catch. What this does is stop the obvious cases at
 * the door and put the reason in front of whoever is composing, so nothing
 * discriminatory or sexual reaches the approval queue at all.
 */
const REFUSED_WORDS = [
  "casino",
  "betting",
  "gamble",
  "gambling",
  "vape",
  "vaping",
  "e-cigarette",
  "weight loss",
  "slimming",
  "crypto",
  "forex",
  "payday loan",
  "sexy",
  "escort",
  "xxx",
  "viagra",
];

/**
 * A campaign refused for a published reason.
 *
 * A real 4xx rather than the 200-with-a-body an `ApplicationError` defaults
 * to, because the desk's bridge reads the status to tell "they said no"
 * from "they answered": a refusal at 200 would be filed as a success and
 * the composer would never show the sentence. `field` names the box the
 * message belongs beside.
 */
export class AdRefused extends ApplicationError {
  constructor(field: string, message: string) {
    super(message, { status: 400, body: { error: { message, field } } });
  }
}

export type AdTextProblem = { readonly field: string; readonly reason: string };

/** Returns the reason a piece of copy is refused, or null when it passes. */
export function checkAdText(
  field: string,
  value: string,
): AdTextProblem | null {
  const lower = value.toLowerCase();
  for (const word of REFUSED_WORDS) {
    if (lower.includes(word)) {
      return {
        field,
        reason: `"${word}" is on the refused list. See the advertising policy for the categories we do not run.`,
      };
    }
  }
  // Shouting is a design decision an advertiser does not get to make: the
  // bar is a line of the page's own type, and full capitals in it read as
  // an alert from us rather than a paid message.
  const letters = value.replace(/[^a-z]/gi, "");
  if (letters.length >= 8 && letters === letters.toUpperCase()) {
    return {
      field,
      reason:
        "Written in capitals. Use sentence case; the bar is not a banner.",
    };
  }
  return null;
}
