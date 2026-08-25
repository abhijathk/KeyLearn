import { ProfileAvatar } from "@keylearn/page-account";
import { ConfirmDialog, SettingsCard, TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { type OrgOverview, OrgService, type StaffMember } from "./service.ts";
import * as styles from "./Staff.module.less";

/**
 * Who is staff here, and the rule about which addresses they use.
 *
 * Both of these existed only in the database until now: an owner who
 * appointed an admin by mistake had no way to undo it, and the staff
 * address rule — the one Balakairali asked for — could be set when the
 * school was created and never again. A rule you cannot change is a
 * rule that will eventually be wrong.
 */
export function Staff({
  id,
  overview,
  onChange,
}: {
  readonly id: number;
  readonly overview: OrgOverview;
  readonly onChange: () => void;
}): ReactNode {
  const [members, setMembers] = useState<readonly StaffMember[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    OrgService.members(id)
      .then((all) => {
        if (live) {
          setMembers(all);
        }
      })
      .catch(() => {
        if (live) {
          setMembers([]);
        }
      });
    return () => {
      live = false;
    };
  }, [id, nonce]);

  const refresh = () => {
    setNonce((n) => n + 1);
    onChange();
  };

  return (
    <>
      <SettingsCard
        caption={<FormattedMessage id="staff.caption" defaultMessage="Staff" />}
      >
        {members == null ? (
          <p className={styles.note}>
            <FormattedMessage id="staff.loading" defaultMessage="Reading…" />
          </p>
        ) : (
          members.map((member) => (
            <StaffRow
              key={member.userId}
              id={id}
              member={member}
              overview={overview}
              onChange={refresh}
            />
          ))
        )}
        <p className={styles.note}>
          <FormattedMessage
            id="staff.note"
            defaultMessage="Staff join by accepting an invite, the same as everyone else. Removing someone ends their access immediately; it does not touch any learner."
          />
        </p>
      </SettingsCard>

      {overview.myRole === "owner" && (
        <DomainRule id={id} overview={overview} onChange={refresh} />
      )}
    </>
  );
}

function StaffRow({
  id,
  member,
  overview,
  onChange,
}: {
  readonly id: number;
  readonly member: StaffMember;
  readonly overview: OrgOverview;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batch = overview.batches.find((b) => b.id === member.batchId);
  // An owner appoints owners and admins; an admin appoints teachers. The
  // server decides for real — this only keeps a button off a screen
  // where pressing it would always be refused.
  const mayRemove =
    member.role === "teacher"
      ? overview.myRole === "owner" || overview.myRole === "admin"
      : overview.myRole === "owner";

  const remove = () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    OrgService.removeMember(id, member.userId)
      .then(onChange)
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  const who = member.name ?? member.email ?? "";

  return (
    <div className={styles.row}>
      <ProfileAvatar avatar={null} name={who} size={34} kind="adult" />
      <span className={styles.rowInfo}>
        <span className={styles.rowName}>{who}</span>
        <span className={styles.rowMeta}>
          {member.role}
          {batch != null && ` · ${batch.name}`}
          {member.email != null && member.name != null && ` · ${member.email}`}
        </span>
      </span>
      {mayRemove && (
        <button
          type="button"
          className={styles.rowAction}
          disabled={busy}
          onClick={() => {
            setConfirming(true);
          }}
        >
          <FormattedMessage id="staff.remove" defaultMessage="Remove" />
        </button>
      )}
      {error != null && <p className={styles.error}>{error}</p>}

      {confirming && (
        <ConfirmDialog
          title={formatMessage({
            id: "staff.remove.title",
            defaultMessage: "Remove this person from the school?",
          })}
          message={formatMessage(
            {
              id: "staff.remove.message",
              defaultMessage:
                "{who} loses access to every learner here as soon as you confirm. Nothing about a learner changes, and their own KeyLearn account is untouched. To bring them back you would invite them again.",
            },
            { who },
          )}
          confirmLabel={formatMessage({
            id: "staff.remove.confirm",
            defaultMessage: "Remove them",
          })}
          danger={true}
          onConfirm={remove}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * The staff address rule.
 *
 * Owner only, because it decides who may hold admin — an admin who
 * could widen it could appoint themselves a colleague from any inbox.
 */
function DomainRule({
  id,
  overview,
  onChange,
}: {
  readonly id: number;
  readonly overview: OrgOverview;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [value, setValue] = useState(overview.staffEmailDomains.join(", "));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    OrgService.patchOrg(id, { staffEmailDomains: value })
      .then((result) => {
        setValue(result.staffEmailDomains.join(", "));
        setSaved(true);
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
          id="staff.domain.caption"
          defaultMessage="Staff addresses"
        />
      }
    >
      <p className={styles.note}>
        <FormattedMessage
          id="staff.domain.note"
          defaultMessage="Name the domain your school's own addresses use and only people at the school can hold owner or admin. Teachers are encouraged to use it but never blocked — at a community school the volunteer teachers are the parents. Guardians are never restricted."
        />
      </p>
      <div className={styles.addRow}>
        <TextField
          type="text"
          size="full"
          maxLength={255}
          placeholder={formatMessage({
            id: "staff.domain.placeholder",
            defaultMessage: "balakairali.org.au — or leave empty for no rule",
          })}
          value={value}
          onChange={(next) => {
            setValue(next);
            setSaved(false);
          }}
        />
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={save}
        >
          <FormattedMessage id="staff.domain.save" defaultMessage="Save" />
        </button>
      </div>
      {saved && (
        <p className={styles.saved}>
          {overview.staffEmailDomains.length === 0 && value.trim() === "" ? (
            <FormattedMessage
              id="staff.domain.savedNone"
              defaultMessage="Saved. Anyone invited can hold any role."
            />
          ) : (
            <FormattedMessage
              id="staff.domain.saved"
              defaultMessage="Saved. This applies to the next person invited — nobody already on the staff list is affected."
            />
          )}
        </p>
      )}
      {error != null && <p className={styles.error}>{error}</p>}
      <p className={styles.note}>
        <FormattedMessage
          id="staff.domain.verified"
          defaultMessage="An address must also be confirmed before it can hold a staff role. The check runs when the invite is accepted, because who a link was emailed to proves nothing about who opens it."
        />
      </p>
    </SettingsCard>
  );
}
