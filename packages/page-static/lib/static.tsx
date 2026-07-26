import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
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
          defaultMessage="Typing well is a quiet superpower — it takes the friction out of every message, essay, and line of code you’ll ever write. KeyLearn was built to teach that skill in the most encouraging way we could manage: short sessions, honest feedback, and a sense of steady progress you can actually feel. It’s a fork of the open-source keybr engine, reworked around families and rebuilt to be warm rather than clinical."
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
          defaultMessage="KeyLearn began in 2026 as a simple wish: a typing tutor good enough for a grown-up to sharpen on, yet gentle enough for a five-year-old to love. The best open-source engine around — keybr — already nailed the hard part, the adaptive lesson algorithm, so KeyLearn started there and grew outward: a playful dino-run world for children, per-learner household profiles, age-aware pacing, a friendlier interface, and support for many languages. Version <em>{version}</em> is the first public release — the foundation the rest of the journey is built on."
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
          defaultMessage="KeyLearn is published under the GNU AGPL license: the whole source code is open for you to read, run, or improve. There is nothing to buy, no subscription, and no advertising. Your practice data belongs to you — export it or erase it whenever you like. <a>View the source on GitHub</a>."
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


// ── User guide ─────────────────────────────────────────────────────────────

function Anchor({ children }: { readonly children: ReactNode }) {
  return <li>{children}</li>;
}

