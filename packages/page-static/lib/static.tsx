import * as styles from "./road.module.less";

// The legal pages, written to be read: plain words, honest promises, and the
// same road design language as the rest of the app.

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

function Sect({ children }: { readonly children: string }) {
  return <div className={styles.sect}>{children}</div>;
}

// Bump on every release. Format: MAJOR.MINOR.PATCH, zero-padded.
export const APP_VERSION = "01.00.00";

export function AboutPage() {
  return (
    <div className={styles.paper}>
      <Masthead
        kicker="The KeyLearn story"
        title="About KeyLearn"
        dateline={`Free · Open source · Version ${APP_VERSION}`}
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>In a sentence</div>
        <ul>
          <li>
            KeyLearn is a <em>free, open-source</em> touch-typing tutor for the
            whole household — grown-ups and kids alike.
          </li>
          <li>
            It watches the keys that slow you down and builds your practice
            around <em>them</em>, so every minute is spent where it counts.
          </li>
          <li>
            Children get a playful dino-run world that adapts to their age;
            grown-ups get a focused, data-rich practice screen.
          </li>
          <li>No ads, no trackers, and your data stays yours.</li>
        </ul>
      </div>

      <Sect>Why KeyLearn exists</Sect>
      <p>
        Typing well is a quiet superpower — it takes the friction out of every
        message, essay, and line of code you&rsquo;ll ever write. KeyLearn was
        built to teach that skill in the most encouraging way we could manage:
        short sessions, honest feedback, and a sense of steady progress you can
        actually feel. It&rsquo;s a fork of the open-source keybr engine,
        reworked around families and rebuilt to be warm rather than clinical.
      </p>

      <Sect>How the learning works</Sect>
      <p>
        Rather than marching you through fixed drills, KeyLearn measures how
        quickly and cleanly you hit each key and weaves your weak spots into the
        words it generates. A letter only joins your set once you can type it
        both quickly <em>and</em> accurately, so the difficulty rises exactly as
        fast as you do — never faster.
      </p>

      <Sect>Made for the whole family</Sect>
      <p>
        One account holds a profile for each person in your home, and every
        profile keeps its own progress. Kids step into a friendly dino-run
        adventure that scales to their age — shorter sessions, gentler pacing,
        and bigger encouragement for the youngest — while grown-ups get the full
        practice screen with detailed statistics. Everyone learns on the same
        proven engine, just dressed for their age.
      </p>

      <Sect>Open source, and yours</Sect>
      <p>
        KeyLearn is published under the GNU AGPL license: the whole source code
        is open for you to read, run, or improve. There is nothing to buy, no
        subscription, and no advertising. Your practice data belongs to you —
        export it or erase it whenever you like.
      </p>

      <Sect>Version</Sect>
      <p>
        You&rsquo;re running KeyLearn <em>v{APP_VERSION}</em>. Each release
        bumps this number so you always know which build you&rsquo;re on.
      </p>

      <div className={styles.foot}>
        keylearn · v{APP_VERSION} · learn to type, joyfully
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
            KeyLearn is <em>free and open source</em>. There is nothing to buy,
            no subscription, and no ads.
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
        KeyLearn is a free, open-source touch-typing tutor. The entire source
        code is published under the GNU AGPL license, and you&rsquo;re welcome
        to read it, run your own copy, or improve it. Because there is nothing
        for sale here — no premium tier, no subscriptions, no advertising —
        there are no payment or refund terms to agree to. Using the site means
        you accept the terms on this page; if you ever disagree with them,
        simply stop using the service.
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
          <em>Complain</em> — if you believe we&rsquo;ve mishandled your data,
          you can contact your local data-protection authority.
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
