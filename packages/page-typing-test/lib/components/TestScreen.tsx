import { Screen } from "@keybr/pages-shared";
import { uiProps } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { type LineList, makeStats } from "@keybr/textinput";
import { useSoundPlayer } from "@keybr/textinput-sounds";
import { TextArea } from "@keybr/textinput-ui";
import { Box, type Focusable, Spacer, useView } from "@keybr/widget";
import { useEffect, useRef, useState } from "react";
import { useFormatter } from "@keybr/lesson-ui";
import { FormattedMessage } from "react-intl";
import {
  type TextGenerator,
  TextGeneratorLoader,
} from "../generators/index.ts";
import { loadSummary } from "../history.ts";
import {
  type Duration,
  DurationType,
  Session,
  type TestResult,
} from "../session/index.ts";
import {
  type CompositeSettings,
  TestStyle,
  useCompositeSettings,
} from "../settings.ts";
import { views } from "../views.tsx";
import { LineTemplate } from "./LineTemplate.tsx";
import * as road from "./road.module.less";
import { TestProgress } from "./TestProgress.tsx";
import * as styles from "./TestScreen.module.less";

// Slide the header away while typing (opt-in) exactly like the practice page:
// hide on a keystroke, bring it back ~2s after the last one.
function setHeaderHidden(hidden: boolean): void {
  window.dispatchEvent(
    new window.CustomEvent("keylearn:header-hide", { detail: hidden }),
  );
}

// A faint watermark naming the current mode, e.g. "30s · COACH".
function modeLabel(duration: Duration, testStyle: TestStyle): string {
  const style =
    testStyle === TestStyle.Zen
      ? "Zen"
      : testStyle === TestStyle.Arcade
        ? "Arcade"
        : "Coach";
  let length: string;
  switch (duration.type) {
    case DurationType.Time:
      length = `${Math.round(duration.value / 1000)}s`;
      break;
    case DurationType.Words:
      length = `${duration.value} words`;
      break;
    default:
      length = `${duration.value} chars`;
  }
  return `${length} · ${style}`;
}

export function TestScreen() {
  return (
    <TextGeneratorLoader>
      {(generator) => (
        <Controller generator={generator} mark={generator.mark()} />
      )}
    </TextGeneratorLoader>
  );
}

function Controller({
  generator,
  mark,
}: {
  generator: TextGenerator;
  mark: unknown;
}) {
  const { setView } = useView(views);
  const settings = useCompositeSettings();
  const { settings: rawSettings } = useSettings();
  const hideHeaderWhileTyping = rawSettings.get(uiProps.hideHeaderWhileTyping);
  const { formatSpeed } = useFormatter();
  const focusRef = useRef<Focusable>(null);
  const headerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const player = useSoundPlayer();
  const [session, setSession] = useState(() => nextTest(settings, generator));
  const [lines, setLines] = useState<LineList>(Session.emptyLines);
  const [progress, setProgress] = useState(Session.emptyProgress);
  const [focused, setFocused] = useState(false);
  // The personal best / streak as they stand before this run.
  const [summary] = useState(() => loadSummary());
  const bestCpm = summary.best?.cpm ?? 0;
  const started = progress.length > 0;

  useEffect(() => {
    generator.reset(mark);
    const session = nextTest(settings, generator);
    setSession(session);
    setLines(session.getLines());
    setProgress(Session.emptyProgress);
  }, [settings, generator, mark]);

  // Always restore the header when leaving the live test.
  useEffect(
    () => () => {
      clearTimeout(headerTimer.current);
      setHeaderHidden(false);
    },
    [],
  );

  const pokeHeader = () => {
    if (!hideHeaderWhileTyping) {
      return;
    }
    setHeaderHidden(true);
    clearTimeout(headerTimer.current);
    headerTimer.current = setTimeout(() => setHeaderHidden(false), 2000);
  };

  return (
    <Screen>
      <div className={road.topSlot}>
        {started ? (
          // Arcade puts the live speed centre-stage at the top; Coach/Zen keep
          // the top clear for focus.
          settings.testStyle === TestStyle.Arcade && (
            <div className={road.arcadeSpeed}>{formatSpeed(progress.speed)}</div>
          )
        ) : (
          <div className={road.readyBar}>
            {bestCpm > 0 && (
              <span
                className={
                  settings.testStyle === TestStyle.Zen
                    ? road.readyBestMono
                    : road.readyBest
                }
              >
                <FormattedMessage
                  id="typingTest.ready.best"
                  defaultMessage="Your best · {speed}"
                  values={{ speed: formatSpeed(bestCpm) }}
                />
              </span>
            )}
            {summary.streakDays >= 2 && (
              <span className={road.readyStreak}>
                <FormattedMessage
                  id="typingTest.ready.streak"
                  defaultMessage="{n}-day streak"
                  values={{ n: summary.streakDays }}
                />
              </span>
            )}
          </div>
        )}
      </div>
      <Spacer size={10} />
      <Box alignItems="center" justifyContent="center">
        <div
          className={styles.text}
          onBlur={() => setFocused(false)}
        >
          {!focused && (
            <button
              type="button"
              className={road.startHint}
              onClick={() => focusRef.current?.focus()}
            >
              <span className={road.startKeycap}>
                <svg viewBox="0 0 24 24" aria-hidden={true}>
                  <path d="M19 6v6a2 2 0 0 1-2 2H6.8M10 10l-4 4 4 4" />
                </svg>
              </span>
              <span className={road.startLabel}>
                <FormattedMessage
                  id="textArea.startTyping"
                  defaultMessage="Press Enter to start typing"
                />
              </span>
            </button>
          )}
          <TextArea
            focusRef={focusRef}
            settings={settings.textDisplay}
            lines={lines}
            wrap={false}
            hideStartHint={true}
            onFocus={() => {
              setFocused(true);
              generator.reset(mark);
              const session = nextTest(settings, generator);
              setSession(session);
              setLines(session.getLines());
              setProgress(Session.emptyProgress);
            }}
            onKeyDown={session.handleKeyDown}
            onKeyUp={session.handleKeyUp}
            onInput={(event) => {
              const { feedback, progress, completed } =
                session.handleInput(event);
              setLines(session.getLines());
              setProgress(progress);
              player(feedback);
              pokeHeader();
              if (completed) {
                clearTimeout(headerTimer.current);
                setHeaderHidden(false);
                setView("report", { result: makeResult(session) });
              }
            }}
            lineTemplate={LineTemplate}
          />
          <TestProgress
            progress={progress}
            duration={settings.duration}
            testStyle={settings.testStyle}
            bestCpm={bestCpm}
          />
          <div className={road.modeWatermark} aria-hidden={true}>
            {modeLabel(settings.duration, settings.testStyle)}
          </div>
          {!started && (
            <button
              type="button"
              className={road.cornerGear}
              title="Settings…"
              onClick={() => setView("settings")}
            >
              <svg viewBox="0 0 24 24" aria-hidden={true}>
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
              </svg>
            </button>
          )}
        </div>
      </Box>
    </Screen>
  );
}

function nextTest(settings: CompositeSettings, generator: TextGenerator) {
  return new Session({ ...settings, numLines: 5, numCols: 55 }, generator);
}

function makeResult(session: Session): TestResult {
  const steps = session.getSteps();
  const events = session.getEvents();
  return {
    stats: makeStats(steps),
    steps,
    events,
  };
}
