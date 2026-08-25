import { Button, SettingsCard } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./BulkInvite.module.less";
import {
  type InviteVerdict,
  type OrgOverview,
  OrgService,
  type ScreenResult,
  type Slip,
} from "./service.ts";

/**
 * Inviting forty parents — mock 16.
 *
 * A class of forty is forty invites and nobody clicks a button forty
 * times. One action per class mints them together: emailed to a pasted
 * list or a dropped CSV, or printed as anonymous slips for the hall.
 *
 * The rule the whole panel is built around: nothing is sent until the
 * list has been read back, BY ROW, so a problem can be fixed in the
 * spreadsheet it came from.
 */

type Role = "guardian" | "teacher" | "admin" | "owner";

export function BulkInvite({
  id,
  overview,
  onChange,
}: {
  readonly id: number;
  readonly overview: OrgOverview;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [role, setRole] = useState<Role>("guardian");
  const [batchId, setBatchId] = useState<number | null>(
    overview.batches[0]?.id ?? null,
  );

  return (
    <SettingsCard
      caption={
        <FormattedMessage id="bulk.title" defaultMessage="Who to invite" />
      }
    >
      <p className={styles.note}>
        <FormattedMessage
          id="bulk.note"
          defaultMessage="The only door in. Each invite is single-use, scoped to one role and one class, and expires on its own."
        />
      </p>

      <div className={styles.compose}>
        <label className={styles.pick}>
          <span>
            <FormattedMessage id="bulk.as" defaultMessage="as" />
          </span>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as Role);
            }}
          >
            <option value="guardian">
              {formatMessage({
                id: "bulk.role.guardian",
                defaultMessage: "Guardian — joins with their children",
              })}
            </option>
            <option value="teacher">
              {formatMessage({
                id: "bulk.role.teacher",
                defaultMessage: "Teacher",
              })}
            </option>
            <option value="admin">
              {formatMessage({
                id: "bulk.role.admin",
                defaultMessage: "Admin",
              })}
            </option>
          </select>
        </label>
        {overview.batches.length > 0 && (
          <label className={styles.pick}>
            <span>
              <FormattedMessage id="bulk.for" defaultMessage="for" />
            </span>
            <select
              value={batchId ?? ""}
              onChange={(event) => {
                setBatchId(
                  event.target.value === "" ? null : Number(event.target.value),
                );
              }}
            >
              {overview.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
              <option value="">
                {formatMessage({
                  id: "bulk.noClass",
                  defaultMessage: "the whole school",
                })}
              </option>
            </select>
          </label>
        )}
      </div>

      {/* Staff domains are the owner's rule, said here while they are
          choosing who to invite rather than after a refusal. */}
      {(role === "admin" || role === "owner") && (
        <p className={styles.domainWarn}>
          <FormattedMessage
            id="bulk.domainWarn"
            defaultMessage="Admins and owners must accept on a school address. If your school has set one, an invite sent to a personal address will be refused when it is opened — and the invite is not used up, so it can simply be reissued."
          />
        </p>
      )}

      <ByEmail id={id} role={role} batchId={batchId} onChange={onChange} />
      {role === "guardian" && (
        <OnPaper id={id} batchId={batchId} overview={overview} />
      )}
    </SettingsCard>
  );
}

/**
 * The email route: a pasted block or a dropped CSV, read back by row.
 *
 * Only the `email` column is required. A `class` column is read too so
 * one file can cover every class at once. A `name` column is ignored on
 * purpose — the parent tells us their own name when they join, and a
 * stale spreadsheet name would follow them around.
 */
