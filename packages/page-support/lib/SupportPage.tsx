import {
  activeProfileKind,
  Pages,
  PROFILE_CHANGED_EVENT,
  usePageData,
} from "@keylearn/pages-shared";
import { Button, Icon, TextField, toast } from "@keylearn/widget";
import { mdiEmailFastOutline } from "@mdi/js";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import { SupportService, type TicketKind } from "./service.ts";
import * as styles from "./SupportPage.module.less";
import { isCaptchaRequired, useCaptcha } from "./turnstile.tsx";

const FAQ: {
  readonly id: string;
  readonly q: ReactNode;
  readonly a: ReactNode;
}[] = [
  {
    id: "password",
    q: (
      <FormattedMessage
        id="support.faq.password.q"
        defaultMessage="I forgot my password — what do I do?"
      />
    ),
    a: (
      <FormattedMessage
        id="support.faq.password.a"
        defaultMessage="Use “Forgot password” on the sign-in page. If you signed up with Google, Microsoft or Facebook, sign in with that provider instead — there's no separate password to reset."
      />
    ),
  },
  {
    id: "free",
    q: (
      <FormattedMessage
        id="support.faq.free.q"
        defaultMessage="Is KeyLearn actually free?"
      />
    ),
    a: (
      <FormattedMessage
        id="support.faq.free.a"
        defaultMessage="Yes — every lesson, every learner in your household, no ads blocking practice. Supporting the project is entirely voluntary."
      />
    ),
  },
  {
    id: "data",
    q: (
      <FormattedMessage
        id="support.faq.data.q"
        defaultMessage="Can I export or delete my typing data?"
      />
    ),
    a: (
      <FormattedMessage
        id="support.faq.data.a"
        defaultMessage="Yes, any time — from Account → Security you can export everything or erase a single learner's progress without affecting the rest of the household."
      />
    ),
  },
  {
    id: "certificate",
    q: (
      <FormattedMessage
        id="support.faq.certificate.q"
        defaultMessage="Is a KeyLearn certificate an official qualification?"
      />
    ),
    a: (
      <FormattedMessage
        id="support.faq.certificate.a"
        defaultMessage="It's honest evidence of a measured speed and accuracy on a given date — not a qualification any school, exam board or employer has agreed to recognise."
      />
    ),
  },
  {
    id: "kids",
    q: (
      <FormattedMessage
        id="support.faq.kids.q"
        defaultMessage="Is Kids mode safe for my child to use alone?"
      />
    ),
    a: (
      <FormattedMessage
        id="support.faq.kids.a"
        defaultMessage="There's no chat, no strangers and no way to share personal details — it's a solo typing game. A parent or guardian still needs to create the profile and give consent."
      />
    ),
  },
];

/**
 * Whether a kid profile is the one currently in use on this device.
 *
 * The active profile is a browser-side choice (localStorage), never part
 * of the session — the server only ever knows the ACCOUNT. So this is a
 * front-door guard, not a security boundary, and it doesn't need to be:
 * a ticket is always attributed to the account holder regardless, and
 * the point is that a child shouldn't be writing to strangers from a
 * parent's account, not that the check be unforgeable.
 */
function useKidActive(): boolean {
  const [kid, setKid] = useState(() => activeProfileKind() === "kid");
  useEffect(() => {
    const recheck = () => setKid(activeProfileKind() === "kid");
    // Switching profile doesn't reload the page, so listen for the swap.
    window.addEventListener(PROFILE_CHANGED_EVENT, recheck);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, recheck);
  }, []);
  return kid;
}

/**
 * Shown instead of the form while a kid profile is active. Deliberately
 * an explanation rather than a redirect: a child who tapped Help and got
 * silently thrown back to the kids page learns nothing, and the thing
 * they actually need is to go and find a grown-up.
 */
