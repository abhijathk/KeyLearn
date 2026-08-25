import { AuthPage } from "@keylearn/page-account";
import { usePageData } from "@keylearn/pages-shared";
import { Button, TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { BulkInvite } from "./BulkInvite.tsx";
import * as styles from "./DeskPage.module.less";
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
    <div className={styles.paper}>
      {orgs.length > 1 && (
        <div className={styles.orgSwitch}>
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              className={org.id === current ? styles.onSwitch : undefined}
              onClick={() => {
                setCurrent(org.id);
              }}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
      {current != null && <Desk key={current} id={current} />}
    </div>
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
    <div className={styles.paper}>
      <h1 className={styles.nameplate}>
        <FormattedMessage
          id="desk.none.title"
          defaultMessage="No school on this account"
        />
      </h1>
      <p className={styles.lede}>
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

function Desk({ id }: { readonly id: number }): ReactNode {
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
    <>
      <OrgBar overview={overview} />
      <Seats overview={overview} />
      <Classes overview={overview} learners={learners} />
      <BulkInvite id={id} overview={overview} onChange={refresh} />
      <Roster
        invites={invites}
        overview={overview}
        id={id}
        onChange={refresh}
      />
      {overview.members != null && <Audit events={events} names={overview} />}
    </>
  );
}

function OrgBar({ overview }: { readonly overview: OrgOverview }): ReactNode {
  const initials = overview.organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return (
    <div className={styles.orgbar}>
      <span className={styles.orgbadge}>{initials}</span>
      <div className={styles.orgwho}>
        <b>{overview.organization.name}</b>
        <span>{overview.organization.type}</span>
      </div>
      <span className={styles.role}>
        <FormattedMessage
          id="desk.youAre"
          defaultMessage="you · {role}"
          values={{ role: overview.myRole }}
        />
      </span>
    </div>
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
  if (seats == null) {
    return (
      <section>
        <h2 className={styles.whisper}>
          <FormattedMessage id="desk.seats" defaultMessage="Seats" />
        </h2>
        <p className={styles.note}>
          <FormattedMessage
            id="desk.seats.none"
            defaultMessage="{used, plural, one {# learner} other {# learners}} enrolled, and no seat limit set — nothing here can run out."
            values={{ used }}
          />
        </p>
      </section>
    );
  }
  const pct = seats === 0 ? 0 : Math.min(100, Math.round((used / seats) * 100));
  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="desk.seats" defaultMessage="Seats" />
      </h2>
      <div className={styles.seats}>
        <span className={styles.big}>
          {used}
          <span>/{seats}</span>
        </span>
        <span className={styles.meter}>
          <i style={{ inlineSize: `${pct}%` }} />
        </span>
        <small>
          <FormattedMessage
            id="desk.seats.when"
            defaultMessage="taken when an invite is accepted, released on unenrolment"
          />
        </small>
      </div>
      <p className={lapsed ? styles.lapsed : styles.lapse}>
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
    </section>
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
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="desk.classes" defaultMessage="Classes" />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="desk.classes.note"
          defaultMessage="A teacher sees their own class and nothing else — enforced when the data is fetched, not by hiding it here."
        />
      </p>
      {overview.batches.length === 0 ? (
        <p className={styles.empty}>
          <FormattedMessage
            id="desk.classes.empty"
            defaultMessage="No classes yet. Add one, then invite its teacher and its parents."
          />
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <FormattedMessage
                  id="desk.classes.col.name"
                  defaultMessage="class"
                />
              </th>
              <th>
                <FormattedMessage
                  id="desk.classes.col.teacher"
                  defaultMessage="teacher"
                />
              </th>
              <th>
                <FormattedMessage
                  id="desk.classes.col.learners"
                  defaultMessage="learners"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {overview.batches.map((batch) => {
              const mine = learners.filter((l) => l.batchId === batch.id);
              const modeA = mine.filter((l) => l.mode === "A").length;
              const teacher = teacherOf(batch.id);
              return (
                <tr key={batch.id}>
                  <td>
                    <b>{batch.name}</b>
                  </td>
                  <td className={teacher == null ? styles.faint : undefined}>
                    {teacher ?? (
                      <FormattedMessage
                        id="desk.classes.noTeacher"
                        defaultMessage="not invited yet"
                      />
                    )}
                  </td>
                  <td>
                    {mine.length}{" "}
                    {mine.length > 0 &&
                      (modeA === 0 ? (
                        <span className={`${styles.pill} ${styles.b}`}>
                          <FormattedMessage
                            id="desk.mode.b"
                            defaultMessage="families own"
                          />
                        </span>
                      ) : modeA === mine.length ? (
                        <span className={`${styles.pill} ${styles.a}`}>
                          <FormattedMessage
                            id="desk.mode.a"
                            defaultMessage="school owns · PIN"
                          />
                        </span>
                      ) : (
                        <span className={styles.pill}>
                          <FormattedMessage
                            id="desk.mode.mixed"
                            defaultMessage="{n} school-owned"
                            values={{ n: modeA }}
                          />
                        </span>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          <Button
            onClick={add}
            disabled={busy || name.trim() === ""}
            label={formatMessage({
              id: "desk.classes.save",
              defaultMessage: "Add",
            })}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.quiet}
          onClick={() => {
            setAdding(true);
          }}
        >
          <FormattedMessage
            id="desk.classes.add"
            defaultMessage="Add a class"
          />
        </button>
      )}
    </section>
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
  if (invites.length === 0) {
    return null;
  }
  const joined = invites.filter((i) => i.acceptedAt != null).length;
  const waiting = invites.filter(
    (i) => i.acceptedAt == null && i.revokedAt == null,
  );
  const batchName = (batchId: number | null): string | null =>
    batchId == null
      ? null
      : (overview.batches.find((b) => b.id === batchId)?.name ?? null);

  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="desk.roster" defaultMessage="Who has joined" />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="desk.roster.count"
          defaultMessage="{joined} of {total} invites accepted."
          values={{ joined, total: invites.length }}
        />
      </p>
      <div className={styles.roster}>
        {invites.map((invite) => (
          <div key={invite.id} className={styles.rrow}>
            <span className={styles.rwho}>
              {invite.acceptedByName ?? invite.email ?? (
                <FormattedMessage
                  id="desk.roster.slip"
                  defaultMessage="printed slip"
                />
              )}
              {batchName(invite.batchId) != null && (
                <span className={styles.faint}>
                  {" · "}
                  {batchName(invite.batchId)}
                </span>
              )}
            </span>
            {invite.revokedAt != null ? (
              <span className={`${styles.rtag} ${styles.faint}`}>
                <FormattedMessage
                  id="desk.roster.revoked"
                  defaultMessage="revoked"
                />
              </span>
            ) : invite.acceptedAt != null ? (
              <span className={`${styles.rtag} ${styles.ok}`}>
                <FormattedMessage
                  id="desk.roster.joined"
                  defaultMessage="joined"
                />
              </span>
            ) : (
              <>
                <span className={styles.rtag}>
                  <FormattedMessage
                    id="desk.roster.waiting"
                    defaultMessage="not yet"
                  />
                </span>
                <button
                  type="button"
                  className={styles.quiet}
                  onClick={() => {
                    void OrgService.revokeInvite(id, invite.id).then(onChange);
                  }}
                >
                  <FormattedMessage
                    id="desk.roster.revoke"
                    defaultMessage="revoke"
                  />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {waiting.length > 0 && (
        <p className={styles.note}>
          <FormattedMessage
            id="desk.roster.chase"
            defaultMessage="{n, plural, one {# invite has} other {# invites have}} not been used yet. They expire on their own; revoking one only stops it early."
            values={{ n: waiting.length }}
          />
        </p>
      )}
    </section>
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
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="desk.audit" defaultMessage="Access, audited" />
      </h2>
      {events.length === 0 ? (
        <p className={styles.empty}>
          <FormattedMessage
            id="desk.audit.empty"
            defaultMessage="Nobody has looked at an individual learner yet. When they do, it appears here."
          />
        </p>
      ) : (
        <div className={styles.audit}>
          {events.map((event, index) => (
            <div key={index} className={styles.arow}>
              <span>
                <b>
                  {actorName(event.actorUserId) ?? (
                    <FormattedMessage
                      id="desk.audit.someone"
                      defaultMessage="A staff member"
                    />
                  )}
                </b>{" "}
                {event.action}
              </span>
              <span className={styles.at}>
                {new Date(event.at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className={styles.note}>
        <FormattedMessage
          id="desk.audit.note"
          defaultMessage="Guardians can see who looked at their own child. Unenrolment ends access within one request."
        />
      </p>
    </section>
  );
}
