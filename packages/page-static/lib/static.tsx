import { supportUrl } from "@keylearn/thirdparties";
import { StrokeIcon } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  GUIDE_EN,
  type GuideBlock,
  type GuideDoc,
  guideFor,
  renderRich,
} from "./guide-content.tsx";
import { ReleaseNotesDialog } from "./ReleaseNotesDialog.tsx";
import * as styles from "./road.module.less";

// The legal pages, written to be read: plain words, honest promises, and the
// same road design language as the rest of the app.

// Rich-text chunk used across the localized copy so words can be emphasised
// inside a translatable message rather than split into fragments.
const em = (chunks: ReactNode) => <em>{chunks}</em>;

// The support address, as a rich-text chunk. Several legal/help paragraphs
// end in "write to support@keylearn.org" — one chunk keeps the mailto: link
// and the visible address in sync everywhere it appears.
const supportLink = (chunks: ReactNode) => (
  <a href="mailto:support@keylearn.org">{chunks}</a>
);

function Masthead({
  kicker,
  title,
  dateline,
  chip,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly dateline: string;
  /** An optional pill in the header's own top-right corner — room for a
   * single, high-value action (the About page's contact address) without
   * competing with the page's own sections below. */
  readonly chip?: ReactNode;
}) {
  return (
    <header className={chip != null ? styles.mastheadRow : undefined}>
      <div>
        <div className={styles.kicker}>{kicker}</div>
        <div className={styles.nameplate}>{title}</div>
        <div className={styles.dateline}>{dateline}</div>
      </div>
      {chip}
    </header>
  );
}

function ContactChip() {
  return (
    <a href="mailto:support@keylearn.org" className={styles.contactCard}>
      <span className={styles.contactIconBox}>
        <StrokeIcon name="mail" className={styles.contactIcon} />
      </span>
      <span className={styles.contactBody}>
        <span className={styles.contactLabel}>
          <FormattedMessage
            id="about.contact.need"
            defaultMessage="Need help?"
          />
        </span>
        <span className={styles.contactLine}>
          <FormattedMessage id="about.contact.h" defaultMessage="Contact" />
          <span className={styles.contactDot} aria-hidden={true}>
            •
          </span>
          <span className={styles.contactEmail}>support@keylearn.org</span>
        </span>
      </span>
    </a>
  );
}

function Sect({ children }: { readonly children: ReactNode }) {
  return <div className={styles.sect}>{children}</div>;
}

// Bump on every release. Format: MAJOR.MINOR.PATCH, zero-padded.
export const APP_VERSION = "01.02.00";

