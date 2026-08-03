import { type Player } from "@keylearn/multiplayer-shared";
import { Avatar } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import * as styles from "./Face.module.less";

/**
 * One player's avatar, marked when it is you.
 *
 * The ring is the only thing that says "this row is yours" once names can be
 * pseudonyms — with everyone hidden behind a made-up name, position in the list
 * is no longer enough to find yourself.
 */
export const Face = memo(function Face({
  player,
  me,
  small = false,
}: {
  readonly player: Player;
  readonly me: Player;
  readonly small?: boolean;
}): ReactNode {
  return (
    <Avatar
      user={player.user}
      className={clsx(
        styles.face,
        small && styles.small,
        player.id === me.id && styles.me,
      )}
    />
  );
});
