import { ProfileAvatar } from "@keylearn/page-account";
import {
  ConfirmDialog,
  PinField,
  SettingsCard,
  TextField,
} from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Learners.module.less";
import { type Learner, type OrgOverview, OrgService } from "./service.ts";

/**
 * The learners pane.
 *
 * Two kinds of learner sit in this list and the difference is the whole
 * design, so it is on the surface rather than only in the resolver:
 *
 * - mode A, the school's own learner. No account behind them, a PIN
 *   instead, and the school may rename, re-PIN and unlock them.
 * - mode B, a family's child the family lent the school a view of. The
 *   school may end that view and nothing else — not the PIN, not the
 *   name, not the profile. It was never theirs.
 *
 * A staff member who cannot tell the two apart will eventually try to
 * "fix" a family's learner and be refused with no idea why.
 */
export function Learners({
  id,
  overview,
  learners,
  onChange,
}: {
  readonly id: number;
  readonly overview: OrgOverview;
  readonly learners: readonly Learner[];
  readonly onChange: () => void;
}): ReactNode {
  const byBatch = new Map<number | null, Learner[]>();
  for (const learner of learners) {
    const list = byBatch.get(learner.batchId) ?? [];
    list.push(learner);
    byBatch.set(learner.batchId, list);
  }

  return (
    <>
      {learners.length === 0 ? (
        <SettingsCard
          caption={
            <FormattedMessage id="learners.caption" defaultMessage="Learners" />
          }
        >
          <p className={styles.note}>
            <FormattedMessage
              id="learners.empty"
              defaultMessage="Nobody yet. Parents appear here as they accept their invites; a coaching centre that owns its learner places can add them directly below."
            />
          </p>
        </SettingsCard>
      ) : (
        overview.batches
          .filter((batch) => (byBatch.get(batch.id)?.length ?? 0) > 0)
          .map((batch) => (
            <SettingsCard key={batch.id} caption={batch.name}>
              {(byBatch.get(batch.id) ?? []).map((learner) => (
                <LearnerRow
                  key={learner.profileId}
                  id={id}
                  learner={learner}
                  onChange={onChange}
                />
              ))}
            </SettingsCard>
          ))
      )}
      <AddLearner id={id} overview={overview} onChange={onChange} />
    </>
  );
}

