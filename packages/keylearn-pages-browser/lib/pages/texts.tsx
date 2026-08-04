import { Book } from "@keylearn/content";
import { lessonProps, LessonType } from "@keylearn/lesson";
import { Pages, Screen } from "@keylearn/pages-shared";
import { type Settings, useSettings } from "@keylearn/settings";
import { type ReactNode, useMemo, useState } from "react";
import { defineMessage, type MessageDescriptor, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { recentPractice } from "../library-recent.ts";
import * as styles from "./texts.module.less";

// The Practice Library: a browsable home for choosing WHAT you type. Each
// "Practise this" writes the practice settings that already exist (lesson type,
// book, or pasted text) and jumps straight to Practice — no new engine.

const MODES: {
  readonly type: LessonType;
  readonly name: MessageDescriptor;
  readonly desc: MessageDescriptor;
}[] = [
  {
    type: LessonType.GUIDED,
    name: defineMessage({
      id: "texts.mode.guided",
      defaultMessage: "Guided practice",
    }),
    desc: defineMessage({
      id: "texts.mode.guided.desc",
      defaultMessage:
        "The adaptive default — grows your alphabet one key at a time.",
    }),
  },
  {
    type: LessonType.WORDLIST,
    name: defineMessage({
      id: "texts.mode.words",
      defaultMessage: "Frequent words",
    }),
    desc: defineMessage({
      id: "texts.mode.words.desc",
      defaultMessage: "The most common words in your language.",
    }),
  },
  {
    type: LessonType.QUOTES,
    name: defineMessage({
      id: "texts.mode.quotes",
      defaultMessage: "Quotes",
    }),
    desc: defineMessage({
      id: "texts.mode.quotes.desc",
      defaultMessage:
        "Short, complete thoughts — real capitals and punctuation, a fresh set every lesson.",
    }),
  },
  {
    type: LessonType.CODE,
    name: defineMessage({
      id: "texts.mode.code",
      defaultMessage: "Code snippets",
    }),
    desc: defineMessage({
      id: "texts.mode.code.desc",
      defaultMessage: "Brackets, symbols and the rhythm of code.",
    }),
  },
  {
    type: LessonType.NUMBERS,
    name: defineMessage({
      id: "texts.mode.numbers",
      defaultMessage: "Number drills",
    }),
    desc: defineMessage({
      id: "texts.mode.numbers.desc",
      defaultMessage: "The number row and the keypad.",
    }),
  },
  {
    type: LessonType.CURRICULUM,
    name: defineMessage({
      id: "texts.mode.curriculum",
      defaultMessage: "Classic course",
    }),
    desc: defineMessage({
      id: "texts.mode.curriculum.desc",
      defaultMessage: "A fixed, ordered march through the keys.",
    }),
  },
];

// Names for the "recently practised" cards — every lesson type, including the
// ones that have no card of their own in MODES.
const TYPE_NAMES: Record<string, MessageDescriptor> = {
  guided: defineMessage({
    id: "texts.mode.guided",
    defaultMessage: "Guided practice",
  }),
  curriculum: defineMessage({
    id: "texts.mode.curriculum",
    defaultMessage: "Classic course",
  }),
  wordlist: defineMessage({
    id: "texts.mode.words",
    defaultMessage: "Frequent words",
  }),
  books: defineMessage({ id: "t_Books", defaultMessage: "Book Text" }),
  quotes: defineMessage({ id: "texts.mode.quotes", defaultMessage: "Quotes" }),
  custom: defineMessage({
    id: "t_Custom_text",
    defaultMessage: "Your Own Text",
  }),
  code: defineMessage({
    id: "texts.mode.code",
    defaultMessage: "Code snippets",
  }),
  numbers: defineMessage({
    id: "texts.mode.numbers",
    defaultMessage: "Number drills",
  }),
};

const BLURB: Record<string, MessageDescriptor> = {
  [Book.EN_WIZARD_OZ.id]: defineMessage({
    id: "texts.book.wizardOz",
    defaultMessage:
      "A cyclone, a yellow-brick road, and friends made along the way.",
  }),
  [Book.EN_TREASURE_ISLAND.id]: defineMessage({
    id: "texts.book.treasureIsland",
    defaultMessage:
      "Pirates, a treasure map, and a chest of gold on a far-off island.",
  }),
  [Book.EN_HOUND_BASKERVILLES.id]: defineMessage({
    id: "texts.book.hound",
    defaultMessage: "Sherlock Holmes on the misty, hound-haunted moor.",
  }),
  [Book.EN_TIME_MACHINE.id]: defineMessage({
    id: "texts.book.timeMachine",
    defaultMessage: "A traveller journeys to the far future of the Earth.",
  }),
  [Book.EN_ANNE_GREEN_GABLES.id]: defineMessage({
    id: "texts.book.anne",
    defaultMessage:
      "A bright, talkative orphan turns a quiet farm upside down.",
  }),
};

/**
 * The library's memory: pick up where you left off.
 *
 * A "continue reading" card whenever a book has a saved position, then the
 * learner's recent practice choices — each one click back into that lesson.
 * Renders nothing on a fresh profile, so the library opens exactly as before.
 */
function JumpBackIn({
  practise,
  practiseLabel,
}: {
  readonly practise: (mutate: (s: Settings) => Settings) => void;
  readonly practiseLabel: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings } = useSettings();
  const recent = useMemo(() => recentPractice(), []);
  const book = settings.get(lessonProps.books.book);
  const paragraph = settings.get(lessonProps.books.paragraphIndex);
  const continueReading = paragraph > 0;
  // The continue-reading card already covers the current book; a "Book Text"
  // recent card next to it would be the same click twice.
  const cards = recent.filter(
    (e) => !(continueReading && e.type === "books" && e.detail === book.id),
  );
  if (!continueReading && cards.length === 0) {
    return null;
  }
  return (
    <section className={styles.section}>
      <div className={styles.h2}>
        {formatMessage({
          id: "texts.jumpBackIn",
          defaultMessage: "Jump back in",
        })}
      </div>
      <div className={styles.grid}>
        {continueReading && (
          <article className={styles.card}>
            <div>
              <div className={styles.cardTitle}>
                {formatMessage({
                  id: "texts.continueReading",
                  defaultMessage: "Continue reading",
                })}
              </div>
              <div className={styles.cardMeta}>{book.title}</div>
              <p className={styles.cardDesc}>
                {formatMessage(
                  {
                    id: "texts.continueReading.desc",
                    defaultMessage: "You are at paragraph {paragraph}.",
                  },
                  { paragraph: paragraph + 1 },
                )}
              </p>
            </div>
            <button
              type="button"
              className={styles.go}
              onClick={() =>
                practise((s) => s.set(lessonProps.type, LessonType.BOOKS))
              }
            >
              {practiseLabel}
            </button>
          </article>
        )}
        {cards.map((entry) => {
          const name = TYPE_NAMES[entry.type];
          if (name == null) {
            return null;
          }
          return (
            <article
              key={`${entry.type}:${entry.detail}`}
              className={styles.card}
            >
              <div>
                <div className={styles.cardTitle}>{formatMessage(name)}</div>
                {entry.label != null && (
                  <div className={styles.cardMeta}>{entry.label}</div>
                )}
                <p className={styles.cardDesc}>
                  {formatMessage({
                    id: "texts.recent.desc",
                    defaultMessage: "Recently practised.",
                  })}
                </p>
              </div>
              <button
                type="button"
                className={styles.go}
                onClick={() =>
                  practise((s) => {
                    let next = s.set(
                      lessonProps.type,
                      LessonType.ALL.get(entry.type, LessonType.GUIDED),
                    );
                    if (entry.type === "books" && entry.detail != null) {
                      next = next.set(
                        lessonProps.books.book,
                        lessonProps.books.book.all.get(entry.detail, book),
                      );
                    }
                    if (entry.type === "code" && entry.detail != null) {
                      next = next.set(
                        lessonProps.code.syntax,
                        lessonProps.code.syntax.all.get(
                          entry.detail,
                          s.get(lessonProps.code.syntax),
                        ),
                      );
                    }
                    return next;
                  })
                }
              >
                {practiseLabel}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function TextsPage(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const practise = (mutate: (s: Settings) => Settings): void => {
    updateSettings(mutate(settings));
    navigate(Pages.practice.path);
  };

  const practiseLabel = formatMessage({
    id: "texts.practiseThis",
    defaultMessage: "Practise this",
  });

  return (
    <Screen>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div className={styles.kicker}>
            {formatMessage({
              id: "texts.kicker",
              defaultMessage: "Practice library",
            })}
          </div>
          <h1 className={styles.title}>
            {formatMessage({ id: "t_Texts", defaultMessage: "Texts" })}
          </h1>
          <p className={styles.sub}>
            {formatMessage({
              id: "texts.intro",
              defaultMessage:
                "Choose what you type. Pick a book, paste your own words, or drill frequent words, code and numbers — then start practising straight away.",
            })}
          </p>
        </header>

        <JumpBackIn practise={practise} practiseLabel={practiseLabel} />

        <section className={styles.section}>
          <div className={styles.h2}>
            {formatMessage({ id: "texts.books", defaultMessage: "Books" })}
          </div>
          <div className={styles.grid}>
            {[...Book.ALL].map((book) => (
              <article key={book.id} className={styles.card}>
                <div>
                  <div className={styles.cardTitle}>{book.title}</div>
                  <div className={styles.cardMeta}>{book.author}</div>
                  <p className={styles.cardDesc}>
                    {BLURB[book.id] ? formatMessage(BLURB[book.id]) : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.go}
                  onClick={() =>
                    practise((s) =>
                      s
                        .set(lessonProps.type, LessonType.BOOKS)
                        .set(lessonProps.books.book, book),
                    )
                  }
                >
                  {practiseLabel}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.h2}>
            {formatMessage({
              id: "texts.moreWays",
              defaultMessage: "More ways to practise",
            })}
          </div>
          <div className={styles.grid}>
            {MODES.map((m) => (
              <article key={m.name.id} className={styles.card}>
                <div>
                  <div className={styles.cardTitle}>
                    {formatMessage(m.name)}
                  </div>
                  <p className={styles.cardDesc}>{formatMessage(m.desc)}</p>
                </div>
                <button
                  type="button"
                  className={styles.go}
                  onClick={() =>
                    practise((s) => s.set(lessonProps.type, m.type))
                  }
                >
                  {practiseLabel}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.h2}>
            {formatMessage({
              id: "texts.ownText",
              defaultMessage: "Your own text",
            })}
          </div>
          <p className={styles.sub}>
            {formatMessage({
              id: "texts.ownText.desc",
              defaultMessage:
                "Paste an article, lyrics, homework — anything — and practise on it.",
            })}
          </p>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder={formatMessage({
              id: "texts.paste.placeholder",
              defaultMessage: "Paste any text here…",
            })}
            rows={5}
          />
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.go}
              disabled={text.trim().length === 0}
              onClick={() =>
                practise((s) =>
                  s
                    .set(lessonProps.type, LessonType.CUSTOM)
                    .set(lessonProps.customText.content, text.trim()),
                )
              }
            >
              {practiseLabel}
            </button>
            {/* The same paste, a different drill: the words shuffled and
                repeated by the word-list engine instead of typed in order —
                a spelling list rather than an article. */}
            <button
              type="button"
              className={styles.go}
              disabled={text.trim().length === 0}
              onClick={() =>
                practise((s) =>
                  s
                    .set(lessonProps.type, LessonType.WORDLIST)
                    .set(lessonProps.wordList.useCustom, true)
                    .set(lessonProps.wordList.custom, text.trim()),
                )
              }
            >
              {formatMessage({
                id: "texts.drillAsWords",
                defaultMessage: "Drill as words",
              })}
            </button>
          </div>
        </section>
      </div>
    </Screen>
  );
}