export function GuidePage() {
  return (
    <div className={styles.paper}>
      <Masthead
        kicker="Everything you can do"
        title="User Guide"
        dateline="The complete guide to KeyLearn — from your first visit to signing out"
      />

      <div className={styles.glance}>
        <div className={styles.glanceLab}>What is inside</div>
        <ul>
          <Anchor>Getting in — with or without an account, and passwords.</Anchor>
          <Anchor>Profiles for the whole household.</Anchor>
          <Anchor>Practising: the screen, the lessons, the tools.</Anchor>
          <Anchor>Choosing what you type, and the smart helpers.</Anchor>
          <Anchor>Your keyboard, your progress, your data.</Anchor>
          <Anchor>Kids mode, other practice modes, and making it yours.</Anchor>
        </ul>
      </div>

      <Sect>Do I need an account?</Sect>
      <p>
        No. You can start typing the moment you arrive, and your progress is
        saved right here on this device. Create a free account only if you want
        your history to follow you to other devices, keep a backup, or share a
        profile link. Nothing useful is locked behind signing in.
      </p>

      <Sect>Signing up, logging in, and passwords</Sect>
      <p>
        Everything lives in the menu at the top-right. Choose <em>Register</em>{" "}
        to make an account with an email and a password, or <em>Log In</em> if
        you already have one. Forgotten your password? On the Log In screen pick
        Forgot Password and we will email a reset link — open it and choose a new
        one. You can log out from the menu at any time; your history stays put.
      </p>

      <Sect>Profiles for the whole household</Sect>
      <p>
        KeyLearn is built like a household: one account holds up to four profiles
        (eight with premium), grown-ups and children in any mix. Each profile
        keeps its <em>own</em> separate progress on this device — nothing is ever
        mixed together.
      </p>
      <p>
        To add one, open the menu and choose Account (or “Set up profiles”), then
        Add a profile. Give a first name, mark it as a Grown-up or a Kid, and pick
        an avatar — a friendly icon, or a Photo from your device. For a child, add
        a birth year; it is the only date we keep, and it simply tunes the words,
        pacing and help to their age. You can edit or delete any profile later,
        and deleting one frees a slot for another.
      </p>
      <p>
        To switch learner, open the menu and tap a face under Learners, or use the
        “Who is practising” switch — the app remembers exactly where each person
        left off. Kid profiles get a simplified, locked-down menu, and grown-up
        actions sit behind a quick “what is A times B?” maths gate, so little ones
        cannot wander into the settings.
      </p>

      <Sect>The practice screen</Sect>
      <p>
        Just start typing. The word you need floats just above the on-screen
        keyboard; a glowing comet points to the very next key; the keys are
        tinted by finger zone so you learn which finger reaches where; and a faint
        pair of resting hands shows where your fingers live between presses. The
        whole skill is one habit: keep your eyes on the words, not your hands.
      </p>

      <Sect>How lessons grow — your journey</Sect>
      <p>
        KeyLearn is <em>adaptive</em>. It measures how quickly and cleanly you hit
        each key and only adds a new letter to your set once you can type the
        current ones both fast and accurately. That growing set is your journey,
        from a handful of letters to the whole alphabet — the difficulty rises
        exactly as fast as you do, never faster, so you are always working right
        at your edge.
      </p>

      <Sect>The live readout</Sect>
      <p>
        As you type, the floating panel shows your current speed and accuracy, a
        little sparkline of recent runs, your goal tracks and your streak. It is
        there to encourage you, not to nag.
      </p>

      <Sect>Practice tools</Sect>
      <p>
        The small tools beside the text let you open a guided tour, restart the
        current lesson (Ctrl + Left), skip to the next one (Ctrl + Right), show or
        hide the on-screen keyboard, and resize the practice text. The gear opens
        the full Settings, described next.
      </p>

      <Sect>Choosing what you type</Sect>
      <p>
        Open Settings and go to Practice Content to choose how your words are
        made:
      </p>
      <ul className={styles.tips}>
        <li>
          <em>Guided practice</em> — the adaptive default that grows your
          alphabet key by key.
        </li>
        <li>
          <em>Classic course</em> — a fixed, ordered march through the keys.
        </li>
        <li>
          <em>Frequent words</em> — the most common words in your language.
        </li>
        <li>
          <em>Book Text</em> — type your way through real books built into the
          app.
        </li>
        <li>
          <em>Your Own Text</em> — paste anything you like and practise on it.
        </li>
        <li>
          <em>Code Snippets</em> — brackets, symbols and the rhythm of code.
        </li>
        <li>
          <em>Number Drills</em> — the number row and the keypad.
        </li>
      </ul>
      <p>
        The same screen lets you set the size of your alphabet, a target speed, how
        long each lesson runs, and a daily goal to aim for.
      </p>

      <Sect>Smart Practice helpers</Sect>
      <p>
        Under Settings, Smart Practice adds gentle helpers on top of guided
        practice: a bottleneck drill that hunts down your slowest key-pairs,
        spaced repetition, skill-decay refreshers that revisit rusty keys, smart
        confidence, and key recovery. They are all on by default — switch any of
        them off if you would rather keep things classic.
      </p>

      <Sect>Setting up your keyboard</Sect>
      <p>
        Settings, Keyboard Setup is where you pick your language and keyboard
        layout — QWERTY, Dvorak, Colemak and many more. Turn on layout emulation
        to practise a layout even when your computer is set to a different one,
        choose the keyboard shape, colour the keys by finger zone, and spotlight
        the next key while you are still learning where things are. A live preview
        shows every change as you make it.
      </p>

      <Sect>Display and feel</Sect>
      <p>
        The Display and Text Input settings let you show your speed as words- or
        characters-per-minute and fine-tune how typing feels. Restore Defaults is
        always a click away if you want to start fresh.
      </p>

      <Sect>Your progress — the Profile page</Sect>
      <p>
        Open Profile from the menu to see your full record: Lifetime and Today
        stats up top (time practised, lessons done, your best and typical speed
        and accuracy, and how today compares); a map of every letter you have
        unlocked; the story of how each individual key has sped up, with a
        smoothing slider; the big picture of every key over time; and the slowest
        transitions still holding you back. Filter the whole page by Letters,
        Digits, Punctuation or Symbols. You can even race your own last run as a
        ghost to feel the progress directly.
      </p>

      <Sect>Looking after your data</Sect>
      <p>
        Clearing statistics resets only the profile you are looking at, never the
        others. You can download your data as a file at any time. Sign in if you
        want your history to sync across devices and to share a public profile
        link — and you can delete your data, or your whole account, whenever you
        like.
      </p>

      <Sect>Kids mode</Sect>
      <p>
        Children practise on a playful trail — switch to Kids from the menu, or
        pick a kid profile. Every correct key walks their character a step closer
        home, and the character grows from a tiny baby into a fully-grown hero as
        more letters unlock. A newly-learned key sets off a little celebration,
        and each session ends at a cosy campfire.
      </p>
      <p>
        There are two worlds to choose from — Dino Run, with a friendly dinosaur,
        and Hero Trail, where a knight quests through a forest — and a character to
        pick in each. Tap the gear to open the toy-box.
      </p>

      <Sect>The kids toy-box</Sect>
      <p>
        The toy-box gathers every kid setting in one friendly place: the world and
        character, Big letters, Sounds, Helper hands (the glowing finger guide),
        the Keyboard (hidden, simple, or the full grown-up board), Letters on the
        trail (the words shown as blocks right in the game), a session Timer,
        Cheers (encouraging little messages), and — tucked under Advanced —
        sliders for Brightness, Colour and how lively the world feels. There is a
        calm night look as well as the bright day one.
      </p>

      <Sect>Growing with your child</Sect>
      <p>
        KeyLearn quietly tunes itself to a child’s age. The youngest see big,
        friendly letters, forgiving pacing, letter blocks right on the trail and
        the gentlest help; older children graduate to longer words, the full
        keyboard and a cleaner look. Just set the birth year on the profile and
        the rest follows on its own.
      </p>

      <Sect>Other ways to practise</Sect>
      <p>
        Beyond your daily practice there is a <em>Speed Test</em> — a quick
        one-off passage that reports your words-per-minute and accuracy with no
        lesson attached; a <em>Layouts</em> explorer for comparing keyboard
        layouts and their finger maps; <em>High Scores</em> to see how you stack
        up; and <em>Multiplayer</em> races to push your speed against others in
        real time. All of them live in the menu.
      </p>

      <Sect>Make it yours</Sect>
      <p>
        From the menu you can switch the theme — a clean light mode, a restful
        dark mode, or the signature KeyLearn look — and change the site language
        from a long list. On the practice screen you can resize the text and turn
        sounds on or off whenever you please.
      </p>

      <Sect>Privacy, in a sentence</Sect>
      <p>
        No ads, and no trackers. A child’s profile never leaves your browser. Sign
        in only if you want syncing or sharing; otherwise everything stays on this
        device, and you are free to delete it at any time.
      </p>

      <Sect>Signing out</Sect>
      <p>
        Log out from the menu whenever you like. Your practice history stays
        safely on this device — and on your account, if you made one — ready and
        waiting for the next time you sit down to type.
      </p>

      <Sect>A few habits that really help</Sect>
      <ul className={styles.tips}>
        <li>Accuracy before speed — clean typing is what sticks.</li>
        <li>Fix mistakes calmly; do not race to catch up.</li>
        <li>Rest your fingers on the home row — F and J have little bumps.</li>
        <li>A few minutes every day beats an hour once a week.</li>
      </ul>

      <div className={styles.foot}>keylearn · happy typing</div>
    </div>
  );
}
