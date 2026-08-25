import { AuthPage } from "@keylearn/page-account";
import { usePageData } from "@keylearn/pages-shared";
import {
  Button,
  ConfirmDialog,
  FloatingShell,
  SettingsCard,
  TextField,
} from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { BulkInvite } from "./BulkInvite.tsx";
import * as styles from "./DeskPage.module.less";
import { Learners } from "./Learners.tsx";
import {
  type AccessEvent,
  type InviteRow,
  type Learner,
  type OrgOverview,
  OrgService,
  type OrgSummary,
} from "./service.ts";

/**
 * The coordinator's desk — mock 09.
 *
 * One screen for the person who runs a school: seats, classes, the
 * invite chain, and the log of who looked at whose child. Everything on
 * it is drawn from `/_/org/*`, and not one decision about who may see
 * what is made here — the resolver owns that (P2), so a section that
 * forgets to hide itself shows an empty list rather than a leak.
 */
type Pane = "seats" | "learners" | "invite" | "roster" | "audit";

export function DeskPage(): ReactNode {
  const { publicUser } = usePageData();
  const [orgs, setOrgs] = useState<readonly OrgSummary[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    if (publicUser.id == null) {
      return;
    }
    let live = true;
    OrgService.myOrgs()
      .then((all) => {
        if (live) {
          setOrgs(all);
          setCurrent(all[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (live) {
          setOrgs([]);
        }
      });
    return () => {
      live = false;
    };
  }, [publicUser.id]);

  // Signed out is a different answer from "you are staff nowhere", and
  // telling a coordinator their school does not exist when they simply
  // are not signed in yet is the kind of wrong that generates a ticket.
  if (publicUser.id == null) {
    return <AuthPage mode="login" />;
  }
  if (orgs == null) {
    return null;
  }
  if (orgs.length === 0) {
    return <NotStaff />;
  }
  return (
    <Desk
      key={current ?? 0}
      orgs={orgs}
      current={current}
      onSwitch={setCurrent}
    />
  );
}

/**
 * Someone signed in who belongs to no organisation. Not an error, and
 * emphatically not a "create a school" button — an organisation exists
 * because a person approved it (spec §8), so the honest answer is where
 * to ask.
 */
function NotStaff(): ReactNode {
  return (
    <div className={styles.standalone}>
      <h1 className={styles.standaloneTitle}>
        <FormattedMessage
          id="desk.none.title"
          defaultMessage="No school on this account"
        />
      </h1>
      <p className={styles.standaloneBody}>
        <FormattedMessage
          id="desk.none.body"
          defaultMessage="This page is for people who run a school or class. You join one by accepting an invite — there is no way to sign yourself up, which is what keeps a school's data closed."
        />
      </p>
      <Button
        onClick={() => {
          window.location.assign("/for-schools");
        }}
        label={
          <FormattedMessage
            id="desk.none.link"
            defaultMessage="Read about KeyLearn for schools"
          />
        }
      />
    </div>
  );
}

function Desk({
  orgs,
  current,
  onSwitch,
}: {
  readonly orgs: readonly OrgSummary[];
  readonly current: number | null;
  readonly onSwitch: (id: number) => void;
}): ReactNode {
  const id = current ?? orgs[0]!.id;
  const [pane, setPane] = useState<Pane>("seats");
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [learners, setLearners] = useState<readonly Learner[]>([]);
  const [invites, setInvites] = useState<readonly InviteRow[]>([]);
  const [events, setEvents] = useState<readonly AccessEvent[]>([]);
  const [nonce, setNonce] = useState(0);

  const refresh = () => {
    setNonce((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    void (async () => {
      const [o, l, i, a] = await Promise.all([
        OrgService.overview(id).catch(() => null),
        OrgService.learners(id),
        OrgService.listInvites(id),
        OrgService.audit(id),
      ]);
      if (live) {
        setOverview(o);
        setLearners(l);
        setInvites(i);
        setEvents(a);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, nonce]);

  if (overview == null) {
    return null;
  }

  return (
    <FloatingShell
      flush={true}
      // A half-filled class list is easy to lose to a stray click on the
      // dim, and re-pasting forty addresses is not a small ask.
      closeOnBackdrop={false}
      title={<FormattedMessage id="org.title" defaultMessage="Your school" />}
    >
      <div className={styles.b5}>
        <nav className={styles.rail}>
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              className={clsx(styles.who, org.id === id && styles.whoOn)}
              onClick={() => {
                onSwitch(org.id);
              }}
            >
              <span className={styles.orgbadge}>{initialsOf(org.name)}</span>
              <span className={styles.whoText}>
                <span className={styles.whoName}>{org.name}</span>
                <span className={styles.whoRole}>{org.role}</span>
              </span>
            </button>
          ))}

          <RailItem
            on={pane === "seats"}
            onClick={() => {
              setPane("seats");
            }}
            icon={<SchoolIcon />}
            label={
              <FormattedMessage
                id="desk.rail.school"
                defaultMessage="Overview"
              />
            }
          />
          <RailItem
            on={pane === "learners"}
            onClick={() => {
              setPane("learners");
            }}
            icon={<LearnersIcon />}
            label={
              <FormattedMessage
                id="desk.rail.learners"
                defaultMessage="Learners"
              />
            }
          />
          <RailItem
            on={pane === "invite"}
            onClick={() => {
              setPane("invite");
            }}
            icon={<InviteIcon />}
            label={
              <FormattedMessage id="desk.rail.invite" defaultMessage="Invite" />
            }
          />
          <RailItem
            on={pane === "roster"}
            onClick={() => {
              setPane("roster");
            }}
            icon={<RosterIcon />}
            label={
              <FormattedMessage id="desk.rail.roster" defaultMessage="Roster" />
            }
          />
          {/* A teacher has no member list, and the audit is written in
              terms of who those members are — so it is not offered. */}
          {overview.members != null && (
            <RailItem
              on={pane === "audit"}
              onClick={() => {
                setPane("audit");
              }}
              icon={<AuditIcon />}
              label={
                <FormattedMessage
                  id="desk.rail.audit"
                  defaultMessage="Access"
                />
              }
            />
          )}
        </nav>

        <div className={styles.pane}>
          {pane === "seats" && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="desk.pane.school"
                  defaultMessage="Overview"
                />
              </h2>
              <Seats overview={overview} />
              <Classes overview={overview} learners={learners} />
            </div>
          )}
          {pane === "learners" && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="desk.pane.learners"
                  defaultMessage="Learners"
                />
              </h2>
              <Learners
                id={id}
                overview={overview}
                learners={learners}
                onChange={refresh}
              />
            </div>
          )}
          {pane === "invite" && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="desk.pane.invite"
                  defaultMessage="Invite people"
                />
              </h2>
              <BulkInvite id={id} overview={overview} onChange={refresh} />
            </div>
          )}
          {pane === "roster" && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="desk.pane.roster"
                  defaultMessage="Roster"
                />
              </h2>
              <Roster
                invites={invites}
                overview={overview}
                id={id}
                onChange={refresh}
              />
            </div>
          )}
          {pane === "audit" && overview.members != null && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="desk.pane.audit"
                  defaultMessage="Access, audited"
                />
              </h2>
              <Audit events={events} names={overview} />
            </div>
          )}
        </div>
      </div>
    </FloatingShell>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function RailItem({
  on,
  onClick,
  icon,
  label,
}: {
  readonly on: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
  readonly label: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      className={clsx(styles.nav, on && styles.navOn)}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

// Drawn here rather than pulled from an icon set, to match the rail
// icons the account window already uses.
function SchoolIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M3 21V9l9-6 9 6v12M9 21v-7h6v7M3 21h18" />
    </svg>
  );
}

function LearnersIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M17 5.6a3.2 3.2 0 010 6.3M18.5 14.8c2 .7 3.2 2.3 3.2 4.4" />
    </svg>
  );
}

function InviteIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M3 6.5h18v11H3zM3 7l9 6.5L21 7" />
    </svg>
  );
}

function RosterIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M4 5.5h16M4 12h16M4 18.5h10" />
    </svg>
  );
}

function AuditIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 14.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z" />
    </svg>
  );
}

/**
 * Seats, and the one sentence that matters about running out of them.
 *
 * A lapsed licence makes staff screens read-only and never touches a
 * lesson — saying so here, next to the number, is the difference between
 * a coordinator who renews calmly and one who panics on a Sunday.
 */
function Seats({ overview }: { readonly overview: OrgOverview }): ReactNode {
  const { seats, used, lapsed } = overview.seats;
  return (
    <SettingsCard
      caption={<FormattedMessage id="desk.seats" defaultMessage="Seats" />}
    >
      {seats == null ? (
        <p className={styles.cardNote}>
          <FormattedMessage
            id="desk.seats.none"
            defaultMessage="{used, plural, one {# learner} other {# learners}} enrolled, and no seat limit set — nothing here can run out."
            values={{ used }}
          />
        </p>
      ) : (
        <>
          <div className={styles.seats}>
            <span className={styles.big}>
              {used}
              <span>/{seats}</span>
            </span>
            <span className={styles.meter}>
              <i
                style={{
                  inlineSize: `${seats === 0 ? 0 : Math.min(100, Math.round((used / seats) * 100))}%`,
                }}
              />
            </span>
          </div>
          <p className={styles.cardNote}>
            <FormattedMessage
              id="desk.seats.when"
              defaultMessage="A seat is taken when an invite is accepted and released on unenrolment."
            />
          </p>
        </>
      )}
      {/* The promise that stops a Sunday-afternoon panic, next to the
          number it is about rather than in a billing page. */}
      <p className={styles.cardNote}>
        {lapsed ? (
          <FormattedMessage
            id="desk.seats.isLapsed"
            defaultMessage="This plan has lapsed, so these screens are read-only. No learner has been stopped and nothing has been deleted — renewing restores everything."
          />
        ) : (
          <FormattedMessage
            id="desk.seats.ifLapsed"
            defaultMessage="If the plan lapses mid-term, these staff screens go read-only. No child is ever refused mid-lesson."
          />
        )}
      </p>
    </SettingsCard>
  );
}

