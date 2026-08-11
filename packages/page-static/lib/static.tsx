import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { type GuideBlock, guideFor, renderRich } from "./guide-content.tsx";
import * as styles from "./road.module.less";

// The legal pages, written to be read: plain words, honest promises, and the
// same road design language as the rest of the app.

// Rich-text chunk used across the localized copy so words can be emphasised
// inside a translatable message rather than split into fragments.
const em = (chunks: ReactNode) => <em>{chunks}</em>;

function Masthead({
  kicker,
  title,
  dateline,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly dateline: string;
}) {
  return (
    <header>
      <div className={styles.kicker}>{kicker}</div>
      <div className={styles.nameplate}>{title}</div>
      <div className={styles.dateline}>{dateline}</div>
    </header>
  );
}

function Sect({ children }: { readonly children: ReactNode }) {
  return <div className={styles.sect}>{children}</div>;
}

// Bump on every release. Format: MAJOR.MINOR.PATCH, zero-padded.
export const APP_VERSION = "01.00.00";

export function AboutPage() {
  const { formatMessage } = useIntl();
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
              defaultMessage="Children get a playful dino-run world that adapts to their age; grown-ups get a focused, data-rich practice screen."
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
          defaultMessage="Typing well is a quiet superpower — it takes the friction out of every message, essay, and line of code you’ll ever write. KeyLearn was built to teach that skill in the most encouraging way we could manage: short sessions, honest feedback, and a sense of steady progress you can actually feel. It’s a fork of the open-source keylearn engine, reworked around families and rebuilt to be warm rather than clinical."
        />
      </p>

      <Sect>
        <FormattedMessage
          id="about.story.h"
          defaultMessage="The story so far"
        />
      </Sect>
      <p>
        <FormattedMessage
          id="about.story.p"
          defaultMessage="KeyLearn began in 2026 as a simple wish: a typing tutor good enough for a grown-up to sharpen on, yet gentle enough for a five-year-old to love. The best open-source engine around — keylearn — already nailed the hard part, the adaptive lesson algorithm, so KeyLearn started there and grew outward: a playful dino-run world for children, per-learner household profiles, age-aware pacing, a friendlier interface, and support for many languages. Version <em>{version}</em> is the first public release — the foundation the rest of the journey is built on."
          values={{ em, version: APP_VERSION }}
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

      <Sect>
        <FormattedMessage id="about.version.h" defaultMessage="Version" />
      </Sect>
      <p>
        <FormattedMessage
          id="about.version.p"
          defaultMessage="You’re running KeyLearn <em>v{version}</em>. Each release bumps this number so you always know which build you’re on."
          values={{ em, version: APP_VERSION }}
        />
      </p>

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
  return (
    <div className={styles.paper}>
      <Masthead
        kicker="The KeyLearn small print"
        title="Terms of Service"
        dateline="Plain English · Updated July 2026"
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>The short version</div>
        <ul>
          <li>
            KeyLearn is <em>open source</em>, and learning to type is{" "}
            <em>free</em> — every lesson, every learner, no ads. Supporting the
            project is voluntary and unlocks nothing.
          </li>
          <li>
            Be a human, keep one account per person, and don&rsquo;t use
            KeyLearn to do anything illegal or harmful.
          </li>
          <li>
            Your typing data is <em>yours</em> — you can export it or erase it
            whenever you like.
          </li>
          <li>
            We run this service with care but without warranties: it&rsquo;s
            provided as-is, and features may change.
          </li>
        </ul>
      </div>

      <Sect>What KeyLearn is</Sect>
      <p>
        KeyLearn is an open-source touch-typing tutor. The entire source code is
        published under the GNU AGPL license, and you&rsquo;re welcome to read
        it, run your own copy, or improve it. Learning to type is free: every
        lesson and every learner in your household, with no advertising. You can
        support the project voluntarily, and where you pay us anything the
        payment terms below apply. Using the site means you accept the terms on
        this page; if you ever disagree with them, simply stop using the
        service.
      </p>

      <Sect>Paying for KeyLearn</Sect>
      <p>
        Everything KeyLearn offers is free. Where you choose to support the
        project voluntarily, payment is handled by our payment provider — we
        never see or store your card details. Amounts are shown before you
        confirm, including any tax that applies where you live.
      </p>
      <p>
        Voluntary contributions are gifts rather than purchases: they unlock
        nothing, and they are not refundable. If that ever changes — if we
        introduce something paid — we will say so plainly here first.
      </p>

      <Sect>Your account</Sect>
      <p>
        You don&rsquo;t need an account at all: as a guest, everything works and
        your progress lives in your own browser. If you choose to sign in so
        your progress can follow you across devices, a few simple rules apply:
      </p>
      <ul>
        <li>
          Accounts are for humans — no bots or automated sign-ups, please.
        </li>
        <li>
          One person, one account. Feel free to make one per family member.
        </li>
        <li>
          You&rsquo;re responsible for keeping access to your sign-in provider
          secure. If someone gets into your account because your credentials
          leaked, we can&rsquo;t undo what they did.
        </li>
      </ul>

      <Sect>Fair play</Sect>
      <p>
        Use KeyLearn the way it&rsquo;s meant to be used: to learn typing.
        Don&rsquo;t attack, overload, or attempt to break the service,
        don&rsquo;t try to access other people&rsquo;s data, and don&rsquo;t use
        the site for anything that&rsquo;s illegal where you live. Accounts that
        break these rules may be suspended or removed.
      </p>

      <Sect>Your content and data</Sect>
      <p>
        Every keystroke statistic, lesson result, and streak you generate
        belongs to you. You can download a full copy from your profile at any
        time, and you can erase everything — locally or from our servers — with
        the clear-statistics and delete-account controls. We claim no ownership
        over your practice data, ever.
      </p>

      <Sect>No warranty, honestly</Sect>
      <p>
        We work hard to keep KeyLearn fast, correct, and available, but it is
        provided <em>as is</em>, without warranties of any kind. Features may
        change, be added, or retire as the app evolves. We are not liable for
        damages arising from your use of the service — the most reliable safety
        net for your progress is the one-click export in your profile. Some
        jurisdictions don&rsquo;t allow certain liability limits, so parts of
        this section may not apply to you.
      </p>

      <Sect>When these terms change</Sect>
      <p>
        If we update these terms, the new version appears on this page with a
        fresh date at the top. Meaningful changes will be visible — no silent
        rewrites. Continuing to use KeyLearn after a change means you accept the
        updated terms.
      </p>

      <div className={styles.foot}>keylearn · your data stays yours</div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className={styles.paper}>
      <Masthead
        kicker="The KeyLearn small print"
        title="Privacy Policy"
        dateline="Plain English · Updated July 2026"
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>The short version</div>
        <ul>
          <li>
            Practice as a guest and your data <em>never leaves your browser</em>
            .
          </li>
          <li>
            Sign in and we store only your typing statistics, plus the name and
            e-mail your sign-in provider shares.
          </li>
          <li>
            No ads, no third-party trackers, no analytics scripts, and we
            <em> never sell your data</em> — to anyone, for any reason.
          </li>
          <li>
            You can export or permanently delete everything, any time, in a
            couple of clicks.
          </li>
        </ul>
      </div>

      <Sect>What we collect, and when</Sect>
      <p>
        <em>As a guest</em> — nothing. Your lesson results, settings, and
        streaks are stored in your own browser&rsquo;s local storage. They stay
        on your device; we can&rsquo;t see them, and clearing your browser data
        removes them.
      </p>
      <p>
        <em>If you sign in</em> — we store your typing statistics on our servers
        so they can follow you across devices, together with the basic profile
        your sign-in provider shares with us: a display name, an avatar, and an
        e-mail address used only to recognise your account. We never see your
        passwords — authentication happens entirely with your chosen provider.
      </p>
      <p>
        <em>Like every website</em> — our servers briefly keep routine technical
        logs (IP address, browser type, request time) to keep the service secure
        and diagnose problems. These logs rotate away automatically and are not
        used to profile you.
      </p>

      <Sect>What we never do</Sect>
      <ul>
        <li>We don&rsquo;t sell, rent, or trade your personal data.</li>
        <li>We don&rsquo;t show ads or embed advertising networks.</li>
        <li>
          We don&rsquo;t run third-party trackers or marketing analytics on your
          practice.
        </li>
        <li>
          We don&rsquo;t read more from your sign-in provider than the basics
          needed to log you in.
        </li>
      </ul>

      <Sect>Cookies</Sect>
      <p>
        KeyLearn uses only what&rsquo;s strictly necessary: a session cookie
        that keeps you signed in, and local preference storage for things like
        your theme and settings. There are no marketing or tracking cookies —
        which is why you don&rsquo;t see a cookie banner here.
      </p>

      <Sect>Your rights</Sect>
      <p>
        Wherever you live — under the EU and UK GDPR, California&rsquo;s
        CCPA/CPRA, and similar laws around the world — the same rights apply to
        every KeyLearn user, built straight into the app:
      </p>
      <ul>
        <li>
          <em>See and take your data</em> — the export button on your profile
          downloads everything we have as a portable file.
        </li>
        <li>
          <em>Erase it</em> — &ldquo;clear statistics&rdquo; wipes your typing
          history, and deleting your account permanently removes everything from
          our servers. Both are irreversible, and that&rsquo;s the point.
        </li>
        <li>
          <em>Correct it</em> — your name and avatar come from your sign-in
          provider; change them there and they update here.
        </li>
        <li>
          <em>Ask</em> — anything about your data, or about KeyLearn itself,
          reaches a person at{" "}
          <a href="mailto:support@keylearn.org">support@keylearn.org</a>.
        </li>
        <li>
          <em>Complain</em> — if you believe we&rsquo;ve mishandled your data,
          write to us first at{" "}
          <a href="mailto:support@keylearn.org">support@keylearn.org</a>, and
          you can contact your local data-protection authority at any time.
        </li>
      </ul>

      <Sect>Children</Sect>
      <p>
        KeyLearn is safe for young typists because guest mode needs no personal
        information at all — kids can practice fully without an account.
        Creating an account requires a sign-in provider, whose own age rules
        apply.
      </p>

      <Sect>Security and retention</Sect>
      <p>
        All traffic is encrypted in transit. We keep your data only for as long
        as you keep your account — delete it and the data goes too. No system is
        perfectly secure, so we keep what we store to a minimum; if a breach
        ever affects your data, we&rsquo;ll notify you as the law requires.
      </p>

      <Sect>When this policy changes</Sect>
      <p>
        Any change to this policy appears on this page with an updated date at
        the top. We&rsquo;ll keep it in plain language — if you ever find a
        sentence here that needs a lawyer to decode, that&rsquo;s a bug.
      </p>

      <div className={styles.foot}>keylearn · your data stays yours</div>
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

export function GuidePage() {
  const { locale } = useIntl();
  const doc = guideFor(locale);
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
          <div className={styles.foot}>keylearn · happy typing</div>
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
  return (
    <div className={styles.paper}>
      <Masthead
        kicker="Who can use KeyLearn"
        title="Accessibility"
        dateline="Plain English · Reviewed August 2026"
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>The short version</div>
        <ul>
          <li>
            A learner who is blind or has low vision can practise here — there
            is a <em>braille mode</em> with six-key entry and spoken guidance,
            not a bolted-on screen-reader afterthought.
          </li>
          <li>
            Everything is reachable from the keyboard, which is the one input
            device a typing tutor can be sure of.
          </li>
          <li>
            We aim at <em>WCAG 2.2 Level AA</em>. We have not been independently
            audited, so we tell you what we know rather than claiming a grade.
          </li>
          <li>
            Something in your way? Write to{" "}
            <a href="mailto:support@keylearn.org">support@keylearn.org</a> and a
            person will read it.
          </li>
        </ul>
      </div>

      <h2>What we have built</h2>
      <p>
        <em>Braille and audio.</em> A learner set up with vision support gets a
        different page altogether: six-key braille entry, a curriculum in cells
        rather than letters, and spoken guidance throughout. It is a separate
        way of learning to type, not the sighted page read aloud.
      </p>
      <p>
        <em>Keyboard first.</em> Every control can be operated from the
        keyboard, and a skip link at the top of each page takes you straight to
        the lesson without walking the header and the menus.
      </p>
      <p>
        <em>Motion can be turned down.</em> If your device asks for reduced
        motion, the app listens — the animated scenes, the moving cursor and the
        celebrations all settle down, including the ones drawn on canvas that a
        stylesheet alone would not reach.
      </p>
      <p>
        <em>Colour you choose, checked.</em> Households can mix their own
        colours, and the app measures the contrast of what you pick against the
        page and refuses combinations nobody could read.
      </p>
      <p>
        <em>A keyboard for colour blindness.</em> The finger colours are what
        the keyboard teaches with, and the usual set does not survive red-green
        colour blindness — measured, its two closest neighbouring zones are at
        the threshold of being the same colour for a protanope. Appearance has
        an alternative set chosen to stay apart under both common forms, per
        learner.
      </p>
      <p>
        <em>Text you can see.</em> The practice text scales independently of the
        rest of the page, so it can be made large without breaking the layout
        around it.
      </p>
      <p>
        <em>Time you control.</em> Nothing is scored against a countdown you
        cannot change; session length is a setting, and a lesson interrupted is
        simply restarted rather than failed.
      </p>

      <h2>Where we fall short</h2>
      <p>We would rather say this plainly than have you discover it.</p>
      <ul>
        <li>
          <em>The standard practice page is not narrated.</em> The text being
          typed is not announced to a screen reader, because announcing every
          keystroke would make it unusable. A learner who needs speech should
          use the braille mode, which is built for exactly this and is switched
          on per learner in the account settings.
        </li>
        <li>
          <em>We have had no independent audit.</em> Everything on this page is
          our own assessment of our own work, which is the weakest kind of
          evidence there is.
        </li>
        <li>
          <em>The kids worlds are visual.</em> The dinosaur and hero scenes
          carry encouragement rather than instruction, so nothing is lost by not
          seeing them — but they are not described, and a child who cannot see
          them is getting a plainer experience than one who can.
        </li>
      </ul>

      <h2>Telling us</h2>
      <p>
        If something here blocks you or a learner you are responsible for, write
        to <a href="mailto:support@keylearn.org">support@keylearn.org</a>. Say
        what you were trying to do and what happened; you do not need to know
        the name of the standard it breaks. We will reply, and if it is our
        fault we will say so and tell you when it is fixed.
      </p>
      <p>
        For schools and public bodies: we are happy to answer a procurement
        questionnaire against WCAG 2.2 or EN 301 549, on the understanding that
        our answers are self-assessed and this page is the honest version of
        them.
      </p>
    </div>
  );
}
