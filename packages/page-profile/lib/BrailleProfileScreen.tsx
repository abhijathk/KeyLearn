import { brailleStats, practiceDays } from "@keylearn/braille";
import { Screen } from "@keylearn/pages-shared";
import { type ReactNode, useMemo } from "react";
import { BrailleProfile } from "./profile/BrailleProfile.tsx";
import { ShareDialog,type ShareFacts } from "./report/ShareDialog.tsx";

/**
 * The braille profile, in the same shell the typing profile uses.
 *
 * Wrapped here rather than at the call site so both branches of the profile
 * page arrive inside the same `Screen` — same width, same margins, same
 * entrance motion — and the only thing that changes between a sighted learner
 * and a braille one is what is written inside it.
 */
export function BrailleProfileScreen({
  profileId,
  name,
  avatar,
  kid = false,
}: {
  readonly profileId: string;
  readonly name: string;
  /**
   * The learner's avatar, rendered by the caller.
   *
   * A node rather than the avatar data: the component that draws one lives
   * with the profile screens, and the charts have no business depending on
   * them. The typing profile gets its own the same way, through the results
   * context — this page has no results, so it is a prop.
   */
  readonly avatar?: ReactNode;
  /** Which card the share window offers — the profile's own setting, nothing
   * inferred from the fact that this learner uses braille. */
  readonly kid?: boolean;
}): ReactNode {
  const facts = useMemo(
    () => brailleShareFacts(profileId, name, kid),
    [profileId, name, kid],
  );
  return (
    <Screen>
      <BrailleProfile profileId={profileId} name={name} avatar={avatar} />
      <ShareDialog facts={facts} />
    </Screen>
  );
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * A braille learner's progress, reduced to the same figures as anybody else's.
 *
 * There is no speed or accuracy here because the braille curriculum has no
 * figure comparable to words per minute, and inventing one to fill the card
 * would be worse than leaving the space empty. Nothing that could identify how
 * this learner works reaches the card — {@link ShareFacts} has no field that
 * could carry it.
 */
function brailleShareFacts(
  profileId: string,
  name: string,
  kid: boolean,
): ShareFacts {
  const stats = brailleStats(profileId);
  const days = practiceDays(profileId);
  const times = days
    .map((d) => Date.parse(d))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const span =
    times.length > 1 ? (times[times.length - 1] - times[0]) / DAY / 7 : 0;
  return {
    name,
    kid,
    letters: stats.learned,
    alphabet: stats.totalCells,
    daysPractised: days.length,
    weeks: days.length === 0 ? 0 : Math.max(1, Math.ceil(span)),
    lessons: stats.hits,
    wpm: null,
    accuracy: null,
    best: null,
    points: [],
  };
}
