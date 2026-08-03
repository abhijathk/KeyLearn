import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { KeyLayer, VirtualKeyboard, ZonesLayer } from "@keylearn/keyboard-ui";
import { KeyLegendList } from "@keylearn/lesson-ui";
import { useSettings } from "@keylearn/settings";
import { singleLine, toTextDisplaySettings } from "@keylearn/textinput";
import { StaticText } from "@keylearn/textinput-ui";
import { Article, Figure } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { alphabet } from "./english.ts";
import { ExampleLink } from "./ExampleLink.tsx";
import { KeySetIllustration } from "./figures.tsx";
import * as styles from "./HelpApp.module.less";

export function HelpPage() {
  const keyboard = loadKeyboard(Layout.EN_US);
  const { settings } = useSettings();
  const textDisplaySettings = toTextDisplaySettings(settings);

  const rules: {
    readonly id: string;
    readonly title: ReactNode;
    readonly art: ReactNode;
    readonly sample: string;
    readonly body: ReactNode;
  }[] = [
    {
      id: "1",
      title: (
        <FormattedMessage
          id="help.rule1.title"
          defaultMessage="It starts with a handful of letters"
        />
      ),
      art: (
        <KeySetIllustration
          confidences={[null, null, null, null, null, null]}
        />
      ),
      sample: "near lane rail line liner arena renal alien learn",
      body: (
        <FormattedMessage
          id="help.rule1.body"
          defaultMessage="<p>The very first time you practice, KeyLearn has no data on your skills yet, so it sticks to a handful of the most frequent letters — things like ‘<em>E</em>’, ‘<em>N</em>’, ‘<em>I</em>’, ‘<em>A</em>’, ‘<em>R</em>’ and ‘<em>L</em>’ — to build your first words. Every word you see will be made only from this starter set; the rest of the alphabet stays out of play for now. Since there’s no typing data yet for these letters, their indicators show up gray.</p>"
        />
      ),
    },
    {
      id: "2",
      title: (
        <FormattedMessage
          id="help.rule2.title"
          defaultMessage="You get comfortable with those letters"
        />
      ),
      art: <KeySetIllustration confidences={[0.9, 0.6, 0.7, 0.4, 0.5, 0.5]} />,
      sample: "arena alien rail near lane renal liner learn areal",
      body: (
        <FormattedMessage
          id="help.rule2.body"
          defaultMessage="<p>Once you start typing the generated words, KeyLearn starts logging your performance, and you’ll see the indicators shift from red toward green. Red marks a key you’re typing slowly, while green marks one you’re typing quickly. Your job at this stage is to turn every letter green by picking up speed. Notice that in this example, ‘<em>A</em>’ is called out because it has the slowest typing speed of the bunch, which makes it the target letter. That target letter shows up in every word you’re given — worth remembering, because it means you’re always drilling the exact key that’s currently slowing you down.</p>"
        />
      ),
    },
    {
      id: "3",
      title: (
        <FormattedMessage
          id="help.rule3.title"
          defaultMessage="More letters join the set"
        />
      ),
      art: <KeySetIllustration confidences={[1, 1, 1, 1, 1, 1, null]} />,
      sample: "later train alter irate rental trail tiler learnt",
      body: (
        <FormattedMessage
          id="help.rule3.body"
          defaultMessage="<p>Once your speed picks up and every letter has turned green, a new letter — ‘<em>T</em>’ — joins the set, and the words you’re given from now on are drawn from this larger pool. ‘<em>T</em>’ becomes the new target letter and appears in every word. As before, since there’s no data on it yet, its indicator starts out gray.</p>"
        />
      ),
    },
    {
      id: "4",
      title: (
        <FormattedMessage
          id="help.rule4.title"
          defaultMessage="You master the newly added letters"
        />
      ),
      art: (
        <KeySetIllustration confidences={[1, 0.8, 0.9, 0.7, 0.6, 0.7, 0.3]} />
      ),
      sample: "trail later rental irate alter train tiler learnt tean",
      body: (
        <FormattedMessage
          id="help.rule4.body"
          defaultMessage="<p>Now your goal is to turn this newest letter green too, and once you do, another letter gets added and the whole cycle repeats. In practice, don’t be surprised if the letters you’d already mastered slip back toward red for a while, as shown here — that’s completely normal. Your focus doesn’t change: get the current target letter to green so the next one unlocks.</p>"
        />
      ),
    },
    {
      id: "5",
      title: (
        <FormattedMessage
          id="help.rule5.title"
          defaultMessage="Rinse and repeat"
        />
      ),
      art: (
        <KeySetIllustration confidences={Object.keys(alphabet).map((_) => 1)} />
      ),
      sample: "a list of words with all the letters",
      body: (
        <FormattedMessage
          id="help.rule5.body"
          defaultMessage="<p>Stick with it, and eventually every single letter will turn green. That’s the main milestone, and you should feel great about reaching it! It doesn’t have to be the end, though — keep practicing for as long as you’d like.</p>"
        />
      ),
    },
  ];

  return (
    <Article className={styles.paper}>
      <header className={styles.masthead}>
        <div className={styles.kicker}>
          <span>The KeyLearn Field Guide</span>
        </div>
        <div className={styles.nameplate}>Learn to Touch Type</div>
        <div className={styles.dateline}>
          How the adaptive lessons train your fingers
        </div>
      </header>

      <div className={styles.lead}>
        <FormattedMessage
          id="help.section1"
          defaultMessage={
            "<h1>Type faster, the smart way</h1>" +
            "<h2>What is touch typing?</h2>" +
            "<p>KeyLearn teaches you <em>touch typing</em> — hitting the right keys from muscle memory alone, with no need to glance down at the keyboard. Mastering it can dramatically boost both your speed and accuracy. Its opposite is <em>hunt-and-peck typing</em>, where you keep your eyes on the keys instead of the screen and rely on just your index fingers.</p>"
          }
        />
      </div>

      <FormattedMessage
        id="help.section2"
        defaultMessage={
          "<h2>How the lessons are built</h2>" +
          "<p>KeyLearn takes a different approach: it leans on statistics and adaptive algorithms to build typing drills tailored to exactly where your skills stand right now. It does this by looping through three steps:</p>" +
          "<ol>" +
          "<li>Based on the typing data gathered so far, the algorithm figures out your current skill level and generates a batch of random words built from a letter set it chooses for you.</li>" +
          "<li>You type those words, aiming to keep your mistakes to a minimum.</li>" +
          "<li>While you type, the algorithm records fresh statistics — including how long each key takes you to hit — and feeds them back into step one to build the next batch of words.</li>" +
          "</ol>" +
          "<p>All you have to do at every stage is type the words you're given; KeyLearn handles the rest.</p>"
        }
      />

      <FormattedMessage
        id="help.section3"
        defaultMessage={
          "<h2>How words are generated</h2>" +
          "<p>KeyLearn builds random words that still sound natural and readable, following the phonetic patterns of your native language — many of them could pass for real words, and some are. Typing text that reads sensibly is far easier than typing a jumble of random letters, and it also helps you internalize the key combinations you'll hit most often. That second part matters a lot: in English, for instance, the letter ‘<em>W</em>’ almost never follows ‘<em>Z</em>’, so this app will never ask you to type that pairing. Instead, you'll practice far more common sequences like ‘<em>the</em>’, ‘<em>that</em>’, and ‘<em>with</em>’ — before long, you'll be flying through the ‘<em>th</em>’ combo.</p>" +
          "<p>Here's how the algorithm picks which letters go into those words.</p>"
        }
      />

      <div className={styles.rules}>
        {rules.map(({ id, title, art, sample, body }) => (
          <section key={id} className={styles.rule}>
            <h3 className={styles.ruleNumber}>{id}</h3>
            <h3 className={styles.ruleTitle}>{title}</h3>
            <div className={styles.plates}>
              <figure className={styles.plate}>
                <div className={styles.plateArt}>{art}</div>
                <figcaption className={styles.plateCaption}>
                  The letter set
                </figcaption>
              </figure>
              <figure className={styles.plate}>
                <div className={styles.plateArt}>
                  <StaticText
                    settings={textDisplaySettings}
                    lines={singleLine(sample)}
                  />
                </div>
                <figcaption className={styles.plateCaption}>
                  Words you&rsquo;ll practice
                </figcaption>
              </figure>
            </div>
            <div className={styles.ruleBody}>{body}</div>
          </section>
        ))}
      </div>

      <FormattedMessage
        id="help.section4"
        defaultMessage="<p>Here’s exactly what each indicator color means, laid out in the legend below.</p>"
      />

      <Figure>
        <Figure.Caption>
          <FormattedMessage
            id="help.indicators.caption"
            defaultMessage="What each indicator color means."
          />
        </Figure.Caption>
        <KeyLegendList />
      </Figure>

      <FormattedMessage
        id="help.adaptive.intro"
        defaultMessage={
          "<h2>The smart layers working behind the scenes</h2>" +
          "<p>The letter-by-letter cycle above is the backbone of your practice, but KeyLearn runs a few extra adaptive helpers on top of it. You never switch these on or think about them — they quietly shape every session so your time lands where it pays off most. Here's what each one is doing while you type.</p>"
        }
      />

      <FormattedMessage
        id="help.adaptive.confidence"
        defaultMessage={
          "<h3>Confidence that watches accuracy, not just speed</h3>" +
          "<p>The core signal for how well you know a key has always been how <em>fast</em> you type it. KeyLearn now adds a second opinion drawn from learning science — a technique called <em>Bayesian Knowledge Tracing</em> — that also weighs how <em>cleanly</em> you hit that key. It forgives the occasional slip on a key you clearly know, and it refuses to be fooled by a lucky fast-but-sloppy tap. The two views are blended together, with raw speed still leading by two-to-one, so a letter only counts as mastered when you're both quick <em>and</em> accurate. It's tuned to unlock the next letter at the same comfortable pace you're used to — usually a couple of clean passes — just with a sharper eye on mistakes.</p>"
        }
      />

      <FormattedMessage
        id="help.adaptive.review"
        defaultMessage={
          "<h3>A quick warm-up on the keys you're due to review</h3>" +
          "<p>Letters you picked up a while ago but haven't touched in a few sessions get surfaced first, as a short warm-up at the start of your practice. It works the way a good flashcard deck resurfaces a card right before you'd forget it: reviewing a skill at that fading edge is exactly what pushes it into long-term memory. So don't be surprised to revisit an old friend before meeting anyone new.</p>"
        }
      />

      <FormattedMessage
        id="help.adaptive.decay"
        defaultMessage={
          "<h3>Letters quietly fade if you leave them alone</h3>" +
          "<p>Skills rust when they go unused, and KeyLearn reflects that honestly. A key you haven't practiced in a long time slowly loses a little confidence over real time, so you might see an old letter drift back from green toward red on its own. That's not you getting worse — it's the app gently flagging that the letter is due for a refresh before it truly slips. Your best-ever result for a key is never wiped out; only the current reading softens.</p>"
        }
      />

      <FormattedMessage
        id="help.adaptive.bigrams"
        defaultMessage={
          "<h3>Drilling the letter pairs that trip you up</h3>" +
          "<p>Not everything that slows you down is a single key. Often it's the hand-off <em>between</em> two — an awkward pair like ‘<em>ny</em>’, ‘<em>rl</em>’ or ‘<em>br</em>’ where your fingers have to travel or cross over. KeyLearn keeps an eye on the pairings where you consistently stumble and weaves more of them into the words it builds for you, so you smooth out the transitions themselves, not just the individual letters on either side.</p>"
        }
      />

      <FormattedMessage
        id="help.section5"
        defaultMessage={
          "<h2>Proper keyboard hand placement</h2>" +
          "<p>Rest all your fingers on the home row — the row that contains the <em>Caps Lock</em> key. You'll feel small raised bumps on the ‘<em>F</em>’ and ‘<em>J</em>’ keys; line your index fingers up with those. From there, every finger owns a specific group of keys, shown in the illustration below.</p>"
        }
      />

      <Figure>
        <Figure.Caption>
          <FormattedMessage
            id="help.keyboardZones.caption"
            defaultMessage="Keyboard zones and where each finger belongs."
          />
        </Figure.Caption>
        <VirtualKeyboard keyboard={keyboard}>
          <KeyLayer showColors={true} />
          <ZonesLayer />
        </VirtualKeyboard>
      </Figure>

      <FormattedMessage
        id="help.section6"
        defaultMessage={
          "<h2>Does this app actually work?</h2>" +
          "<p>Below are a handful of real, anonymized user profiles showing how people's touch typing improved while using KeyLearn. We hope seeing their progress motivates you to keep at it!</p>"
        }
      />

      <ul className={styles.examples}>
        <li>
          <FormattedMessage
            id="help.example1"
            defaultMessage="<a>Example 1</a> went from 30 to 70 WPM over 15 days, with 4 hours 20 minutes of total practice — the accuracy-aware confidence blend kept steering each session toward the keys that were genuinely holding them back."
            values={{
              a: (chunks) => <ExampleLink index={1}>{chunks}</ExampleLink>,
            }}
          />
        </li>

        <li>
          <FormattedMessage
            id="help.example2"
            defaultMessage="<a>Example 2</a> climbed from 35 to 70 WPM over 12 days, with just 2 hours and 20 minutes of practice — the spaced-review warm-up meant less time was needed to make each gain stick."
            values={{
              a: (chunks) => <ExampleLink index={2}>{chunks}</ExampleLink>,
            }}
          />
        </li>

        <li>
          <FormattedMessage
            id="help.example3"
            defaultMessage="<a>Example 3</a> made a solid leap from under 20 to 40 WPM over 11 days, with 5 hours and 30 minutes of practice — the bigram drills smoothing out the awkward letter pairs that had been the real bottleneck."
            values={{
              a: (chunks) => <ExampleLink index={3}>{chunks}</ExampleLink>,
            }}
          />
        </li>

        <li>
          <FormattedMessage
            id="help.example4"
            defaultMessage="<a>Example 4</a> held steady at roughly 70 WPM (already quite fast) across 11 days and 2 hours 10 minutes of practice, while accuracy kept climbing — the BKT blend only marks a key mastered once it’s both fast and clean, so the extra reps went straight into fewer mistakes."
            values={{
              a: (chunks) => <ExampleLink index={4}>{chunks}</ExampleLink>,
            }}
          />
        </li>

        <li>
          <FormattedMessage
            id="help.example5"
            defaultMessage="<a>Example 5</a> improved from 20 to 45 WPM over 22 days and about 10 hours of practice (progress isn’t always fast, and that’s okay) — and whenever older letters faded, the decay nudges surfaced them again for a quick refresh before they slipped for real."
            values={{
              a: (chunks) => <ExampleLink index={5}>{chunks}</ExampleLink>,
            }}
          />
        </li>
      </ul>
    </Article>
  );
}
