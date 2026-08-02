import { Screen } from "@keybr/pages-shared";
import { type ReactNode } from "react";
import { BrailleProfile } from "./profile/BrailleProfile.tsx";

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
}): ReactNode {
  return (
    <Screen>
      <BrailleProfile profileId={profileId} name={name} avatar={avatar} />
    </Screen>
  );
}