/**
 * "Batch" in the schema, "class" at a school — the word a coordinator
 * uses is the word on screen.
 */
function Classes({
  overview,
  learners,
}: {
  readonly overview: OrgOverview;
  readonly learners: readonly Learner[];
}): ReactNode {
  const { formatMessage } = useIntl();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const teacherOf = (batchId: number): string | null => {
    const teacher = (overview.members ?? []).find(
      (m) => m.role === "teacher" && m.batchId === batchId,
    );
    return teacher?.name ?? null;
  };

  const add = () => {
    if (name.trim() === "" || busy) {
      return;
    }
    setBusy(true);
    OrgService.createBatch(overview.organization.id, name.trim())
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        setBusy(false);
      });
  };

  return (
    <SettingsCard
      caption={<FormattedMessage id="desk.classes" defaultMessage="Classes" />}
    >
      <p className={styles.cardNote}>
        <FormattedMessage
          id="desk.classes.note"
          defaultMessage="A teacher sees their own class and nothing else — enforced when the data is fetched, not by hiding it here."
        />
      </p>
      {overview.batches.length === 0 ? (
        <p className={styles.cardNote}>
          <FormattedMessage
            id="desk.classes.empty"
            defaultMessage="No classes yet. Add one, then invite its teacher and its parents."
          />
        </p>
      ) : (
        overview.batches.map((batch) => {
          const mine = learners.filter((l) => l.batchId === batch.id);
          const modeA = mine.filter((l) => l.mode === "A").length;
          const teacher = teacherOf(batch.id);
          return (
            <div key={batch.id} className={styles.rrow}>
              <span className={styles.rowInfo}>
                <span className={styles.rowName}>{batch.name}</span>
                <span className={styles.rowMeta}>
                  {teacher ?? (
                    <FormattedMessage
                      id="desk.classes.noTeacher"
                      defaultMessage="no teacher invited yet"
                    />
                  )}
                  {" · "}
                  <FormattedMessage
                    id="desk.classes.count"
                    defaultMessage="{n, plural, =0 {no learners} one {# learner} other {# learners}}"
                    values={{ n: mine.length }}
                  />
                  {modeA > 0 && (
                    <FormattedMessage
                      id="desk.classes.owned"
                      defaultMessage=", {n} this centre's own"
                      values={{ n: modeA }}
                    />
                  )}
                </span>
              </span>
            </div>
          );
        })
      )}

      {adding ? (
        <div className={styles.addRow}>
          <TextField
            type="text"
            size="full"
            maxLength={64}
            placeholder={formatMessage({
              id: "desk.classes.namePlaceholder",
              defaultMessage: "Class name — usually the teacher's",
            })}
            value={name}
            onChange={setName}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={busy || name.trim() === ""}
            onClick={add}
          >
            <FormattedMessage id="desk.classes.save" defaultMessage="Add" />
          </button>
          <button
            type="button"
            className={styles.rowAction}
            onClick={() => {
              setAdding(false);
            }}
          >
            <FormattedMessage
              id="desk.classes.cancel"
              defaultMessage="Cancel"
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            setAdding(true);
          }}
        >
          <span className={styles.plus}>+</span>
          <FormattedMessage
            id="desk.classes.add"
            defaultMessage="Add a class"
          />
        </button>
      )}
    </SettingsCard>
  );
}

