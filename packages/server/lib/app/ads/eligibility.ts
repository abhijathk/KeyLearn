import { OrgMember, type User } from "@keylearn/database";
import { type AnyUser, isPremiumUser } from "@keylearn/pages-shared";
import { adsEnabled, adsShowToGuests } from "./readers.ts";

/**
 * Who may be shown a paid line, decided on the server.
 *
 * The rule is written here once and read by the feed, the view counter and
 * the click redirect alike, so a reader who is not allowed to see an ad
 * also cannot be counted for one or click through to one. Three of the
 * four tests have no off switch anywhere in the product:
 *
 *  - a child never sees advertising, on a child profile, in the kids world
 *    or under a school account;
 *  - a paying household never sees it, because ad-free is what they bought;
 *  - nothing is shown while a lesson is running.
 *
 * The first is finished in the browser as well, because which profile is
 * active is a client-side choice that never reaches this process; the
 * server closes the door a school account walks through, and the client
 * closes the one a child profile walks through. Both are needed: the
 * server cannot see the profile, and the client must not be trusted alone.
 */
/**
 * Both halves of the reader are needed, and neither would do alone.
 *
 * The row carries the numeric account id the organisation lookup needs;
 * whether a household is paying lives only on the public user, because it
 * is derived from an order rather than stored on the account. Reading the
 * row alone would quietly show advertising to every paying household,
 * which is the bug this signature exists to make impossible.
 */
export async function adsAllowed(
  user: User | null,
  publicUser: AnyUser,
): Promise<boolean> {
  if (!adsEnabled()) {
    return false;
  }
  if (user == null || user.id == null) {
    return adsShowToGuests();
  }
  if (isPremiumUser(publicUser)) {
    return false;
  }
  // A school account is a room full of children whichever seat is in use.
  const memberships = await OrgMember.membershipsFor(user.id);
  return memberships.length === 0;
}
