import { type AccountDeletionRequestDetails } from "@keylearn/pages-shared";
import { Button, FloatingShell } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useParams } from "react-router";
import * as styles from "./DeletionCancelPage.module.less";
import { SupportService } from "./service.ts";

type Screen =
  | "checking"
  | "not-found"
  | "pending"
  | "cancelled"
  | "already-cancelled";

/**
 * The account holder's own door into a staff-requested deletion — reached
 * only via the link in {@link messageAccountDeletionRequested}. Loading the
 * page just reads the request's status (safe for a mail client's own
 * link-prefetch); cancelling itself needs the explicit button click below,
 * a real POST — see `cancelAccountDeletionByToken` on the server.
 */
export function DeletionCancelPage(): ReactNode {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>("checking");
  const [request, setRequest] = useState<AccountDeletionRequestDetails | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token == null) {
      setScreen("not-found");
      return;
    }
    SupportService.getAccountDeletionByToken(token)
      .then((r) => {
        setRequest(r);
        setScreen(
          r.cancelledAt != null || r.completedAt != null
            ? "already-cancelled"
            : "pending",
        );
      })
      .catch(() => setScreen("not-found"));
  }, [token]);

  const cancel = () => {
    if (token == null) {
      return;
    }
    setBusy(true);
    SupportService.cancelAccountDeletionByToken(token)
      .then((r) => {
        setRequest(r);
        setScreen("cancelled");
      })
      .catch(() => setScreen("not-found"))
      .finally(() => setBusy(false));
  };

  return (
    <FloatingShell
      compact={true}
      width="30rem"
      hideClose={true}
      dismissible={false}
    >
      <div className={styles.body}>
        {screen === "checking" && (
          <p className={styles.intro}>
            <FormattedMessage
              id="deletionCancel.checking"
              defaultMessage="Checking…"
            />
          </p>
        )}
        {screen === "not-found" && (
          <>
            <h1 className={styles.headline}>
              <FormattedMessage
                id="deletionCancel.notFoundTitle"
                defaultMessage="Link no longer valid"
              />
            </h1>
            <p className={styles.intro}>
              <FormattedMessage
                id="deletionCancel.notFoundBody"
                defaultMessage="This link has expired or was already used. If you still need help, get in touch with KeyLearn support."
              />
            </p>
          </>
        )}
        {screen === "pending" && request != null && (
          <PendingScreen request={request} busy={busy} onCancel={cancel} />
        )}
        {screen === "cancelled" && (
          <>
            <h1 className={styles.headline}>
              <FormattedMessage
                id="deletionCancel.cancelledTitle"
                defaultMessage="Deletion cancelled"
              />
            </h1>
            <p className={styles.intro}>
              <FormattedMessage
                id="deletionCancel.cancelledBody"
                defaultMessage="Your account is safe — nothing has been deleted, and nothing further will happen."
              />
            </p>
          </>
        )}
        {screen === "already-cancelled" && (
          <>
            <h1 className={styles.headline}>
              <FormattedMessage
                id="deletionCancel.alreadyTitle"
                defaultMessage="Already taken care of"
              />
            </h1>
            <p className={styles.intro}>
              <FormattedMessage
                id="deletionCancel.alreadyBody"
                defaultMessage="This deletion isn’t pending any more — there’s nothing to cancel."
              />
            </p>
          </>
        )}
      </div>
    </FloatingShell>
  );
}

function PendingScreen({
  request,
  busy,
  onCancel,
}: {
  readonly request: AccountDeletionRequestDetails;
  readonly busy: boolean;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const when = new Date(request.executeAt).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
  return (
    <>
      <h1 className={styles.headline}>
        <FormattedMessage
          id="deletionCancel.pendingTitle"
          defaultMessage="Account deletion scheduled"
        />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="deletionCancel.pendingBody"
          defaultMessage="A member of KeyLearn support requested that this account be deleted, scheduled for {when}. If that wasn’t you, cancel it now."
          values={{ when: <b>{when}</b> }}
        />
      </p>
      <Button
        size="full"
        label={formatMessage({
          id: "deletionCancel.cancelButton",
          defaultMessage: "Cancel this deletion",
        })}
        disabled={busy}
        onClick={onCancel}
      />
    </>
  );
}