function GrownUpOnly(): ReactNode {
  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage id="support.headline" defaultMessage="Support" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="support.grownUpOnly"
          defaultMessage="Messages to us are sent by the grown-up who owns this account. Ask them to switch to their own profile and write to us — they'll get our reply by email."
        />
      </p>
      <p className={styles.intro}>
        <RouterLink to={Pages.helpCentre.path}>
          <FormattedMessage
            id="support.grownUpOnly.help"
            defaultMessage="In the meantime, the help pages might have your answer."
          />
        </RouterLink>
      </p>
    </div>
  );
}

/**
 * The grown-up PIN gate for support.
 *
 * Shown when the page opens, not when the form is submitted. The rule is
 * that the support section does not open without the PIN, and a gate that
 * fires on Send has already shown somebody the section — including any
 * previous conversation on it.
 *
 * It can be dismissed, because a locked screen with no way out is its own
 * kind of failure. Dismissing does not reveal the section: it leaves the
 * lock in place with a way back in, which is what {@link SupportLocked}
 * is for.
 */
function ParentPinGate({
  setupRequired,
  onPass,
  onClose,
}: {
  readonly setupRequired: boolean;
  readonly onPass: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (setupRequired) {
    return (
      <div className={styles.page}>
        <h1 className={styles.headline}>
          <FormattedMessage id="support.headline" defaultMessage="Support" />
        </h1>
        <p className={styles.intro}>
          <FormattedMessage
            id="support.pin.setupNeeded"
            defaultMessage="There's a kid profile on this account, so writing to us needs a grown-up PIN. Set one up in your account settings and come back — it takes a moment, and it keeps these conversations out of small hands."
          />
        </p>
        <p className={styles.intro}>
          <RouterLink to={`${Pages.account.path}#security`}>
            <FormattedMessage
              id="support.pin.setupLink"
              defaultMessage="Set up a grown-up PIN"
            />
          </RouterLink>
        </p>
        <Button
          label={formatMessage({
            id: "support.pin.close",
            defaultMessage: "Not now",
          })}
          onClick={onClose}
        />
      </div>
    );
  }

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await SupportService.verifyParentPin(pin);
      onPass();
    } catch {
      setErr(
        formatMessage({
          id: "support.pin.wrong",
          defaultMessage: "That PIN is not right.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage id="support.headline" defaultMessage="Support" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="support.pin.intro"
          defaultMessage="Enter the grown-up PIN to open support."
        />
      </p>
      <TextField
        size="full"
        type="password"
        value={pin}
        placeholder={formatMessage({
          id: "support.pin.plain",
          defaultMessage: "PIN",
        })}
        onChange={setPin}
      />
      {err != null && <p className={styles.error}>{err}</p>}
      <Button
        label={formatMessage({
          id: "support.pin.submit",
          defaultMessage: "Continue",
        })}
        disabled={busy || pin.trim() === ""}
        onClick={() => {
          void submit();
        }}
      />
      <Button
        label={formatMessage({
          id: "support.pin.close",
          defaultMessage: "Not now",
        })}
        onClick={onClose}
      />
    </div>
  );
}

/**
 * What is left after the gate is dismissed. Never the support section —
 * just the door, and the handle.
 */
function SupportLocked({
  setupRequired,
  onOpen,
}: {
  readonly setupRequired: boolean;
  readonly onOpen: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage id="support.headline" defaultMessage="Support" />
      </h1>
      <p className={styles.intro}>
        {setupRequired ? (
          <FormattedMessage
            id="support.locked.setup"
            defaultMessage="Support is for the grown-up who owns this account. Set up a grown-up PIN to open it."
          />
        ) : (
          <FormattedMessage
            id="support.locked.intro"
            defaultMessage="Support is for the grown-up who owns this account. Enter the PIN to open it."
          />
        )}
      </p>
      <Button
        label={formatMessage(
          setupRequired
            ? { id: "support.locked.setupCta", defaultMessage: "Set up a PIN" }
            : {
                id: "support.locked.cta",
                defaultMessage: "Enter the grown-up PIN",
              },
        )}
        onClick={onOpen}
      />
    </div>
  );
}

export function SupportPage({
  gated = false,
}: {
  /**
   * Put the grown-up PIN in front of this section.
   *
   * Only the copy mounted inside the account dialog sets it. The standalone
   * route is the door for people with no account, where there is nobody to
   * identify and nothing to check — a PIN there would lock out the very
   * visitors it exists for. The server agrees: an anonymous request is
   * never gated (see auth/parent-pin.ts).
   */
  readonly gated?: boolean;
} = {}): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  // Eager: the guest form is the one door into the desk that needs no
  // account, so the server requires a token on every submission. Mounting
  // the widget here means it is solved in the background while somebody
  // writes their message, and the first press of Send already has one.
  const captcha = useCaptcha({ eager: true });
  const kidActive = useKidActive();

  const [kind, setKind] = useState<TicketKind>("support");
  const [name, setName] = useState(
    publicUser.id != null ? publicUser.name : "",
  );
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Set when the server answers 428. `setup` means the household has a kid
  // profile but no PIN yet, so there is nothing to prompt for.
  // The server's answer, fetched on load. `null` while we are still asking —
  // the section stays closed until we know, because opening it and then
  // taking it away would already have shown it.
  const [gate, setGate] = useState<SupportService.SupportGate | null>(null);
  const [promptOpen, setPromptOpen] = useState(true);

  useEffect(() => {
    if (!gated) {
      setGate({
        required: false,
        setupRequired: false,
        proved: true,
        length: null,
      });
      return;
    }
    let live = true;
    SupportService.getGate()
      .then((g) => {
        if (live) {
          setGate(g);
        }
      })
      .catch(() => {
        // Fail closed on a signed-in session we could not classify: the
        // server refuses the actions anyway, so an optimistic page would
        // only offer a form that cannot be sent.
        if (live) {
          setGate(
            publicUser.id != null
              ? {
                  required: true,
                  setupRequired: false,
                  proved: false,
                  length: null,
                }
              : {
                  required: false,
                  setupRequired: false,
                  proved: true,
                  length: null,
                },
          );
        }
      });
    return () => {
      live = false;
    };
  }, [gated, publicUser.id]);

  const valid =
    name.trim() !== "" &&
    email.trim() !== "" &&
    subject.trim() !== "" &&
    message.trim() !== "";

  const submit = () => {
    if (!valid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    SupportService.createTicket({
      kind,
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      turnstileToken: captcha.token,
      website,
    })
      .then(() => {
        setSent(true);
        toast(
          <FormattedMessage
            id="support.form.sentToast"
            defaultMessage="Sent — thanks, we'll reply by email."
          />,
        );
      })
      .catch((err: any) => {
        if (err?.status === 428 && err?.body?.error?.parentPin === true) {
          // The 15-minute window can lapse between opening the page and
          // pressing Send. The server is the one that noticed; put the gate
          // back rather than showing a bare error.
          setGate({
            required: true,
            setupRequired: err.body.error.parentPinSetupRequired === true,
            proved: false,
            // The 428 does not carry it; the next getGate() will.
            length: err.body.error.parentPinLength ?? null,
          });
          setPromptOpen(true);
        } else if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "support.form.captchaRequired",
              defaultMessage: "Please complete the verification and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
      })
      .finally(() => setBusy(false));
  };

  if (kidActive) {
    return <GrownUpOnly />;
  }

  // Still asking. Render nothing rather than the section — a flash of the
  // form before the lock appears is the same leak, just briefer.
  if (gate == null) {
    return <div className={styles.page} />;
  }

  // The section does not open without the PIN. Unlike `kidActive` above —
  // which only knows which profile is currently selected, and is a step
  // away from any child who switches profiles — this is the server's own
  // answer, and the same function decides what it will permit.
  if (gate.required && !gate.proved) {
    return promptOpen ? (
      <ParentPinGate
        setupRequired={gate.setupRequired}
        onPass={() => setGate({ ...gate, proved: true })}
        onClose={() => setPromptOpen(false)}
      />
    ) : (
      <SupportLocked
        setupRequired={gate.setupRequired}
        onOpen={() => setPromptOpen(true)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage id="support.headline" defaultMessage="Support" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="support.intro"
          defaultMessage="Most answers are below. Can't find yours? Send a message and we'll reply by email."
        />
      </p>

      <div className={styles.columns}>
        <div className={styles.left}>
          <h2 className={styles.colHeadline}>
            <FormattedMessage
              id="support.faq.headline"
              defaultMessage="Frequently asked"
            />
          </h2>
          <div className={styles.faq}>
            {FAQ.map((item) => (
              <details key={item.id} className={styles.faqItem}>
                <summary className={styles.faqQ}>{item.q}</summary>
                <p className={styles.faqA}>{item.a}</p>
              </details>
            ))}
          </div>

          <p className={styles.moreLinks}>
            <FormattedMessage
              id="support.moreLinks"
              defaultMessage="Still stuck? <help>Help articles</help> answer the most common questions, and the <guide>User Guide</guide> covers how KeyLearn works in more depth."
              values={{
                help: (chunks: ReactNode) => (
                  <RouterLink to={Pages.helpCentre.path}>{chunks}</RouterLink>
                ),
                guide: (chunks: ReactNode) => (
                  <RouterLink to={Pages.guide.path}>{chunks}</RouterLink>
                ),
              }}
            />
          </p>
        </div>

        <div className={styles.right}>
          <h2 className={styles.colHeadline}>
            <FormattedMessage
              id="support.form.headline"
              defaultMessage="Send a message"
            />
          </h2>

          {sent ? (
            <p className={styles.notice}>
              <FormattedMessage
                id="support.form.sent"
                defaultMessage="Thanks — your message is in. We reply by email, usually within a couple of days."
              />
            </p>
          ) : (
            <form
              className={styles.form}
              onSubmit={(ev) => {
                ev.preventDefault();
                submit();
              }}
            >
              <span className={styles.kindRow} role="group">
                <button
                  type="button"
                  className={
                    kind === "support" ? styles.kindBtnOn : styles.kindBtn
                  }
                  onClick={() => setKind("support")}
                >
                  <FormattedMessage
                    id="support.form.kind.support"
                    defaultMessage="General support"
                  />
                </button>
                <button
                  type="button"
                  className={
                    kind === "business" ? styles.kindBtnOn : styles.kindBtn
                  }
                  onClick={() => setKind("business")}
                >
                  <FormattedMessage
                    id="support.form.kind.business"
                    defaultMessage="Business enquiry"
                  />
                </button>
              </span>

              <TextField
                type="text"
                size="full"
                maxLength={64}
                placeholder={formatMessage({
                  id: "support.form.name",
                  defaultMessage: "Your name",
                })}
                value={name}
                onChange={setName}
              />
              <TextField
                type="email"
                size="full"
                maxLength={128}
                autoComplete="email"
                placeholder={formatMessage({
                  id: "support.form.email",
                  defaultMessage: "Email address",
                })}
                value={email}
                onChange={setEmail}
              />
              <TextField
                type="text"
                size="full"
                maxLength={128}
                placeholder={formatMessage({
                  id: "support.form.subject",
                  defaultMessage: "Subject",
                })}
                value={subject}
                onChange={setSubject}
              />
              <TextField
                type="textarea"
                size="full"
                rows={6}
                maxLength={4000}
                placeholder={formatMessage({
                  id: "support.form.message",
                  defaultMessage: "What's going on?",
                })}
                value={message}
                onChange={setMessage}
              />

              {/* Honeypot: invisible to a sighted or screen-reader visitor,
                  but present in the DOM for a bot that fills every field it
                  finds. */}
              <div className={styles.hp} aria-hidden="true">
                <label>
                  <FormattedMessage
                    id="support.form.honeypotLabel"
                    defaultMessage="Website"
                  />
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(ev) => setWebsite(ev.target.value)}
                  />
                </label>
              </div>

              {error != null && <p className={styles.error}>{error}</p>}
              {captcha.widget}

              <div className={styles.primary}>
                <Button
                  size="full"
                  icon={<Icon shape={mdiEmailFastOutline} />}
                  label={formatMessage({
                    id: "support.form.submit",
                    defaultMessage: "Send message",
                  })}
                  disabled={busy || !valid}
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
