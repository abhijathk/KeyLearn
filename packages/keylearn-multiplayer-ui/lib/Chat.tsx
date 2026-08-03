import {
  CHAT_SAY_ID,
  type ChatLine,
  type ChatNotice,
  type ClientMessage,
  type PlayerList,
  type ServerMessage,
} from "@keylearn/multiplayer-shared";
import { UserName } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Chat.module.less";
import { Face } from "./Face.tsx";
import {
  FlagIcon,
  LoopIcon,
  RiseIcon,
  SendIcon,
  SparkIcon,
} from "./image/icons.tsx";
import { type Transport } from "./transport.ts";

/** As long as a message may be. Chat is for a sentence, not an essay. */
const MAX = 140;

/**
 * The room's conversation.
 *
 * Every judgement about what may be said is made on the server; this only draws
 * the result. Blurred spans arrive as offsets and are rendered with a CSS blur
 * that cannot be selected or copied — and deliberately cannot be revealed
 * either, because a reveal control turns a censored word into a game.
 *
 * The quick phrases are the icon set rather than emoji: a closed palette cannot
 * be abusive, needs no filtering at all, and lets somebody who types slowly
 * still take part without falling behind the race.
 */
export const Chat = memo(function Chat({
  transport,
  players,
  chat,
  notice,
}: {
  readonly transport: Transport<ServerMessage, ClientMessage>;
  readonly players: PlayerList;
  readonly chat: readonly ChatLine[];
  readonly notice: ChatNotice | null;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  // Follow the conversation, the way a chat pane should.
  useEffect(() => {
    const el = log.current;
    if (el != null) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.length]);

  const muted = notice != null && notice.untilMs > Date.now();

  const send = () => {
    const text = draft.trim();
    if (text === "" || muted) {
      return;
    }
    transport.send({ type: CHAT_SAY_ID, text });
    setDraft("");
  };

  const nameOf = (playerId: number) => {
    const player = players.all.find(({ id }) => id === playerId);
    return player != null ? <UserName user={player.user} /> : null;
  };

  return (
    <div className={styles.root}>
      <span className={styles.label}>
        <FormattedMessage
          id="multiplayer.chat.title"
          defaultMessage="Room chat"
        />
      </span>

      <div className={styles.log} ref={log}>
        {chat.map((line) => {
          const player = players.all.find(({ id }) => id === line.playerId);
          return (
            <div key={line.id} className={styles.line}>
              {player != null && (
                <Face player={player} me={players.me} small={true} />
              )}
              <span className={styles.body}>
                <span className={styles.who}>{nameOf(line.playerId)}</span>
                <span className={styles.text}>
                  <Blurred text={line.text} spans={line.blurred} />
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {notice != null && <Notice notice={notice} />}

      {/*
        A closed palette, and the reason there is one: a fixed set cannot be
        abusive, so it needs no filtering at all — and it lets somebody who
        types slowly take part without falling behind the race.
      */}
      <div className={styles.quick}>
        {[
          {
            key: "nice",
            Icon: SparkIcon,
            text: formatMessage({
              id: "multiplayer.chat.nice",
              defaultMessage: "nice",
            }),
          },
          {
            key: "wellDone",
            Icon: FlagIcon,
            text: formatMessage({
              id: "multiplayer.chat.wellDone",
              defaultMessage: "well done",
            }),
          },
          {
            key: "goOn",
            Icon: RiseIcon,
            text: formatMessage({
              id: "multiplayer.chat.goOn",
              defaultMessage: "go on",
            }),
          },
          {
            key: "again",
            Icon: LoopIcon,
            text: formatMessage({
              id: "multiplayer.chat.again",
              defaultMessage: "again?",
            }),
          },
        ].map(({ key, Icon, text }) => (
          <button
            key={key}
            type="button"
            className={styles.chip}
            disabled={muted}
            onClick={() => transport.send({ type: CHAT_SAY_ID, text })}
          >
            <Icon className={styles.chipIcon} />
            {text}
          </button>
        ))}
      </div>

      <div className={clsx(styles.composer, muted && styles.composerOff)}>
        <input
          className={styles.input}
          value={draft}
          maxLength={MAX}
          disabled={muted}
          placeholder={formatMessage({
            id: "multiplayer.chat.placeholder",
            defaultMessage: "Say something kind…",
          })}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              send();
            }
            // The race is behind this input. Without this, every keystroke
            // meant for the chat would also be read as typing.
            ev.stopPropagation();
          }}
        />
        <button
          type="button"
          className={styles.send}
          disabled={muted || draft.trim() === ""}
          onClick={send}
          title={formatMessage({
            id: "multiplayer.chat.send",
            defaultMessage: "Send",
          })}
        >
          <SendIcon className={styles.sendIcon} />
        </button>
      </div>
    </div>
  );
});

/**
 * A message with the server's blurred spans drawn.
 *
 * No reveal, and no selecting: the span is there so the sentence still reads,
 * not so the word can be recovered.
 */
function Blurred({
  text,
  spans,
}: {
  readonly text: string;
  readonly spans: readonly (readonly [number, number])[];
}): ReactNode {
  if (spans.length === 0) {
    return text;
  }
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (start > at) {
      parts.push(text.slice(at, start));
    }
    parts.push(
      <span key={start} className={styles.blur} aria-hidden={true}>
        {text.slice(start, end)}
      </span>,
    );
    at = end;
  }
  if (at < text.length) {
    parts.push(text.slice(at));
  }
  return parts;
}

/** What the server has told this player, and nobody else. */
function Notice({ notice }: { readonly notice: ChatNotice }): ReactNode {
  const left = Math.max(0, Math.ceil((notice.untilMs - Date.now()) / 60_000));
  switch (notice.kind) {
    case "warn":
      return (
        <p className={clsx(styles.notice, styles.noticeWarn)}>
          <FormattedMessage
            id="multiplayer.chat.warn"
            defaultMessage="Let’s keep it friendly — that message was not sent. One more and chat pauses for a while."
          />
        </p>
      );
    case "mute":
      return (
        <p className={clsx(styles.notice, styles.noticeStop)}>
          <FormattedMessage
            id="multiplayer.chat.muted"
            defaultMessage="Chat is paused for {minutes} more {minutes, plural, one {minute} other {minutes}}. You can carry on typing."
            values={{ minutes: left }}
          />
        </p>
      );
    case "blocked":
      return (
        <p className={clsx(styles.notice, styles.noticeStop)}>
          <FormattedMessage
            id="multiplayer.chat.blocked"
            defaultMessage="Live practice is closed for now. Your profile and solo practice are untouched."
          />
        </p>
      );
    case "slowdown":
      return (
        <p className={styles.notice}>
          <FormattedMessage
            id="multiplayer.chat.slowdown"
            defaultMessage="Steady on — give the room a moment to keep up."
          />
        </p>
      );
    default:
      return null;
  }
}