export function AboutPage() {
  const { formatMessage } = useIntl();
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <div className={styles.paper}>
      <Masthead
        kicker={formatMessage({
          id: "about.kicker",
          defaultMessage: "The KeyLearn story",
        })}
        title={formatMessage({
          id: "about.title",
          defaultMessage: "About KeyLearn",
        })}
        dateline={formatMessage(
          {
            id: "about.dateline",
            defaultMessage: "Free · Open source · Version {version}",
          },
          { version: APP_VERSION },
        )}
        chip={<ContactChip />}
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>
          <FormattedMessage
            id="about.glance.label"
            defaultMessage="In a sentence"
          />
        </div>
        <ul>
          <li>
            <FormattedMessage
              id="about.glance.1"
              defaultMessage="KeyLearn is a <em>free, open-source</em> touch-typing tutor for the whole household — grown-ups and kids alike."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="about.glance.2"
              defaultMessage="It watches the keys that slow you down and builds your practice around <em>them</em>, so every minute is spent where it counts."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="about.glance.3"
              defaultMessage="Children get a playful dino-run world that adapts to their age; grown-ups get a focused, data-rich practice screen; and a learner who is blind gets a braille mode built for the purpose."
            />
          </li>
          <li>
            <FormattedMessage
              id="about.glance.4"
              defaultMessage="No ads, no trackers, and your data stays yours."
            />
          </li>
        </ul>
      </div>

      <Sect>
        <FormattedMessage
          id="about.why.h"
          defaultMessage="Why KeyLearn exists"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.why.p"
          defaultMessage="Typing well is a quiet superpower, and KeyLearn teaches it the encouraging way — short sessions, honest feedback, and steady progress you can feel. It began in 2026, built on keybr, an open-source typing tutor that had already figured out the hard part: adapting to the keys that slow you down. From there it grew into a typing tutor for the whole family — a playful dino-run world for kids, per-learner household profiles, age-aware pacing, and support for many languages."
        />
      </p>

      <Sect>
        <FormattedMessage id="about.maker.h" defaultMessage="The maker" />
      </Sect>
      <p>
        <FormattedMessage
          id="about.maker.p"
          defaultMessage="KeyLearn is designed and built by <em>AK</em>, an independent developer working mostly solo. It started at the kitchen table, watching a young family member hunt-and-peck at a keyboard and wishing for something that felt more like a game than a chore. AK has spent years building software for the web, but this is the first project made squarely for family — no company behind it, no investors to please, just care put into a tool meant to be genuinely useful. Feedback and contributions are always welcome."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.how.h"
          defaultMessage="How the learning works"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.how.p"
          defaultMessage="Rather than marching you through fixed drills, KeyLearn measures how quickly and cleanly you hit each key and weaves your weak spots into the words it generates. A letter only joins your set once you can type it both quickly <em>and</em> accurately, so the difficulty rises exactly as fast as you do — never faster."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.family.h"
          defaultMessage="Made for the whole family"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.family.p"
          defaultMessage="One account holds a profile for each person in your home, and every profile keeps its own progress. Kids step into a friendly dino-run adventure that scales to their age — shorter sessions, gentler pacing, and bigger encouragement for the youngest — while grown-ups get the full practice screen with detailed statistics. Everyone learns on the same proven engine, just dressed for their age."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.values.h"
          defaultMessage="What we stand for"
        />
      </Sect>
      <ul>
        <li>
          <FormattedMessage
            id="about.values.1"
            defaultMessage="<em>Learners first.</em> Every decision is judged by one question — does it help someone type better and enjoy getting there?"
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="about.values.2"
            defaultMessage="<em>Kindness over pressure.</em> Progress is celebrated, mistakes are forgiven, and no one is shamed into practising."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="about.values.3"
            defaultMessage="<em>Privacy by default.</em> No ads, no trackers, no selling data. Practise as a guest and nothing ever leaves your device."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="about.values.4"
            defaultMessage="<em>Open and honest.</em> The whole source is public, the language is plain, and there are no dark patterns or hidden costs."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="about.values.5"
            defaultMessage="<em>Built to last.</em> Careful, unhurried work over hype — a tool you can trust for years, not a growth experiment."
            values={{ em }}
          />
        </li>
      </ul>

      <Sect>
        <FormattedMessage id="about.inside.h" defaultMessage="What is in it" />
      </Sect>
      <p>
        <FormattedMessage
          id="about.inside.p1"
          defaultMessage="Two courses, because people differ: <em>Guided practice</em> adapts to the keys that slow you down, and <em>Classic course</em> is the fixed ladder a typing book would give you. There is a third for code — real snippets in the language you choose, so brackets and indentation get the drilling prose never gives them."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="about.inside.p2"
          defaultMessage="Alongside them: a speed test, keyboard layouts to compare, high scores, and races against other people in real time. Finish a course and there is a <em>certificate</em> with a number anybody can check — issued by us, honest about what it is, and not pretending to be a qualification somebody else recognises."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.access.h"
          defaultMessage="Built to be usable"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.access.p"
          defaultMessage="A learner who is blind or has low vision gets a <em>braille mode</em> — six-key entry, a curriculum in cells, spoken guidance — rather than the sighted page read aloud. Everyone else gets an accessibility page with five settings that combine freely, and every individual switch underneath: hold animations still, a typeface for dyslexia, larger things to press, never two keys at once, ignore a key that repeats itself, say mistakes in sound, write down what is spoken. Set per learner, because a household shares one login and the person who needs them is not always the one who set the account up."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="about.access.p2"
          defaultMessage="Names describe what each one does, never a condition. Nobody should have to identify themselves with a diagnosis to make an app usable."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.oss.h"
          defaultMessage="Open source, and yours"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.oss.p"
          defaultMessage="KeyLearn is published under the GNU AGPL license: the whole source code is open for you to read, run, or improve. Learning to type is free — every lesson, every learner in your household, and no advertising. If you find it useful you can support the project, but nothing here is held back until you do. Your practice data belongs to you: export it or erase it whenever you like. <a>View the source on GitHub</a>."
          values={{
            a: (chunks: ReactNode) => (
              <a
                href="https://github.com/abhijathk/keylearn"
                target="_blank"
                rel="noreferrer"
              >
                {chunks}
              </a>
            ),
          }}
        />
      </p>

      {supportUrl !== "" && (
        <>
          <Sect>
            <FormattedMessage
              id="about.support.h"
              defaultMessage="Support KeyLearn"
            />
          </Sect>
          <p>
            <FormattedMessage
              id="about.support.p"
              defaultMessage="KeyLearn is free for every learner, and that’s never going to change. If it’s helped you or your kids, buying a coffee helps keep it going. <a>Buy me a coffee</a>."
              values={{
                a: (chunks: ReactNode) => (
                  <a href={supportUrl} target="_blank" rel="noreferrer">
                    {chunks}
                  </a>
                ),
              }}
            />
          </p>
        </>
      )}

      <Sect>
        <FormattedMessage id="about.version.h" defaultMessage="Version" />
      </Sect>
      <p>
        <FormattedMessage
          id="about.version.p"
          defaultMessage="You’re running KeyLearn <em>v{version}</em>. Each release bumps this number so you always know which build you’re on. <a>See what changed</a>."
          values={{
            em,
            version: APP_VERSION,
            a: (chunks: ReactNode) => (
              <button
                type="button"
                className={styles.inlineLink}
                onClick={() => setNotesOpen(true)}
              >
                {chunks}
              </button>
            ),
          }}
        />
      </p>
      {notesOpen && <ReleaseNotesDialog onClose={() => setNotesOpen(false)} />}

      <div className={styles.foot}>
        <FormattedMessage
          id="about.foot"
          defaultMessage="keylearn · v{version} · learn to type, joyfully"
          values={{ version: APP_VERSION }}
        />
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.paper}>
      <Masthead
        kicker={formatMessage({
          id: "terms.kicker",
          defaultMessage: "The KeyLearn small print",
        })}
        title={formatMessage({
          id: "terms.title",
          defaultMessage: "Terms of Service",
        })}
        dateline={formatMessage({
          id: "terms.dateline",
          defaultMessage: "Plain English · Updated August 2026",
        })}
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>
          <FormattedMessage
            id="legal.glanceLabel"
            defaultMessage="The short version"
          />
        </div>
        <ul>
          <li>
            <FormattedMessage
              id="terms.glance.1"
              defaultMessage="KeyLearn is <em>open source</em>, and learning to type is <em>free</em> — every lesson, every learner, no ads. Supporting the project is voluntary and unlocks nothing."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="terms.glance.2"
              defaultMessage="Be a human, keep one account per person, and don’t use KeyLearn to do anything illegal or harmful."
            />
          </li>
          <li>
            <FormattedMessage
              id="terms.glance.3"
              defaultMessage="Your typing data is <em>yours</em> — you can export it or erase it whenever you like, for the whole household or one learner at a time."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="terms.glance.4"
              defaultMessage="Certificates are ours to issue and real to check, but they are <em>not</em> a qualification anybody else has agreed to recognise."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="terms.glance.5"
              defaultMessage="We run this service with care but without warranties: it’s provided as-is, and features may change."
            />
          </li>
        </ul>
      </div>

      <Sect>
        <FormattedMessage id="terms.what.h" defaultMessage="What KeyLearn is" />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.what.p"
          defaultMessage="KeyLearn is an open-source touch-typing tutor. The entire source code is published under the GNU AGPL license, and you’re welcome to read it, run your own copy, or improve it. Learning to type is free: every lesson and every learner in your household, with no advertising. You can support the project voluntarily, and where you pay us anything the payment terms below apply. Using the site means you accept the terms on this page; if you ever disagree with them, simply stop using the service."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="terms.pay.h"
          defaultMessage="Paying for KeyLearn"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.pay.p1"
          defaultMessage="Everything KeyLearn offers is free. Where you choose to support the project voluntarily, payment is handled by our payment provider — we never see or store your card details. Amounts are shown before you confirm, including any tax that applies where you live."
        />
      </p>
      <p>
        <FormattedMessage
          id="terms.pay.p2"
          defaultMessage="Voluntary contributions are gifts rather than purchases: they unlock nothing, and they are not refundable. If that ever changes — if we introduce something paid — we will say so plainly here first."
        />
      </p>

      <Sect>
        <FormattedMessage id="terms.account.h" defaultMessage="Your account" />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.account.p"
          defaultMessage="You don’t need an account at all: as a guest, everything works and your progress lives in your own browser. If you choose to sign in so your progress can follow you across devices, a few simple rules apply:"
        />
      </p>
      <ul>
        <li>
          <FormattedMessage
            id="terms.account.1"
            defaultMessage="Accounts are for humans — no bots or automated sign-ups, please."
          />
        </li>
        <li>
          <FormattedMessage
            id="terms.account.2"
            defaultMessage="One account per household, with a <em>learner profile</em> for each person in it. You do not need an account each."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="terms.account.3"
            defaultMessage="Accounts are for adults. If you add a profile for a child, you are telling us you are their parent or guardian and that you consent on their behalf — and the profile, its practice and its deletion are yours to control."
          />
        </li>
        <li>
          <FormattedMessage
            id="terms.account.4"
            defaultMessage="You are responsible for keeping your sign-in secure, whichever way you use. If someone gets into your account because your password or your provider leaked, we cannot undo what they did. Your account page lists recent sign-ins so you can spot one you did not make, and a passkey or two-step verification makes that far less likely in the first place."
          />
        </li>
      </ul>

      <Sect>
        <FormattedMessage id="terms.fair.h" defaultMessage="Fair play" />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.fair.p1"
          defaultMessage="Use KeyLearn the way it’s meant to be used: to learn typing. Don’t attack, overload, or attempt to break the service, don’t try to access other people’s data, and don’t use the site for anything that’s illegal where you live. Accounts that break these rules may be suspended or removed."
        />
      </p>
      <p>
        <FormattedMessage
          id="terms.fair.p2"
          defaultMessage="The leaderboards and the multiplayer races are meant to be typed. A result produced by a script, a macro or a second person is not a result, and we will remove it and the account behind it."
        />
      </p>

      <Sect>
        <FormattedMessage id="terms.cert.h" defaultMessage="Certificates" />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.cert.p1"
          defaultMessage="A certificate says that a named learner typed at a measured speed and accuracy, in a particular language, on a particular date. It is issued by us and it is not a qualification recognised by anybody else — no examination board, no school system, no employer has agreed to accept it. It is honest evidence of what somebody did here, and it is worth exactly that."
        />
      </p>
      <p>
        <FormattedMessage
          id="terms.cert.p2"
          defaultMessage="To earn one, the practice has to satisfy every condition on the Course page and then the learner has to pass a short assessment. Both are judged on our servers, not in your browser, so the criteria cannot be edited from the outside."
        />
      </p>
      <p>
        <FormattedMessage
          id="terms.cert.p3"
          defaultMessage="Every certificate carries a number that anybody can check on our <em>Check a certificate</em> page. You choose whether the holder’s name is shown to whoever checks it. We will withdraw a certificate if we find it was obtained by cheating, and you can ask us to withdraw one of yours at any time."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="terms.content.h"
          defaultMessage="Your content and data"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.content.p1"
          defaultMessage="Every keystroke statistic, lesson result, and streak you generate belongs to you — and to each learner in your household, whose profile can be exported or deleted on its own. You can download a full copy from your account at any time, and you can erase everything, locally or from our servers. We claim no ownership over your practice data, ever."
        />
      </p>
      <p>
        <FormattedMessage
          id="terms.content.p2"
          defaultMessage="Where you write something we can see — a support message, a public profile name, a theme you choose to share — you keep it, and you give us only what we need to show it back to you and to run the service."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="terms.warranty.h"
          defaultMessage="No warranty, honestly"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.warranty.p"
          defaultMessage="We work hard to keep KeyLearn fast, correct, and available, but it is provided <em>as is</em>, without warranties of any kind. Features may change, be added, or retire as the app evolves. We are not liable for damages arising from your use of the service — the most reliable safety net for your progress is the one-click export in your profile. Some jurisdictions don’t allow certain liability limits, so parts of this section may not apply to you."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="terms.change.h"
          defaultMessage="When these terms change"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="terms.change.p"
          defaultMessage="If we update these terms, the new version appears on this page with a fresh date at the top. Meaningful changes will be visible — no silent rewrites. Continuing to use KeyLearn after a change means you accept the updated terms."
        />
      </p>

      <div className={styles.foot}>
        <FormattedMessage
          id="legal.foot"
          defaultMessage="keylearn · your data stays yours"
        />
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.paper}>
      <Masthead
        kicker={formatMessage({
          id: "terms.kicker",
          defaultMessage: "The KeyLearn small print",
        })}
        title={formatMessage({
          id: "privacy.title",
          defaultMessage: "Privacy Policy",
        })}
        dateline={formatMessage({
          id: "privacy.dateline",
          defaultMessage: "Plain English · Updated August 2026",
        })}
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>
          <FormattedMessage
            id="legal.glanceLabel"
            defaultMessage="The short version"
          />
        </div>
        <ul>
          <li>
            <FormattedMessage
              id="privacy.glance.1"
              defaultMessage="Practice as a guest and your data <em>never leaves your browser</em>."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="privacy.glance.2"
              defaultMessage="Sign in and we store your e-mail, a name, your learner profiles and your typing statistics — and nothing else about you."
            />
          </li>
          <li>
            <FormattedMessage
              id="privacy.glance.3"
              defaultMessage="No ads, no third-party trackers, no analytics scripts, and we <em>never sell your data</em> — to anyone, for any reason."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="privacy.glance.4"
              defaultMessage="You can export or permanently delete everything, any time, in a couple of clicks."
            />
          </li>
        </ul>
      </div>

      <Sect>
        <FormattedMessage
          id="privacy.collect.h"
          defaultMessage="What we collect, and when"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.collect.guest"
          defaultMessage="<em>As a guest</em> — nothing reaches us. Your lesson results, learner profiles, settings and streaks are stored in your own browser, in local storage and in a database the browser keeps on your device. They stay there; we cannot see them, and clearing your browser data removes them."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.signinIntro"
          defaultMessage="<em>If you sign in</em> — we store an e-mail address, a display name, and your typing statistics, so they can follow you across devices. How you prove it is you is up to you, and each choice stores something different:"
          values={{ em }}
        />
      </p>
      <ul>
        <li>
          <FormattedMessage
            id="privacy.collect.password"
            defaultMessage="<em>A password</em> — kept only as a one-way hash. We cannot read it, and neither can anybody who takes a copy of our database."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.collect.provider"
            defaultMessage="<em>A sign-in provider</em> such as Google — we keep the identifier they give us and the basics they share: a name, an avatar, a link. We never see your password with them."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.collect.emailCode"
            defaultMessage="<em>A link or code by e-mail</em> — a short-lived code is stored until it is used or expires, then deleted."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.collect.passkey"
            defaultMessage="<em>A passkey</em> — a public key and a counter. The private half never leaves your device and cannot be extracted from what we hold."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.collect.twostep"
            defaultMessage="<em>Two-step verification</em> — a shared secret for your authenticator app, and your unused recovery codes."
            values={{ em }}
          />
        </li>
      </ul>
      <p>
        <FormattedMessage
          id="privacy.collect.learners"
          defaultMessage="<em>Learners in your household</em> — a profile carries a first name, an optional last name, an optional birth year, an avatar and that learner’s own settings. Signed out, profiles never leave the device. Signed in, they are stored so a household can practise on more than one machine. A birth year is used to choose the right certificate and nothing else; you can leave it out."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.certificates"
          defaultMessage="<em>Certificates</em> — a certificate records the name printed on it, the language, the level, the speed and the accuracy achieved, and a number. Anybody given the number can check it on our <em>Check a certificate</em> page — that is the point of it. Whether the name is shown to the person checking is a choice you make when it is issued; if you keep it hidden, the page confirms the certificate is real without naming the holder."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.security"
          defaultMessage="<em>Security events</em> — sign-ins, failed sign-ins, password changes, a passkey added or removed, and similar. Each is kept with the IP address and browser it came from, so that you can see it on your own account page and recognise something you did not do. This is the one place we deliberately keep an IP address against your account."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.payment"
          defaultMessage="<em>If you support the project</em> — payment is handled by our payment provider. We receive a record that a payment happened; we never see or store your card details."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.logs"
          defaultMessage="<em>Like every website</em> — our servers briefly keep routine technical logs (IP address, browser type, request time) to keep the service secure and diagnose problems. These logs rotate away automatically and are not used to profile you."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.collect.mail"
          defaultMessage="<em>E-mail we send you</em> — verification codes, sign-in links and security alerts go out through an e-mail delivery provider, which necessarily handles your address to deliver them. We do not send marketing."
          values={{ em }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="privacy.never.h"
          defaultMessage="What we never do"
        />
      </Sect>
      <ul>
        <li>
          <FormattedMessage
            id="privacy.never.1"
            defaultMessage="We don’t sell, rent, or trade your personal data."
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.never.2"
            defaultMessage="We don’t show ads or embed advertising networks."
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.never.3"
            defaultMessage="We don’t run third-party trackers or marketing analytics on your practice."
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.never.4"
            defaultMessage="We don’t read more from your sign-in provider than the basics needed to log you in."
          />
        </li>
      </ul>

      <Sect>
        <FormattedMessage id="privacy.cookies.h" defaultMessage="Cookies" />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.cookies.p"
          defaultMessage="KeyLearn uses only what’s strictly necessary: a session cookie that keeps you signed in, and local preference storage for things like your theme and settings. There are no marketing or tracking cookies — which is why you don’t see a cookie banner here."
        />
      </p>

      <Sect>
        <FormattedMessage id="privacy.rights.h" defaultMessage="Your rights" />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.rights.p"
          defaultMessage="Wherever you live — under the EU and UK GDPR, California’s CCPA/CPRA, and similar laws around the world — the same rights apply to every KeyLearn user, built straight into the app:"
        />
      </p>
      <ul>
        <li>
          <FormattedMessage
            id="privacy.rights.see"
            defaultMessage="<em>See and take your data</em> — the export button on your profile downloads everything we have as a portable file."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.rights.erase"
            defaultMessage="<em>Erase it</em> — “clear statistics” wipes your typing history, and deleting your account permanently removes everything from our servers. Both are irreversible, and that’s the point."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.rights.correct"
            defaultMessage="<em>Correct it</em> — your name, e-mail and every learner profile can be edited in your account. If your name and avatar came from a sign-in provider, changing them there updates them here too."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.rights.takeOut"
            defaultMessage="<em>Take one learner out</em> — deleting a learner profile removes that learner’s practice history without touching anybody else’s in the household."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.rights.ask"
            defaultMessage="<em>Ask</em> — anything about your data, or about KeyLearn itself, reaches a person at <supportLink>support@keylearn.org</supportLink>."
            values={{ em, supportLink }}
          />
        </li>
        <li>
          <FormattedMessage
            id="privacy.rights.complain"
            defaultMessage="<em>Complain</em> — if you believe we’ve mishandled your data, write to us first at <supportLink>support@keylearn.org</supportLink>, and you can contact your local data-protection authority at any time."
            values={{ em, supportLink }}
          />
        </li>
      </ul>

      <Sect>
        <FormattedMessage id="privacy.children.h" defaultMessage="Children" />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.children.p1"
          defaultMessage="A child does not have an account here. They have a <em>profile</em> inside an adult’s account, and everything about that profile is the account holder’s to see, change and delete. Children can also practise fully in guest mode, where no personal information is asked for or sent anywhere at all."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.children.p2"
          defaultMessage="Accounts are for adults. Creating one asks for a date of birth and we do not knowingly accept one from a child; where a sign-in provider is used, their own age rules apply on top. Adding a child’s profile asks the account holder to confirm they are the parent or guardian, and the confirmation is recorded with the date."
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.children.p3"
          defaultMessage="A child’s profile is kept to the minimum that makes the app work: a first name — a nickname is fine — an optional birth year, and their practice. We do not ask for a school, an address, a photograph or a contact detail for a child, and there is no way for one child to contact another."
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.children.p4"
          defaultMessage="An account can be locked behind a parent PIN, so a child using the family device cannot change account settings, delete profiles or reach anything meant for the adult."
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.children.p5"
          defaultMessage="If you believe a child has created an account here without a parent’s involvement, write to <supportLink>support@keylearn.org</supportLink> and we will delete it."
          values={{ supportLink }}
        />
      </p>

      <Sect>
        <FormattedMessage
          id="privacy.security.h"
          defaultMessage="Security and retention"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.security.p1"
          defaultMessage="All traffic is encrypted in transit. Passwords are stored only as one-way hashes, and a passkey’s private half never reaches us at all. We keep your data only for as long as you keep your account — delete it and the data goes too. Security events age out on their own, and unused e-mail codes are deleted as soon as they expire."
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.security.p2"
          defaultMessage="Deleting your account erases your name and e-mail from our servers. Two things deliberately survive it: a certificate you have already been issued stays checkable, because a qualification that silently stops verifying is worth nothing to the person holding it — and anything we are required to keep for accounting where you have paid us. You can ask us to withdraw a certificate."
        />
      </p>
      <p>
        <FormattedMessage
          id="privacy.security.p3"
          defaultMessage="No system is perfectly secure, so we keep what we store to a minimum; if a breach ever affects your data, we will notify you as the law requires."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="privacy.changes.h"
          defaultMessage="When this policy changes"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="privacy.changes.p"
          defaultMessage="Any change to this policy appears on this page with an updated date at the top. We’ll keep it in plain language — if you ever find a sentence here that needs a lawyer to decode, that’s a bug."
        />
      </p>

      <div className={styles.foot}>
        <FormattedMessage
          id="legal.foot"
          defaultMessage="keylearn · your data stays yours"
        />
      </div>
    </div>
  );
}

