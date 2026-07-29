import { Book } from "@keybr/content";
import { LessonType, lessonProps } from "@keybr/lesson";
import { Pages, Screen } from "@keybr/pages-shared";
import { type Settings, useSettings } from "@keybr/settings";
import { type ReactNode, useState } from "react";
import { defineMessage, type MessageDescriptor, useIntl } from "react-intl";
import { useNavigate } from "react-router";
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
    name: defineMessage({ id: "texts.mode.guided", defaultMessage: "Guided practice" }),
    desc: defineMessage({
      id: "texts.mode.guided.desc",
      defaultMessage: "The adaptive default — grows your alphabet one key at a time.",
    }),
  },
  {
    type: LessonType.WORDLIST,
    name: defineMessage({ id: "texts.mode.words", defaultMessage: "Frequent words" }),
    desc: defineMessage({
      id: "texts.mode.words.desc",
      defaultMessage: "The most common words in your language.",
    }),
  },
  {
    type: LessonType.CODE,
    name: defineMessage({ id: "texts.mode.code", defaultMessage: "Code snippets" }),
    desc: defineMessage({
      id: "texts.mode.code.desc",
      defaultMessage: "Brackets, symbols and the rhythm of code.",
    }),
  },
  {
    type: LessonType.NUMBERS,
    name: defineMessage({ id: "texts.mode.numbers", defaultMessage: "Number drills" }),
    desc: defineMessage({
      id: "texts.mode.numbers.desc",
      defaultMessage: "The number row and the keypad.",
    }),
  },
  {
    type: LessonType.CURRICULUM,
    name: defineMessage({ id: "texts.mode.curriculum", defaultMessage: "Classic course" }),
    desc: defineMessage({
      id: "texts.mode.curriculum.desc",
      defaultMessage: "A fixed, ordered march through the keys.",
    }),
  },
];

const BLURB: Record<string, MessageDescriptor> = {
  [Book.EN_WIZARD_OZ.id]: defineMessage({
    id: "texts.book.wizardOz",
    defaultMessage: "A cyclone, a yellow-brick road, and friends made along the way.",
  }),
  [Book.EN_TREASURE_ISLAND.id]: defineMessage({
    id: "texts.book.treasureIsland",
    defaultMessage: "Pirates, a treasure map, and a chest of gold on a far-off island.",
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
    defaultMessage: "A bright, talkative orphan turns a quiet farm upside down.",
  }),
};

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
                  <div className={styles.cardTitle}>{formatMessage(m.name)}</div>
                  <p className={styles.cardDesc}>{formatMessage(m.desc)}</p>
                </div>
                <button
                  type="button"
                  className={styles.go}
                  onClick={() => practise((s) => s.set(lessonProps.type, m.type))}
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
          <div>
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
          </div>
        </section>
      </div>
    </Screen>
  );
}