function LearnerRow({
  id,
  learner,
  onChange,
}: {
  readonly id: number;
  readonly learner: Learner;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pin, setPin] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolOwned = learner.mode === "A";

  const savePin = () => {
    if (pin == null || !/^\d{4,6}$/.test(pin)) {
      return;
    }
    setBusy(true);
    setError(null);
    OrgService.learnerPin(id, learner.profileId, { pin })
      .then(() => {
        setPin(null);
        setBusy(false);
        onChange();
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  const act = (body: { readonly unlock: true }) => {
    setBusy(true);
    setError(null);
    OrgService.learnerPin(id, learner.profileId, body)
      .then(() => {
        setBusy(false);
        onChange();
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  const unenrol = () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    OrgService.unenrol(id, learner.profileId)
      .then(() => {
        setBusy(false);
        onChange();
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  return (
    <div className={styles.row}>
      <ProfileAvatar
        avatar={null}
        name={learner.firstName}
        size={34}
        kind="kid"
      />
      <span className={styles.rowInfo}>
        <span className={styles.rowName}>{learner.firstName}</span>
        <span className={styles.rowMeta}>
          {schoolOwned ? (
            <FormattedMessage
              id="learners.mode.a"
              defaultMessage="This centre’s learner · signs in with a PIN"
            />
          ) : (
            <FormattedMessage
              id="learners.mode.b"
              defaultMessage="Their family’s account, lent to this class"
            />
          )}
          {learner.pinLocked && (
            <>
              {" · "}
              <span className={styles.locked}>
                <FormattedMessage
                  id="learners.locked"
                  defaultMessage="PIN locked"
                />
              </span>
            </>
          )}
        </span>
      </span>

      {schoolOwned ? (
        pin == null ? (
          <>
            {learner.pinLocked && (
              <button
                type="button"
                className={styles.rowAction}
                disabled={busy}
                onClick={() => {
                  act({ unlock: true });
                }}
              >
                <FormattedMessage
                  id="learners.unlock"
                  defaultMessage="Unlock"
                />
              </button>
            )}
            <button
              type="button"
              className={styles.rowAction}
              disabled={busy}
              onClick={() => {
                setPin("");
              }}
            >
              <FormattedMessage id="learners.setPin" defaultMessage="New PIN" />
            </button>
          </>
        ) : (
          <span className={styles.pinEntry}>
            {/* Revealed as typed: the coordinator is writing this on a
                card to hand to a child, so there is nobody to hide it
                from and masking only makes it harder to check. The last
                digit does not submit — 4, 5 and 6 are all valid, so it
                cannot know when they have finished. */}
            <PinField
              value={pin}
              length={null}
              onChange={setPin}
              disabled={busy}
              reveal={true}
            />
            <button
              type="button"
              className={styles.rowActionOn}
              disabled={busy || !/^\d{4,6}$/.test(pin)}
              onClick={savePin}
            >
              <FormattedMessage id="learners.pinSave" defaultMessage="Save" />
            </button>
            <button
              type="button"
              className={styles.rowAction}
              disabled={busy}
              onClick={() => {
                setPin(null);
              }}
            >
              <FormattedMessage
                id="learners.pinCancel"
                defaultMessage="Cancel"
              />
            </button>
            {/* No dialog for this one — typing a PIN and pressing Save is
                already deliberate. But the child turns up on Sunday with
                the old one in their head, so say that here. */}
            <span className={styles.pinWarn}>
              <FormattedMessage
                id="learners.pinWarn"
                defaultMessage="Their old PIN stops working straight away."
              />
            </span>
          </span>
        )
      ) : (
        // Mode B: the only thing the school may do is stop looking.
        <button
          type="button"
          className={styles.rowAction}
          disabled={busy}
          onClick={() => {
            setConfirming(true);
          }}
        >
          <FormattedMessage id="learners.unenrol" defaultMessage="End view" />
        </button>
      )}

      {error != null && <p className={styles.error}>{error}</p>}

      {/* Ending a view cannot be undone from this side: only the parent
          can grant it again, by accepting a fresh invite. Worth one
          question before a mis-click costs somebody a phone call. */}
      {confirming && (
        <ConfirmDialog
          title={formatMessage({
            id: "learners.unenrol.title",
            defaultMessage: "End this class’s view?",
          })}
          message={formatMessage(
            {
              id: "learners.unenrol.message",
              defaultMessage:
                "{name} keeps their account and everything in it — this only stops the school seeing their progress. To undo it you would have to invite their parent again, and they would have to accept.",
            },
            { name: learner.firstName },
          )}
          confirmLabel={formatMessage({
            id: "learners.unenrol.confirm",
            defaultMessage: "End the view",
          })}
          danger={true}
          onConfirm={unenrol}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Adding a learner the school itself owns — the coaching-centre case.
 *
 * A PIN is required from the first moment because there is no account
 * behind a mode-A learner: the PIN is the only thing standing between
 * one child's progress and the next child at the same shared machine.
 */
function AddLearner({
  id,
  overview,
  onChange,
}: {
  readonly id: number;
  readonly overview: OrgOverview;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [pin, setPin] = useState("");
  const [batchId, setBatchId] = useState<number | null>(
    overview.batches[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (overview.batches.length === 0) {
    return null;
  }

  const valid =
    firstName.trim() !== "" && /^\d{4,6}$/.test(pin) && batchId != null;

  const add = () => {
    if (!valid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    OrgService.createLearner(id, {
      firstName: firstName.trim(),
      batchId: batchId!,
      pin,
    })
      .then(() => {
        setFirstName("");
        setPin("");
        setOpen(false);
        setBusy(false);
        onChange();
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="learners.add.caption"
          defaultMessage="Add a learner"
        />
      }
    >
      <p className={styles.note}>
        <FormattedMessage
          id="learners.add.note"
          defaultMessage="For a centre that owns its learner places. If the families own the accounts — a weekend school — invite the parents instead and their children come with them."
        />
      </p>
      {open ? (
        <>
          <div className={styles.addRow}>
            <TextField
              type="text"
              size="full"
              maxLength={32}
              placeholder={formatMessage({
                id: "learners.add.name",
                defaultMessage: "First name",
              })}
              value={firstName}
              onChange={setFirstName}
            />
            <select
              className={styles.select}
              value={batchId ?? ""}
              onChange={(event) => {
                setBatchId(Number(event.target.value));
              }}
            >
              {overview.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.pinRow}>
            <span className={styles.pinLabel}>
              <FormattedMessage
                id="learners.add.pinLabel"
                defaultMessage="Their PIN"
              />
            </span>
            <PinField
              value={pin}
              length={null}
              onChange={setPin}
              disabled={busy}
              reveal={true}
              autoFocus={false}
            />
          </div>
          <p className={styles.note}>
            <FormattedMessage
              id="learners.add.pinWhy"
              defaultMessage="The PIN is how this learner is told apart from the next child at the same machine — there is no account behind them. Four to six digits. You can change it later; you can never read it back."
            />
          </p>
          <div className={styles.addRow}>
            <button
              type="button"
              className={styles.primary}
              disabled={!valid || busy}
              onClick={add}
            >
              <FormattedMessage
                id="learners.add.save"
                defaultMessage="Add learner"
              />
            </button>
            <button
              type="button"
              className={styles.rowAction}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              <FormattedMessage
                id="learners.add.cancel"
                defaultMessage="Cancel"
              />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            setOpen(true);
          }}
        >
          <span className={styles.plus}>+</span>
          <FormattedMessage
            id="learners.add.open"
            defaultMessage="Add a learner this centre owns"
          />
        </button>
      )}
      {error != null && <p className={styles.error}>{error}</p>}
    </SettingsCard>
  );
}
