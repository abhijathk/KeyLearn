import { type Player, type PlayerList } from "@keylearn/multiplayer-shared";
import { UserName } from "@keylearn/pages-shared";
import { withDeferred } from "@keylearn/widget";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { Face } from "./Face.tsx";
import { FlagIcon } from "./image/icons.tsx";
import * as styles from "./Rails.module.less";

/**
 * Progress as one rail per player.
 *
 * The cars are gone. A rail with a glowing leading dot is the same figure the
 * profile page already uses for a learner's progress towards their goal, so
 * anyone who has seen the rest of the app reads this without being taught it —
 * and unlike a car it stays legible at any width and says exactly how far along
 * somebody is rather than approximately.
 */
export const Rails = memo(function Rails({
  players: { all, me },
}: {
  readonly players: PlayerList;
}): ReactNode {
  return (
    <div className={styles.root}>
      {order(all, me).map((player) => (
        <Rail key={player.id} player={player} me={me} />
      ))}
    </div>
  );
});

export const DeferredRails = withDeferred(Rails);

function Rail({
  player,
  me,
}: {
  readonly player: Player;
  readonly me: Player;
}): ReactNode {
  const { progress, speed, finished } = player;
  const mine = player.id === me.id;
  // Clamped because a late progress message can arrive after the finish.
  const at = Math.max(0, Math.min(100, progress));
  return (
    <div className={clsx(styles.rail, mine && styles.mine)}>
      <span className={styles.who}>
        <Face player={player} me={me} />
        <b>
          <UserName user={player.user} />
        </b>
        {mine && (
          <i className={styles.tag}>
            <FormattedMessage id="multiplayer.rail.you" defaultMessage="you" />
          </i>
        )}
        {finished && <FlagIcon className={styles.finished} />}
      </span>
      <span className={styles.track}>
        <span className={styles.base} />
        <span className={styles.done} style={{ inlineSize: `${at}%` }} />
        <span className={styles.dot} style={{ insetInlineStart: `${at}%` }} />
      </span>
      <span className={styles.speed}>
        {speed > 0 ? Math.round(speed) : "—"}
        <em>
          <FormattedMessage id="multiplayer.rail.wpm" defaultMessage="wpm" />
        </em>
      </span>
    </div>
  );
}

/**
 * Leader first, and you kept in place rather than sorted around.
 *
 * The old track put you on the bottom lane always. Sorting purely by progress
 * reads better — you can see who is within reach — but rows that swap while you
 * are reading them are worse than useless, so ties keep their existing order
 * by joining time.
 */
function order(all: readonly Player[], me: Player): readonly Player[] {
  return [...all].sort((a, b) => {
    if (b.progress !== a.progress) {
      return b.progress - a.progress;
    }
    if (a.id === me.id) {
      return -1;
    }
    if (b.id === me.id) {
      return +1;
    }
    return a.id - b.id;
  });
}