/**
 * Who was invited, who joined, who is still waiting — by the third
 * Sunday this is the only number a coordinator actually wants.
 */
function Roster({
  invites,
  overview,
  id,
  onChange,
}: {
  readonly invites: readonly InviteRow[];
  readonly overview: OrgOverview;
  readonly id: number;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [showSpent, setShowSpent] = useState(false);
  const [revoking, setRevoking] = useState<InviteRow | null>(null);

  if (invites.length === 0) {
    return (
      <SettingsCard
        caption={
          <FormattedMessage id="desk.roster.caption" defaultMessage="Invites" />
        }
      >
        <p className={styles.cardNote}>
          <FormattedMessage
            id="desk.roster.none"
            defaultMessage="No invites yet. Everyone gets in through one, so this is where the term starts."
          />
        </p>
      </SettingsCard>
    );
  }

  const waiting = invites.filter(
    (i) => i.acceptedAt == null && i.revokedAt == null,
  );
  const joined = invites.filter((i) => i.acceptedAt != null);
  const revoked = invites.filter(
    (i) => i.revokedAt != null && i.acceptedAt == null,
  );

  const batchName = (batchId: number | null): string | null =>
    batchId == null
      ? null
      : (overview.batches.find((b) => b.id === batchId)?.name ?? null);

  const who =
    revoking == null
      ? ""
      : (revoking.email ??
        formatMessage({
          id: "desk.roster.slip",
          defaultMessage: "Printed slip",
        }));

  return (
    <>
      {/* A revoked invite cannot be un-revoked — the token is hashed and
          gone. Issuing a replacement is easy, but the person holding the
          old link is stranded until someone notices. */}
      {revoking != null && (
        <ConfirmDialog
          title={formatMessage({
            id: "desk.roster.revoke.title",
            defaultMessage: "Revoke this invite?",
          })}
          message={formatMessage(
            {
              id: "desk.roster.revoke.message",
              defaultMessage:
                "The link sent to {who} stops working immediately. It cannot be turned back on — you would send a new invite instead, and the old link would stay dead in their inbox.",
            },
            { who },
          )}
          confirmLabel={formatMessage({
            id: "desk.roster.revoke.confirm",
            defaultMessage: "Revoke it",
          })}
          danger={true}
          onConfirm={() => {
            const target = revoking;
            setRevoking(null);
            void OrgService.revokeInvite(id, target.id).then(onChange);
          }}
          onCancel={() => {
            setRevoking(null);
          }}
        />
      )}

      {/* Waiting first. By the third Sunday the only question a
          coordinator has is who still has not joined, and burying that
          under the people who already did is the wrong way round. */}
      {waiting.length > 0 && (
        <SettingsCard
          caption={
            <FormattedMessage
              id="desk.roster.waitingCaption"
              defaultMessage="Not joined yet"
            />
          }
        >
          {waiting.map((invite) => (
            <InviteLine
              key={invite.id}
              invite={invite}
              batchName={batchName(invite.batchId)}
              action={
                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={() => {
                    setRevoking(invite);
                  }}
                >
                  <FormattedMessage
                    id="desk.roster.revoke"
                    defaultMessage="Revoke"
                  />
                </button>
              }
            />
          ))}
          <p className={styles.cardNote}>
            <FormattedMessage
              id="desk.roster.chase"
              defaultMessage="These expire on their own. Revoking one only stops it early — useful if it went to the wrong address."
            />
          </p>
        </SettingsCard>
      )}

      {joined.length > 0 && (
        <SettingsCard
          caption={
            <FormattedMessage
              id="desk.roster.joinedCaption"
              defaultMessage="Joined"
            />
          }
        >
          {joined.map((invite) => (
            <InviteLine
              key={invite.id}
              invite={invite}
              batchName={batchName(invite.batchId)}
              action={
                <span className={styles.doneTag}>
                  <FormattedMessage
                    id="desk.roster.joined"
                    defaultMessage="joined"
                  />
                </span>
              }
            />
          ))}
        </SettingsCard>
      )}

      {/* Spent invites are history, not work. They stay reachable —
          "did I already revoke that one?" is a real question — but they
          do not get to crowd out the list that needs chasing. */}
      {revoked.length > 0 && (
        <SettingsCard
          caption={
            <FormattedMessage
              id="desk.roster.spentCaption"
              defaultMessage="Finished with"
            />
          }
        >
          {showSpent ? (
            revoked.map((invite) => (
              <InviteLine
                key={invite.id}
                invite={invite}
                batchName={batchName(invite.batchId)}
                action={
                  <span className={styles.faintTag}>
                    <FormattedMessage
                      id="desk.roster.revoked"
                      defaultMessage="revoked"
                    />
                  </span>
                }
              />
            ))
          ) : (
            <button
              type="button"
              className={styles.rowAction}
              onClick={() => {
                setShowSpent(true);
              }}
            >
              <FormattedMessage
                id="desk.roster.showSpent"
                defaultMessage="Show {n} revoked"
                values={{ n: revoked.length }}
              />
            </button>
          )}
        </SettingsCard>
      )}
    </>
  );
}

/** One invite, in the same filled row the learners list uses. */
function InviteLine({
  invite,
  batchName,
  action,
}: {
  readonly invite: InviteRow;
  readonly batchName: string | null;
  readonly action: ReactNode;
}): ReactNode {
  return (
    <div className={styles.rrow}>
      <span className={styles.rowInfo}>
        <span className={styles.rowName}>
          {invite.acceptedByName ?? invite.email ?? (
            <FormattedMessage
              id="desk.roster.slip"
              defaultMessage="Printed slip"
            />
          )}
        </span>
        <span className={styles.rowMeta}>
          {/* The coordinator's own note first — "who is this?" is the
              question they are actually asking of an unaccepted invite,
              and the address rarely answers it. Gone once they join. */}
          {invite.reference != null && (
            <span className={styles.ref}>{invite.reference}</span>
          )}
          {invite.reference != null && " · "}
          {invite.role}
          {batchName != null && ` · ${batchName}`}
        </span>
      </span>
      {action}
    </div>
  );
}

/**
 * Every staff look at an individual learner, as a row.
 *
 * This is not a feature for the coordinator — it is the thing that makes
 * the promise to parents checkable, which is why it is on the desk of
 * the person being audited rather than hidden from them.
 */
function Audit({
  events,
  names,
}: {
  readonly events: readonly AccessEvent[];
  readonly names: OrgOverview;
}): ReactNode {
  const actorName = (userId: number): string | null =>
    (names.members ?? []).find((m) => m.userId === userId)?.name ?? null;

  return (
    <SettingsCard
      caption={<FormattedMessage id="desk.audit" defaultMessage="Every look" />}
    >
      {events.length === 0 ? (
        <p className={styles.cardNote}>
          <FormattedMessage
            id="desk.audit.empty"
            defaultMessage="Nobody has looked at an individual learner yet. When they do, it appears here."
          />
        </p>
      ) : (
        events.map((event, index) => (
          <div key={index} className={styles.rrow}>
            <span className={styles.rowInfo}>
              <span className={styles.rowName}>
                {actorName(event.actorUserId) ?? (
                  <FormattedMessage
                    id="desk.audit.someone"
                    defaultMessage="A staff member"
                  />
                )}
              </span>
              <span className={styles.rowMeta}>{event.action}</span>
            </span>
            <span className={styles.faintTag}>
              {new Date(event.at).toLocaleString()}
            </span>
          </div>
        ))
      )}
      <p className={styles.cardNote}>
        <FormattedMessage
          id="desk.audit.note"
          defaultMessage="Guardians can see who looked at their own child. Unenrolment ends access within one request."
        />
      </p>
    </SettingsCard>
  );
}