function ByEmail({
  id,
  role,
  batchId,
  onChange,
}: {
  readonly id: number;
  readonly role: Role;
  readonly batchId: number | null;
  readonly onChange: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [screened, setScreened] = useState<ScreenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const entries = parseEmails(text);

  const take = (raw: string, name: string | null) => {
    setText(raw);
    setFileName(name);
    setScreened(null);
    setSent(null);
    setError(null);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      take(String(reader.result ?? ""), file.name);
    };
    reader.readAsText(file);
  };

  const screen = () => {
    setBusy(true);
    setError(null);
    OrgService.screenInvites(
      id,
      entries.map((e) => e.email),
    )
      .then((result) => {
        setScreened(result);
        setBusy(false);
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  const send = () => {
    if (screened == null) {
      return;
    }
    setBusy(true);
    const toSend = screened.verdicts
      .filter((v) => v.verdict === "invite")
      .map((v) => v.email);
    OrgService.inviteByEmail(
      id,
      role as "guardian" | "teacher" | "admin" | "owner",
      batchId,
      toSend,
    )
      .then((result) => {
        setSent(result.sent);
        setScreened(null);
        setText("");
        setFileName(null);
        setBusy(false);
        onChange();
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  if (sent != null) {
    return (
      <p className={styles.done}>
        {/* "Created", not "delivered". Sending is deliberately
            fire-and-forget so one dead mailbox cannot lose the other
            thirty-nine, which means this count cannot promise arrival —
            the Roster is where a coordinator sees what actually
            happened. */}
        <FormattedMessage
          id="bulk.sent"
          defaultMessage="{n, plural, one {# invite} other {# invites}} created and being emailed. Roster shows who has accepted; an invite whose email bounces is still valid, so it can be handed over on paper."
          values={{ n: sent }}
        />
      </p>
    );
  }

  return (
    <>
      <h3 className={styles.sub}>
        <FormattedMessage
          id="bulk.byEmail"
          defaultMessage="By email — paste the list, or drop the CSV"
        />
      </h3>
      <label
        className={`${styles.drop} ${over ? styles.dropOver : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file != null) {
            readFile(file);
          }
        }}
      >
        <span className={styles.di}>
          <svg viewBox="0 0 16 16" aria-hidden={true}>
            <path d="M8 10.5V2.5M4.5 6L8 2.5 11.5 6M2.5 13.5h11" />
          </svg>
        </span>
        <b>
          <FormattedMessage
            id="bulk.drop"
            defaultMessage="Drop your class list here"
          />
        </b>
        <span>
          <FormattedMessage
            id="bulk.dropSub"
            defaultMessage="a .csv exported from your spreadsheet — or choose a file"
          />
        </span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file != null) {
              readFile(file);
            }
          }}
        />
      </label>

      {fileName != null && (
        <p className={styles.fileCard}>
          <b>{fileName}</b>
          <FormattedMessage
            id="bulk.fileRows"
            defaultMessage=" · {n, plural, one {# address} other {# addresses}} read"
            values={{ n: entries.length }}
          />
        </p>
      )}

      <textarea
        className={styles.paste}
        rows={5}
        value={text}
        placeholder={formatMessage({
          id: "bulk.paste",
          defaultMessage:
            "…or paste addresses, one per line. A CSV is read the same way — only the email column is used.",
        })}
        onChange={(event) => {
          take(event.target.value, null);
        }}
      />

      {error != null && <p className={styles.error}>{error}</p>}

      {screened == null ? (
        <div className={styles.actions}>
          <Button
            onClick={screen}
            disabled={busy || entries.length === 0}
            label={formatMessage(
              {
                id: "bulk.check",
                defaultMessage:
                  "{n, plural, =0 {Check the list} one {Check # address} other {Check # addresses}}",
              },
              { n: entries.length },
            )}
          />
          <span className={styles.hint}>
            <FormattedMessage
              id="bulk.checkHint"
              defaultMessage="Nothing is sent yet — this only reads the list back."
            />
          </span>
        </div>
      ) : (
        <ReadBack
          screened={screened}
          lines={entries.map((e) => e.line)}
          busy={busy}
          onSend={send}
          onBack={() => {
            setScreened(null);
          }}
        />
      )}
    </>
  );
}

/** The list read back, by row, before anybody is written to. */
function ReadBack({
  screened,
  lines,
  busy,
  onSend,
  onBack,
}: {
  readonly screened: ScreenResult;
  /** Source line of each verdict, positionally — see parseEmails. */
  readonly lines: readonly number[];
  readonly busy: boolean;
  readonly onSend: () => void;
  readonly onBack: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const count = (verdict: InviteVerdict) =>
    screened.verdicts.filter((v) => v.verdict === verdict).length;
  const tone: Record<InviteVerdict, string> = {
    "invite": styles.new,
    "repeated": styles.dup,
    "already-here": styles.has,
    "already-invited": styles.has,
    "not-an-address": styles.bad,
  };
  const label: Record<InviteVerdict, ReactNode> = {
    "invite": (
      <FormattedMessage id="bulk.v.invite" defaultMessage="will be invited" />
    ),
    "repeated": (
      <FormattedMessage
        id="bulk.v.repeated"
        defaultMessage="repeated — skipped"
      />
    ),
    "already-here": (
      <FormattedMessage
        id="bulk.v.here"
        defaultMessage="already joined — skipped"
      />
    ),
    "already-invited": (
      <FormattedMessage
        id="bulk.v.invited"
        defaultMessage="already invited — skipped"
      />
    ),
    "not-an-address": (
      <FormattedMessage
        id="bulk.v.bad"
        defaultMessage="not an address — fix or drop"
      />
    ),
  };

  const short =
    screened.seatsLeft != null && screened.willInvite > screened.seatsLeft;

  return (
    <>
      <div className={styles.prev}>
        {screened.verdicts.map((v, index) => (
          <div key={index} className={styles.prow}>
            <span>
              <span className={styles.rowNo}>
                {formatMessage(
                  { id: "bulk.rowNo", defaultMessage: "row {n}" },
                  { n: lines[index] ?? index + 1 },
                )}
              </span>{" "}
              {v.email}
            </span>
            <span className={`${styles.ptag} ${tone[v.verdict]}`}>
              {label[v.verdict]}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.psum}>
        <span>
          <b className={styles.mint}>{count("invite")}</b>
          <FormattedMessage id="bulk.sum.new" defaultMessage="to invite" />
        </span>
        <span>
          <b className={styles.warn}>{count("repeated")}</b>
          <FormattedMessage id="bulk.sum.dup" defaultMessage="repeated" />
        </span>
        <span>
          <b className={styles.faint}>
            {count("already-here") + count("already-invited")}
          </b>
          <FormattedMessage id="bulk.sum.has" defaultMessage="already in" />
        </span>
        <span>
          <b className={styles.err}>{count("not-an-address")}</b>
          <FormattedMessage id="bulk.sum.bad" defaultMessage="to fix" />
        </span>
        <button type="button" className={styles.quiet} onClick={onBack}>
          <FormattedMessage id="bulk.edit" defaultMessage="edit the list" />
        </button>
        <Button
          onClick={onSend}
          disabled={busy || screened.willInvite === 0 || short}
          label={formatMessage(
            {
              id: "bulk.send",
              defaultMessage:
                "{n, plural, =0 {Nothing to send} one {Send # invite} other {Send # invites}}",
            },
            { n: screened.willInvite },
          )}
        />
      </div>

      {short && (
        <p className={styles.error}>
          <FormattedMessage
            id="bulk.short"
            defaultMessage="That needs {need} seats and {left} are free. Ask for more, or trim the list."
            values={{ need: screened.willInvite, left: screened.seatsLeft }}
          />
        </p>
      )}

      <p className={styles.note}>
        <FormattedMessage
          id="bulk.addressNote"
          defaultMessage="The address is who we write to, never who may accept. Parents often hold the school's address at work and their KeyLearn account at home, and some couples share one account. The invite still works exactly once, so the count is still the count."
        />
      </p>
    </>
  );
}

/**
 * The paper route: anonymous slips for the hall.
 *
 * The tokens come back exactly once and are never readable again — the
 * printed sheet IS the only copy. So they are held in memory and shown
 * immediately, and the screen says plainly that closing it loses them.
 */
function OnPaper({
  id,
  batchId,
  overview,
}: {
  readonly id: number;
  readonly batchId: number | null;
  readonly overview: OrgOverview;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [count, setCount] = useState(20);
  const [slips, setSlips] = useState<readonly Slip[] | null>(null);
  const [busy, setBusy] = useState(false);

  const make = () => {
    setBusy(true);
    OrgService.inviteSlips(id, "guardian", batchId, count)
      .then((made) => {
        setSlips(made);
        setBusy(false);
      })
      .catch(() => {
        setBusy(false);
      });
  };

  const className =
    overview.batches.find((b) => b.id === batchId)?.name ??
    overview.organization.name;

  if (slips != null) {
    return (
      <>
        <h3 className={styles.sub}>
          <FormattedMessage
            id="bulk.slips.ready"
            defaultMessage="Print this now"
          />
        </h3>
        <p className={styles.warnBar}>
          <FormattedMessage
            id="bulk.slips.once"
            defaultMessage="These codes are shown once and cannot be shown again — the sheet is the only copy. Print or save it before you leave this page. The invites themselves are safe either way; an unprinted one simply expires unused."
          />
        </p>
        <div className={styles.sheet}>
          <div className={styles.sheetHead}>
            <b>
              {overview.organization.name} — {className}
            </b>
            <span>
              <FormattedMessage
                id="bulk.slips.head"
                defaultMessage="{n} slips · each works once"
                values={{ n: slips.length }}
              />
            </span>
          </div>
          <div className={styles.tear}>
            {slips.map((slip) => (
              <div key={slip.id} className={styles.slip}>
                <p className={styles.sname}>{overview.organization.name}</p>
                <p className={styles.scode}>{slip.url}</p>
                <p className={styles.sfoot}>
                  {className} ·{" "}
                  <FormattedMessage
                    id="bulk.slips.expires"
                    defaultMessage="expires {date}"
                    values={{
                      date: new Date(slip.expiresAt).toLocaleDateString(),
                    }}
                  />
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            onClick={() => {
              window.print();
            }}
            label={formatMessage({
              id: "bulk.slips.print",
              defaultMessage: "Print",
            })}
          />
          <button
            type="button"
            className={styles.quiet}
            onClick={() => {
              setSlips(null);
            }}
          >
            <FormattedMessage
              id="bulk.slips.done"
              defaultMessage="Done — hide these"
            />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h3 className={styles.sub}>
        <FormattedMessage
          id="bulk.onPaper"
          defaultMessage="On paper — slips to hand out"
        />
      </h3>
      <p className={styles.note}>
        <FormattedMessage
          id="bulk.onPaper.note"
          defaultMessage="For the families whose address bounced or was never collected. Any parent may use any slip, and each works once."
        />
      </p>
      <div className={styles.actions}>
        <label className={styles.pick}>
          <span>
            <FormattedMessage id="bulk.howMany" defaultMessage="how many" />
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(event) => {
              setCount(
                Math.max(1, Math.min(200, Number(event.target.value) || 1)),
              );
            }}
          />
        </label>
        <Button
          onClick={make}
          disabled={busy}
          label={formatMessage({
            id: "bulk.slips.make",
            defaultMessage: "Create slips",
          })}
        />
      </div>
    </>
  );
}

/**
 * Reads a pasted block or a CSV into addresses.
 *
 * Deliberately forgiving about shape and strict about nothing: a school
 * secretary's export has a header row, quoted fields, a trailing blank
 * line and a stray semicolon, and none of that is worth an error
 * message. Anything containing an `@` in any column is taken as the
 * address; everything else on the line is ignored, including the name
 * column, because the parent names themselves when they join.
 */
export function parseEmails(raw: string): { email: string; line: number }[] {
  const out: { email: string; line: number }[] = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") {
      continue;
    }
    const cells = line
      .split(/[,;\t]/)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    const cell = cells.find((c) => c.includes("@"));
    if (cell == null) {
      // A header row, or a line with no address in it at all. Skipping
      // beats reporting "row 1 is not an address" for `name,email,class`.
      continue;
    }
    // The line number in THEIR file, not our position in the result.
    // Skipping a header and then saying "row 1" for what the spreadsheet
    // calls row 2 makes the number worse than useless.
    out.push({ email: cell, line: i + 1 });
  }
  return out;
}
