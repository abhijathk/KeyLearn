import { Pages } from "@keylearn/pages-shared";
import { Button, TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, useParams } from "react-router";
import { ReplyBody } from "./ReplyBody.tsx";
import { SupportService, type ThreadView } from "./service.ts";
import * as styles from "./SupportThreadPage.module.less";

/**
 * The customer's own view of their support conversation — the page our
 * emails link to. Laid out as a chat, not a form: their messages on the
 * right, ours on the left, bubbles only as wide as their text, because
 * that's the shape everybody already knows how to read.
 *
 * Reached by an unguessable token in the URL rather than a sign-in, so a
 * signed-out guest can follow the conversation from their inbox. That
 * makes the token the credential: nothing here shows anything the person
 * didn't already write or receive.
 */
export function SupportThreadPage(): ReactNode {
  const { token = "" } = useParams<{ token: string }>();
  const { formatMessage } = useIntl();

  const [state, setState] = useState<
    | { readonly kind: "loading" }
    | { readonly kind: "pending" }
    | { readonly kind: "gone" }
    | { readonly kind: "missing" }
    | { readonly kind: "ready"; readonly thread: ThreadView }
  >({ kind: "loading" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    SupportService.getThread(token)
      .then((r) => {
        if (!live) {
          return;
        }
        if (r.pending === true) {
          setState({ kind: "pending" });
        } else if (r.ticket != null) {
          setState({ kind: "ready", thread: r.ticket });
        } else {
          setState({ kind: "missing" });
        }
      })
      .catch((err: unknown) => {
        if (live) {
          setState({
            kind:
              err instanceof Error && err.message.includes("410")
                ? "gone"
                : "missing",
          });
        }
      });
    return () => {
      live = false;
    };
  }, [token]);

  // Land on the newest message, the way opening a chat does.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state]);

  if (state.kind === "loading") {
    return null;
  }

  if (state.kind === "pending") {
    return (
      <Shell>
        <p className={styles.notice}>
          <FormattedMessage
            id="supportThread.pending"
            defaultMessage="Check your email and follow the confirmation link — the conversation opens once you do. It’s how we make sure the address is really yours."
          />
        </p>
      </Shell>
    );
  }

  if (state.kind === "gone") {
    return (
      <Shell>
        <p className={styles.notice}>
          <FormattedMessage
            id="supportThread.expired"
            defaultMessage="This conversation was closed a while ago and is no longer available. Start a new one and we’ll pick it up from there."
          />
        </p>
        <RouterLink to={Pages.support.path} className={styles.newLink}>
          <FormattedMessage
            id="supportThread.startNew"
            defaultMessage="Send a new message"
          />
        </RouterLink>
      </Shell>
    );
  }

  if (state.kind === "missing") {
    return (
      <Shell>
        <p className={styles.notice}>
          <FormattedMessage
            id="supportThread.missing"
            defaultMessage="We couldn’t find that conversation. The link may have been replaced by a newer one — check the most recent email we sent you."
          />
        </p>
      </Shell>
    );
  }

  const { thread } = state;
  const closed = thread.status === "closed";

  const send = () => {
    const message = reply.trim();
    if (message === "" || busy) {
      return;
    }
    setBusy(true);
    SupportService.replyToThread(token, message)
      .then((r) => {
        if (r.ticket != null) {
          setState({ kind: "ready", thread: r.ticket });
          setReply("");
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <Shell subject={thread.subject}>
      <div className={styles.chat}>
        {/* No separate bubble for `thread.message`: unlike QDesk, this
            side also stores the opening message as a `them` row, so the
            list below already contains it. */}
        {thread.messages.map((m) => (
          <Bubble
            key={m.id}
            mine={m.sender === "them"}
            body={m.body}
            at={m.createdAt}
            from={m.sender === "them" ? null : (m.authorName ?? null)}
            system={m.sender === "system"}
          />
        ))}
        <div ref={endRef} />
      </div>

      {closed ? (
        <p className={styles.closed}>
          <FormattedMessage
            id="supportThread.closed"
            defaultMessage="This conversation is resolved, so it can’t be replied to. If something else comes up, send a new message — you can quote this ticket’s number and we’ll pick up the history."
          />
        </p>
      ) : null}

      {closed ? null : (
        <div className={styles.composer}>
          <span className={styles.field}>
            <TextField
              value={reply}
              placeholder={formatMessage({
                id: "supportThread.placeholder",
                defaultMessage: "Write a reply…",
              })}
              onChange={setReply}
            />
          </span>
          <Button
            label={formatMessage({
              id: "supportThread.send",
              defaultMessage: "Send",
            })}
            disabled={busy || reply.trim() === ""}
            onClick={send}
          />
        </div>
      )}
    </Shell>
  );
}

function Shell({
  subject,
  children,
}: {
  readonly subject?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        {subject ?? (
          <FormattedMessage
            id="supportThread.title"
            defaultMessage="Your conversation"
          />
        )}
      </h1>
      {children}
    </div>
  );
}

/**
 * One message. `mine` puts it on the right in the accent colour — the
 * arrangement every chat app uses, so nobody has to learn it here.
 */
function Bubble({
  mine,
  body,
  at,
  from = null,
  system = false,
}: {
  readonly mine: boolean;
  readonly body: string;
  readonly at: string;
  readonly from?: string | null;
  readonly system?: boolean;
}): ReactNode {
  if (system) {
    return <p className={styles.system}>{body}</p>;
  }
  return (
    <div className={mine ? styles.mine : styles.theirs}>
      {from != null && <span className={styles.from}>{from}</span>}
      {/* Same split as the in-app thread: the desk's replies render their
          paths and steps; the customer's own words stay exactly as they
          typed them. A <div> because a path rail and a step list are block
          elements, and a <p> may not contain them. */}
      {mine ? (
        <p className={styles.body}>{body}</p>
      ) : (
        <div className={styles.body}>
          <ReplyBody text={body} />
        </div>
      )}
      <span className={styles.at}>
        {new Date(at).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
