import { AccountService, AuthPage } from "@keylearn/page-account";
import {
  Pages,
  type ProfileDetails,
  usePageData,
} from "@keylearn/pages-shared";
import { Button, FloatingShell } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./JoinPage.module.less";
import { RoleName } from "./roles.tsx";
import { OrgService } from "./service.ts";

/**
 * Where an invite link lands — docs/organisations.md §5.3.
 *
 * There is no organisation login, and this is not one. The band at the
 * top names who invited you and as what; everything beneath it is the
 * ordinary sign-in form. Signing in is what accepts the invite, so a
 * coordinator never has to find their way back here afterwards.
 *
 * The band appears here and nowhere else, because here the URL already
 * carries the answer: the token says which organisation. On the plain
 * login page nothing is known yet, so nothing is claimed.
 */

type Preview = Awaited<ReturnType<typeof OrgService.previewInvite>>;

export function JoinPage({ token }: { readonly token: string }): ReactNode {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let live = true;
    OrgService.previewInvite(token)
      .then((p) => {
        if (live) {
          setPreview(p);
        }
      })
      .catch(() => {
        if (live) {
          setPreview({ valid: false });
        }
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (preview == null) {
    return null;
  }
  if (!preview.valid) {
    return <DeadEnd />;
  }
  return <LiveInvite token={token} preview={preview} />;
}

/**
 * Expired, already used, revoked, and never-existed all arrive here
 * saying the same thing — a screen that told them apart would let a
 * stranger with a guessed link learn which guesses were close.
 *
 * Deliberately not a login form: there is nothing to sign into yet. And
 * deliberately not a 404: nothing is broken, and a parent who was handed
 * this on paper a fortnight ago should not be told the page does not
 * exist. It is a dead end with the one instruction that helps.
 */
function DeadEnd(): ReactNode {
  return (
    <FloatingShell compact={true}>
      <div className={styles.dead}>
        <span className={styles.deadMark}>
          <svg viewBox="0 0 16 16" aria-hidden={true}>
            <path d="M8 1.8l6.2 11H1.8zM8 6.2v3.4M8 11.4v.1" />
          </svg>
        </span>
        <h1 className={styles.headline}>
          <FormattedMessage
            id="join.dead.title"
            defaultMessage="This link has had its day"
          />
        </h1>
        <p className={styles.intro}>
          <FormattedMessage
            id="join.dead.body"
            defaultMessage="Invites last a couple of weeks and can only be used once, so this one has either been used already or run out of time. Nothing is wrong with your account."
          />
        </p>
        <p className={styles.deadWhy}>
          <FormattedMessage
            id="join.dead.what"
            defaultMessage="Ask whoever sent it for a fresh one. If it was handed to you on paper at a class, your teacher can print another in a moment."
          />
        </p>
        <Button
          onClick={() => window.location.assign(Pages.practice.path)}
          label={
            <FormattedMessage
              id="join.dead.away"
              defaultMessage="Go to KeyLearn"
            />
          }
          size="full"
        />
      </div>
    </FloatingShell>
  );
}

function LiveInvite({
  token,
  preview,
}: {
  readonly token: string;
  readonly preview: Extract<Preview, { valid: true }>;
}): ReactNode {
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;

  // The band goes INSIDE the card, not above it: the sign-in form is a
  // modal, so anything outside sits behind the scrim, and "which school
  // is this?" is the one question a parent must be able to answer here.
  return signedIn ? (
    <AcceptStep token={token} preview={preview} />
  ) : (
    <AuthPage mode="login" banner={<InviteBand preview={preview} />} />
  );
}

/** Who invited you, as what, and how long you have. */
function InviteBand({
  preview,
}: {
  readonly preview: Extract<Preview, { valid: true }>;
}): ReactNode {
  const { formatMessage } = useIntl();
  const initials = preview.organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const days = Math.max(
    0,
    Math.ceil(
      (new Date(preview.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000),
    ),
  );
  return (
    <div className={styles.band}>
      <span className={styles.orgMark}>{initials}</span>
      <div className={styles.bandText}>
        <b>{preview.organization.name}</b>
        <span>
          {preview.role === "guardian" ? (
            preview.batchName != null ? (
              <FormattedMessage
                id="join.band.guardian"
                defaultMessage="Enrolling into {batch}."
                values={{ batch: preview.batchName }}
              />
            ) : (
              <FormattedMessage
                id="join.band.guardianPlain"
                defaultMessage="You’ve been invited to enrol your learners."
              />
            )
          ) : preview.batchName != null ? (
            <FormattedMessage
              id="join.band.roleBatch"
              defaultMessage="You’ve been invited as {role} for {batch}."
              values={{
                role: <RoleName role={preview.role} />,
                batch: preview.batchName,
              }}
            />
          ) : (
            <FormattedMessage
              id="join.band.role"
              defaultMessage="You’ve been invited as {role}."
              values={{ role: <RoleName role={preview.role} /> }}
            />
          )}
        </span>
        <span className={styles.expiry}>
          {formatMessage(
            {
              id: "join.band.expiry",
              defaultMessage:
                "{days, plural, =0 {expires today} one {expires tomorrow} other {expires in # days}} · single use",
            },
            { days },
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Signed in already. A staff invite is one tap; a guardian invite is not,
 * because a guardian invite hands a school sight of a child.
 *
 * The tick boxes ARE the consent record (§4.4) — one grant row per child
 * ticked — so this screen has to name what the school will see and say
 * plainly that it can be taken back. A parent with three children at two
 * schools ticks one; nothing is enrolled by default.
 */
function AcceptStep({
  token,
  preview,
}: {
  readonly token: string;
  readonly preview: Extract<Preview, { valid: true }>;
}): ReactNode {
  const guardian = preview.role === "guardian";
  const [learners, setLearners] = useState<readonly ProfileDetails[] | null>(
    null,
  );
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!guardian) {
      return;
    }
    let live = true;
    AccountService.listProfiles()
      .then((all) => {
        if (live) {
          setLearners(all);
        }
      })
      .catch(() => {
        if (live) {
          setLearners([]);
        }
      });
    return () => {
      live = false;
    };
  }, [guardian]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };

  const accept = () => {
    setBusy(true);
    setError(null);
    OrgService.acceptInvite(
      token,
      // ProfileDetails.id is the numeric id as a string — the same
      // Number() the profile routes do.
      guardian ? [...picked].map(Number) : undefined,
    )
      .then((result) => {
        if (result.error != null) {
          setError(result.error);
          setBusy(false);
        } else {
          window.location.assign(Pages.practice.path);
        }
      })
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <FloatingShell compact={true}>
      <InviteBand preview={preview} />
      <div className={styles.accept}>
        <h1 className={styles.headline}>
          <FormattedMessage
            id="join.accept.title"
            defaultMessage="Join {org}"
            values={{ org: preview.organization.name }}
          />
        </h1>

        {guardian ? (
          <>
            <p className={styles.intro}>
              <FormattedMessage
                id="join.accept.whoAsk"
                defaultMessage="Who is joining this class?"
              />
            </p>
            {learners == null ? null : learners.length === 0 ? (
              <p className={styles.deadWhy}>
                <FormattedMessage
                  id="join.accept.noLearners"
                  defaultMessage="This account has no learners yet. Add one first, then open this link again — it will still be here."
                />
              </p>
            ) : (
              <ul className={styles.pickList}>
                {learners.map((learner) => (
                  <li key={learner.id}>
                    <label className={styles.pick}>
                      <input
                        type="checkbox"
                        checked={picked.has(learner.id)}
                        onChange={() => {
                          toggle(learner.id);
                        }}
                      />
                      <span className={styles.pickName}>
                        {learner.firstName}
                        {learner.lastName ? ` ${learner.lastName}` : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {/* Said before the tap, not in a policy page afterwards. */}
            <p className={styles.consent}>
              <FormattedMessage
                id="join.accept.consent"
                defaultMessage="{org} will see the progress of the learners you tick — how they are getting on in the class, nothing else. Their account stays yours, and you can end this from your account page at any time."
                values={{ org: preview.organization.name }}
              />
            </p>
          </>
        ) : (
          <>
            <p className={styles.intro}>
              <FormattedMessage
                id="join.accept.asRole"
                defaultMessage="You’ll join as {role}{batch, select, none {} other { for {batch}}}."
                values={{
                  role: <RoleName role={preview.role} />,
                  batch: preview.batchName ?? "none",
                }}
              />
            </p>
            {/* Once the refusal has said this in full, the advance
                warning is just the same sentence twice. */}
            {preview.staffEmailDomains.length > 0 && error == null && (
              <p className={styles.deadWhy}>
                <FormattedMessage
                  id="join.accept.staffDomain"
                  defaultMessage="{org}’s {role}s sign in with a {domains} address."
                  values={{
                    org: preview.organization.name,
                    role: <RoleName role={preview.role} />,
                    domains: preview.staffEmailDomains
                      .map((d) => `@${d}`)
                      .join(" or "),
                  }}
                />
              </p>
            )}
          </>
        )}

        {error != null && <p className={styles.error}>{error}</p>}
        <Button
          onClick={accept}
          disabled={busy || (guardian && picked.size === 0)}
          label={
            guardian ? (
              <FormattedMessage
                id="join.accept.submitGuardian"
                defaultMessage="{n, plural, =0 {Accept} one {Enrol # learner} other {Enrol # learners}}"
                values={{ n: picked.size }}
              />
            ) : (
              <FormattedMessage
                id="join.accept.submit"
                defaultMessage="Accept"
              />
            )
          }
          size="full"
        />
      </div>
    </FloatingShell>
  );
}
