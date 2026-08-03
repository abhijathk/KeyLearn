import { GameState, type PlayerList } from "@keylearn/multiplayer-shared";
import { memo, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./Countdown.module.less";
import { Face } from "./Face.tsx";

/** Where the countdown starts, so the ring knows how much to deplete. */
const FROM = 3;
const R = 45;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * The band above the passage while a race is being set up.
 *
 * The count itself has always come from the server — it was simply folded into
 * a sentence, so the only thing the page could do with it was print it. Drawn
 * as a depleting ring it says the same thing without being read, which is what
 * you want in the two seconds before you start typing.
 *
 * Rendered before every round rather than only the first, so the room is never
 * looking at a still screen wondering whether it has broken.
 */
export const Countdown = memo(function Countdown({
  gameState,
  countDown,
  players,
}: {
  readonly gameState: GameState;
  readonly countDown: number;
  readonly players: PlayerList;
}): ReactNode {
  if (gameState !== GameState.STARTING && gameState !== GameState.WAITING) {
    return null;
  }
  const waiting = gameState === GameState.WAITING;
  // A full ring while we wait for company, then depleting once the count runs.
  const left = waiting ? 1 : Math.max(0, Math.min(1, countDown / FROM));
  return (
    <div className={styles.root}>
      <div className={styles.ring}>
        <svg viewBox="0 0 100 100" aria-hidden={true}>
          <circle className={styles.track} cx="50" cy="50" r={R} />
          {!waiting && (
            <circle
              className={styles.arc}
              cx="50"
              cy="50"
              r={R}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - left)}
            />
          )}
        </svg>
        <span className={styles.number}>
          {waiting ? (
            <span className={styles.dots} aria-hidden={true}>
              ···
            </span>
          ) : (
            countDown
          )}
        </span>
      </div>
      <div className={styles.text}>
        <b>
          {waiting ? (
            <FormattedMessage
              id="multiplayer.countdown.waiting"
              defaultMessage="Waiting for others"
            />
          ) : (
            <FormattedMessage
              id="multiplayer.countdown.ready"
              defaultMessage="Get ready"
            />
          )}
        </b>
        <em>
          <FormattedMessage
            id="multiplayer.countdown.players"
            defaultMessage="{count, plural, one {# person here} other {# people here}}"
            values={{ count: players.all.length }}
          />
        </em>
        <span className={styles.faces}>
          {players.all.map((player) => (
            <Face
              key={player.id}
              player={player}
              me={players.me}
              small={true}
            />
          ))}
        </span>
      </div>
    </div>
  );
});