// ── User guide ─────────────────────────────────────────────────────────────

// The guide content lives as structured data in ./guide-content.tsx, selected
// per locale. Here we just render whichever localized doc applies.

function GuideBlockView({ block }: { readonly block: GuideBlock }): ReactNode {
  if ("p" in block) {
    return <p>{renderRich(block.p)}</p>;
  }
  if ("lab" in block) {
    return <div className={styles.howLab}>{renderRich(block.lab)}</div>;
  }
  if ("steps" in block) {
    return (
      <ol className={styles.steps}>
        {block.steps.map((s, i) => (
          <li key={i}>{renderRich(s)}</li>
        ))}
      </ol>
    );
  }
  return (
    <ul className={styles.tips}>
      {block.tips.map((s, i) => (
        <li key={i}>{renderRich(s)}</li>
      ))}
    </ul>
  );
}

// Starts on the English doc (already in this bundle as the guaranteed
// fallback) and swaps in the locale's translation once its chunk arrives, so
// the page always has something to show rather than a blank first paint.
function useGuideDoc(locale: string): GuideDoc {
  const [doc, setDoc] = useState<GuideDoc>(GUIDE_EN);

  useEffect(() => {
    let cancelled = false;
    setDoc(GUIDE_EN);
    guideFor(locale).then((d) => {
      if (!cancelled) {
        setDoc(d);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return doc;
}

export function GuidePage() {
  const { locale } = useIntl();
  const doc = useGuideDoc(locale);
  return (
    <div className={styles.paper}>
      <Masthead kicker={doc.kicker} title={doc.title} dateline={doc.dateline} />
      <div className={styles.guideLayout}>
        <nav className={styles.guideNav}>
          <div className={styles.guideNavLab}>{doc.navLabel}</div>
          {doc.sections.map((s) => (
            <a key={s.id} className={styles.guideNavItem} href={`#${s.id}`}>
              {s.nav}
            </a>
          ))}
        </nav>
        <div>
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className={styles.gpart}>
              <Sect>{s.heading}</Sect>
              {s.blocks.map((b, i) => (
                <GuideBlockView key={i} block={b} />
              ))}
            </section>
          ))}
          <div className={styles.foot}>
            <FormattedMessage
              id="guide.foot"
              defaultMessage="keylearn · happy typing"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The accessibility statement.
 *
 * Written as a claim somebody may rely on, which is why it does not say
 * "conforms to WCAG 2.2 AA": nobody has audited that, and an inaccurate
 * statement is worse than none — in several jurisdictions it is actionable.
 * What it does instead is say precisely what has been built, name what is
 * known to fall short, and give an address that reaches a person. That is also
 * what a school's accessibility officer is actually looking for; a blanket
 * conformance claim only invites "show me the audit".
 */
export function AccessibilityPage() {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.paper}>
      <Masthead
        kicker={formatMessage({
          id: "accessibility.kicker",
          defaultMessage: "Who can use KeyLearn",
        })}
        title={formatMessage({
          id: "account.accessibility.title",
          defaultMessage: "Accessibility",
        })}
        dateline={formatMessage({
          id: "accessibility.dateline",
          defaultMessage: "Plain English · Reviewed August 2026",
        })}
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>
          <FormattedMessage
            id="legal.glanceLabel"
            defaultMessage="The short version"
          />
        </div>
        <ul>
          <li>
            <FormattedMessage
              id="accessibility.glance.1"
              defaultMessage="There is an <em>Accessibility</em> page in your account with five settings you can turn on in any combination, and every individual switch underneath them. It is set <em>per learner</em>, so one person’s adjustments do not change anybody else’s."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="accessibility.glance.2"
              defaultMessage="A learner who is blind or has low vision can practise here — there is a <em>braille mode</em> with six-key entry and spoken guidance, not a bolted-on screen-reader afterthought."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="accessibility.glance.3"
              defaultMessage="Everything is reachable from the keyboard, which is the one input device a typing tutor can be sure of."
            />
          </li>
          <li>
            <FormattedMessage
              id="accessibility.glance.4"
              defaultMessage="We aim at <em>WCAG 2.2 Level AA</em>. We have not been independently audited, so we tell you what we know rather than claiming a grade."
              values={{ em }}
            />
          </li>
          <li>
            <FormattedMessage
              id="accessibility.glance.5"
              defaultMessage="Something in your way? Write to <supportLink>support@keylearn.org</supportLink> and a person will read it."
              values={{ supportLink }}
            />
          </li>
        </ul>
      </div>

      <h2>
        <FormattedMessage
          id="accessibility.five.h"
          defaultMessage="The five settings"
        />
      </h2>
      <p>
        <FormattedMessage
          id="accessibility.five.p1"
          defaultMessage="Account → Accessibility. Turn on as many as you need — they combine, because the needs do. Somebody dyslexic with a tremor needs two of them, and being made to choose one would be the app asking which disability to accommodate."
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.five.p2"
          defaultMessage="They are named for what they <em>do</em>, never for a condition. Nobody should have to identify themselves with a diagnosis to make an app usable."
          values={{ em }}
        />
      </p>
      <ul>
        <li>
          <FormattedMessage
            id="accessibility.five.1"
            defaultMessage="<em>Calm.</em> Nothing moves, nothing counts, nothing is timed. A missed day does not break the run."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.five.2"
            defaultMessage="<em>Fewer things at once.</em> Practice opens with the words and the keyboard, and nothing else asking to be looked at."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.five.3"
            defaultMessage="<em>Easier to read.</em> The typeface built for dyslexia, more space between the letters and the lines, and stronger text against the page."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.five.4"
            defaultMessage="<em>Colours apart.</em> Finger colours that stay distinct under colour blindness, and mistakes said in sound as well as in red."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.five.5"
            defaultMessage="<em>Steadier hands.</em> Bigger things to press, no two keys at once, and a key that repeats itself is not counted twice."
            values={{ em }}
          />
        </li>
      </ul>
      <p>
        <FormattedMessage
          id="accessibility.five.p3"
          defaultMessage="Under them, a section you can open with every switch on its own — fifteen of them — for anyone who wants to disagree with a setting rather than accept it whole. And one button that puts every one of them back."
        />
      </p>

      <h2>
        <FormattedMessage
          id="accessibility.switches.h"
          defaultMessage="What the switches actually do"
        />
      </h2>
      <p>
        <FormattedMessage
          id="accessibility.switches.braille"
          defaultMessage="<em>Braille and audio.</em> A learner set up with vision support gets a different page altogether: six-key braille entry, a curriculum in cells rather than letters, and spoken guidance throughout. It is a separate way of learning to type, not the sighted page read aloud."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.keyboardFirst"
          defaultMessage="<em>Keyboard first.</em> Every control can be operated from the keyboard, and a skip link at the top of each page takes you straight to the lesson without walking the header and the menus."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.motion"
          defaultMessage="<em>Motion, twice over.</em> If your device asks for reduced motion the app listens — including the scenes drawn on canvas that a stylesheet alone would not reach. There is also a switch here, because the system setting is all-or-nothing across every app on the machine and somebody may want films to move and this page to hold still."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.calm"
          defaultMessage="<em>Celebrations that hold still.</em> The kids world shakes after a wrong key and throws sparks when something goes right. Neither is a flashing hazard — nothing in the app crosses three flashes a second, and we measured — but a hard shake arrives exactly when a child is already struggling. The colour stays, because it carries the meaning; the movement goes."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.typeface"
          defaultMessage="<em>A typeface for dyslexia.</em> OpenDyslexic, with weighted bottoms so b, d, p and q cannot rotate into one another. Alongside it, letter spacing and line height you can set yourself — spacing is the reading support with the best evidence behind it, ahead of the typeface, and on a page somebody reads one letter at a time it is worth more here than anywhere else."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.targets"
          defaultMessage="<em>Larger things to press.</em> WCAG 2.2 asks for 24×24 pixels at AA and 44×44 at AAA. The app meets the first everywhere; this setting asks for the second, which is what a learner with a tremor or a touchscreen actually needs."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.bounce"
          defaultMessage="<em>A key that repeats itself.</em> A tremor or a sticky switch sends the same letter twice. This ignores a repeat that arrives within a window you set, up to a fifth of a second — never more, because past that a deliberate double letter starts being eaten, and a filter that loses real keystrokes is worse than none."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.chords"
          defaultMessage="<em>Never two keys at once.</em> Capitals need a shift held down while another key is pressed. For a one-handed learner or anyone who cannot hold two keys, this takes capitals and punctuation out of the lessons rather than making them a barrier to the alphabet."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.contrast"
          defaultMessage="<em>Colour you choose, checked.</em> Households can mix their own colours, and the app measures the contrast of what you pick against the page and refuses combinations nobody could read. Turning on a setting that asks for clearer text lifts the quiet parts of the interface too — the rules, chart frames and keyboard outlines go to 3:1 against the page, which is what WCAG asks of anything that is not text."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.safeZones"
          defaultMessage="<em>A keyboard for colour blindness.</em> The finger colours are what the keyboard teaches with, and the usual set does not survive red-green colour blindness — measured, its two closest neighbouring zones are at the threshold of being the same colour for a protanope. There is an alternative set chosen to stay apart under both common forms, and separately a <em>finger number on every key</em>, so the zones can be read without depending on colour at all. That is the stronger of the two: colour must never be the only way of conveying anything."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.cues"
          defaultMessage="<em>Mistakes you can hear.</em> A wrong keystroke is red, and red is exactly what a learner with a colour vision difference may not see. This turns on the error tone so the same fact arrives by ear."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.captions"
          defaultMessage="<em>What is said aloud, written down.</em> The braille page and the kids coach both speak. For a learner who is deaf or hard of hearing, speech that is not written is an instruction they were never given. Speech rate and voice are yours to set as well."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.predictable"
          defaultMessage="<em>Always the same words.</em> The coach picks its lines at random so encouragement does not turn into wallpaper. For an autistic learner that same property reads differently: a surprise where reassurance should be is not a delight. This makes the app say the same thing in the same place every time."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.textSize"
          defaultMessage="<em>Text you can see.</em> The practice text scales independently of the rest of the page, so it can be made large without breaking the layout around it."
          values={{ em }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.switches.timers"
          defaultMessage="<em>Time you control.</em> Nothing is scored against a countdown you cannot change; session length is a setting, and a lesson interrupted is simply restarted rather than failed. The running figures and the clock can both be hidden outright, and a missed day can be set not to break a streak — a streak that punishes illness is a streak that punishes disability."
          values={{ em }}
        />
      </p>

      <h2>
        <FormattedMessage
          id="accessibility.short.h"
          defaultMessage="Where we fall short"
        />
      </h2>
      <p>
        <FormattedMessage
          id="accessibility.short.p"
          defaultMessage="We would rather say this plainly than have you discover it."
        />
      </p>
      <ul>
        <li>
          <FormattedMessage
            id="accessibility.short.1"
            defaultMessage="<em>The standard practice page is not narrated.</em> The text being typed is not announced to a screen reader, because announcing every keystroke would make it unusable. A learner who needs speech should use the braille mode, which is built for exactly this and is switched on per learner in the account settings."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.short.2"
            defaultMessage="<em>We have had no independent audit.</em> Everything on this page is our own assessment of our own work, which is the weakest kind of evidence there is."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.short.3"
            defaultMessage="<em>The kids worlds are visual.</em> The dinosaur and hero scenes carry encouragement rather than instruction, so nothing is lost by not seeing them — but they are not described, and a child who cannot see them is getting a plainer experience than one who can."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.short.4"
            defaultMessage="<em>The settings are per learner, and per device.</em> They are kept with the learner’s profile on the device you set them on. Sign in on a new machine and you will need to set them again — which is exactly the wrong way round, because the person most inconvenienced by re-doing them is the person who needs them."
            values={{ em }}
          />
        </li>
        <li>
          <FormattedMessage
            id="accessibility.short.5"
            defaultMessage="<em>Nothing here has been tested with real assistive technology by the people who use it.</em> The braille mode was built with the standard in front of us, not a braille reader beside us. If you use one, we would rather hear that we got it wrong than not hear at all."
            values={{ em }}
          />
        </li>
      </ul>

      <h2>
        <FormattedMessage
          id="accessibility.telling.h"
          defaultMessage="Telling us"
        />
      </h2>
      <p>
        <FormattedMessage
          id="accessibility.telling.p1"
          defaultMessage="If something here blocks you or a learner you are responsible for, write to <supportLink>support@keylearn.org</supportLink>. Say what you were trying to do and what happened; you do not need to know the name of the standard it breaks. We will reply, and if it is our fault we will say so and tell you when it is fixed."
          values={{ supportLink }}
        />
      </p>
      <p>
        <FormattedMessage
          id="accessibility.telling.p2"
          defaultMessage="For schools and public bodies: we are happy to answer a procurement questionnaire against WCAG 2.2 or EN 301 549, on the understanding that our answers are self-assessed and this page is the honest version of them."
        />
      </p>
    </div>
  );
}
