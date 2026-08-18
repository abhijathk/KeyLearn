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
        <RouterLink to={Pages.help.path}>
          <FormattedMessage
            id="support.grownUpOnly.help"
            defaultMessage="In the meantime, the help pages might have your answer."
          />
        </RouterLink>
      </p>
    </div>
  );
}

export function SupportPage(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const captcha = useCaptcha();
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
        if (isCaptchaRequired(err)) {
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
              defaultMessage="Still stuck? The <help>Help page</help> and the <guide>User Guide</guide> cover how KeyLearn works in more depth."
              values={{
                help: (chunks: ReactNode) => (
                  <RouterLink to={Pages.help.path}>{chunks}</RouterLink>
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
