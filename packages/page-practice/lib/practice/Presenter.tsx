import { codeThemeFor, codeThemeVars } from "@keylearn/content-snippets";
import { keyboardProps } from "@keylearn/keyboard";
import { type KeyId } from "@keylearn/keyboard";
import { lessonProps, LessonType, Target } from "@keylearn/lesson";
import { names } from "@keylearn/lesson-ui";
import { loadA11y, profileStorageKey, Screen } from "@keylearn/pages-shared";
import { uiProps } from "@keylearn/result";
import {
  enumProp,
  numberProp,
  Preferences,
  type Settings,
  useSettings,
} from "@keylearn/settings";
import { type LineList } from "@keylearn/textinput";
import {
  type IInputEvent,
  type IKeyboardEvent,
  ModifierState,
} from "@keylearn/textinput-events";
import { TextArea } from "@keylearn/textinput-ui";
import { type Focusable, Zoomer } from "@keylearn/widget";
import { clsx } from "clsx";
import {
  createRef,
  type CSSProperties,
  PureComponent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FormattedMessage } from "react-intl";
import { Controls } from "./Controls.tsx";
import { GhostTrack } from "./GhostTrack.tsx";
import { Indicators, JourneyStrip } from "./Indicators.tsx";
import { DeferredKeyboardPresenter } from "./KeyboardPresenter.tsx";
import { PracticeTour } from "./PracticeTour.tsx";
import * as styles from "./Presenter.module.less";
import { readPinned } from "./Pulse.tsx";
import { type LessonState } from "./state/index.ts";

type Props = {
  readonly state: LessonState;
  readonly lines: LineList;
  readonly depressedKeys: readonly KeyId[];
  readonly onResetLesson: () => void;
  readonly onSkipLesson: () => void;
  readonly onKeyDown: (ev: IKeyboardEvent) => void;
  readonly onKeyUp: (ev: IKeyboardEvent) => void;
  readonly onInput: (ev: IInputEvent) => void;
};

type State = {
  readonly view: View;
  readonly tour: boolean;
  readonly focus: boolean;
  readonly focusMode: boolean;
  readonly typing: boolean;
  readonly textSize: number;
  /** The session recap is held open, so the chrome must not step back. */
  readonly pinned: boolean;
};

enum View {
  Normal = 1,
  Compact = 2,
  Bare = 3,
}

function getNextView(view: View): View {
  switch (view) {
    case View.Normal:
      return View.Compact;
    case View.Compact:
      return View.Bare;
    case View.Bare:
      return View.Normal;
  }
}

const propView = enumProp("prefs.practice.view", View, View.Normal);
/**
 * How much smaller code is drawn than prose, at the same size setting.
 *
 * A line of code is far longer than a line of words and carries punctuation
 * that has to stay legible next to it, so the size that reads comfortably for
 * "the quick brown fox" puts three tokens on a line and wraps the rest. This
 * is a correction to the same setting rather than a second setting: the
 * learner has already said how big they want text, and being asked twice for
 * the same preference is how settings screens get long.
 */
const CODE_TEXT_SCALE = 0.68;

/**
 * The chosen editor palette, as custom properties on the text container.
 *
 * Scoped to that element rather than the document, so a colour scheme applies
 * to the code being typed and to nothing else on the page.
 */
function codeStyle(settings: Settings): Record<string, string> {
  if (settings.get(lessonProps.type) !== LessonType.CODE) {
    return {};
  }
  const theme = codeThemeFor(settings.get(lessonProps.code.theme));
  return theme != null ? codeThemeVars(theme) : {};
}

function hasCodeTheme(settings: Settings): boolean {
  return (
    settings.get(lessonProps.type) === LessonType.CODE &&
    settings.get(lessonProps.code.themeBackground) &&
    codeThemeFor(settings.get(lessonProps.code.theme)) != null
  );
}

const propTextSize = numberProp("prefs.practice.textScale", 1, {
  min: 0.75,
  max: 1.5,
});

export class Presenter extends PureComponent<Props, State> {
  readonly focusRef = createRef<Focusable>();

  override state: State = {
    view: Preferences.get(propView),
    tour: false,
    focus: false,
    // A learner who has asked for one thing on screen starts with one thing on
    // screen. The button that turns it off is still there — this is where they
    // begin, not a cage.
    focusMode: loadA11y().plain,
    typing: false,
    textSize: Preferences.get(propTextSize),
    pinned: readPinned(),
  };

  #typingTimer: ReturnType<typeof setTimeout> | undefined;
  #headerTimer: ReturnType<typeof setTimeout> | undefined;
  #headerHidden = false;

  // Dim the chrome only while keys are actually landing: any keystroke turns
  // it on, three quiet seconds turn it back off. When enabled, the same signal
  // also slides the whole header away for a distraction-free focus on the text.
  #pokeTyping() {
    if (!this.state.typing) {
      this.setState({ typing: true });
      window.dispatchEvent(
        new window.CustomEvent("keylearn:typing", { detail: true }),
      );
    }
    clearTimeout(this.#typingTimer);
    this.#typingTimer = setTimeout(() => {
      this.#stopTyping();
    }, 5000);

    // Header auto-hide (opt-in): hide on the first keystroke, and bring it back
    // ~2 seconds after the last one — the timer resets on every keystroke, so
    // it stays away through continuous typing and returns shortly after a pause.
    if (
      this.props.state.settings.get(uiProps.hideHeaderWhileTyping) &&
      !this.state.pinned
    ) {
      this.#hideHeader();
      clearTimeout(this.#headerTimer);
      this.#headerTimer = setTimeout(() => {
        this.#showHeader();
      }, 2000);
    }
  }

  #stopTyping() {
    clearTimeout(this.#typingTimer);
    if (this.state.typing) {
      this.setState({ typing: false });
      window.dispatchEvent(
        new window.CustomEvent("keylearn:typing", { detail: false }),
      );
    }
  }

  #hideHeader() {
    if (!this.#headerHidden) {
      this.#headerHidden = true;
      window.dispatchEvent(
        new window.CustomEvent("keylearn:header-hide", { detail: true }),
      );
    }
  }

  #showHeader() {
    clearTimeout(this.#headerTimer);
    if (this.#headerHidden) {
      this.#headerHidden = false;
      window.dispatchEvent(
        new window.CustomEvent("keylearn:header-hide", { detail: false }),
      );
    }
  }

  // The presenter owns the focus-mode state: the header only requests a
  // toggle and then follows the broadcast state, so the two can never drift
  // apart (a stale header once left the whole practice chrome hidden).
  #broadcastFocusMode(focusMode: boolean) {
    window.dispatchEvent(
      new window.CustomEvent("keylearn:focus-mode-state", {
        detail: focusMode,
      }),
    );
  }

  handlePinned = (ev: Event) => {
    this.setState({ pinned: (ev as CustomEvent<boolean>).detail });
  };

  override componentDidMount() {
    window.addEventListener("keylearn:focus-mode", this.handleToggleFocusMode);
    window.addEventListener("keylearn:pulse-pinned", this.handlePinned);
    this.#broadcastFocusMode(this.state.focusMode);
    if (this.props.state.settings.isNew) {
      this.setState({
        view: View.Normal,
        tour: true,
      });
    }
  }

  override componentWillUnmount() {
    window.removeEventListener(
      "keylearn:focus-mode",
      this.handleToggleFocusMode,
    );
    window.removeEventListener("keylearn:pulse-pinned", this.handlePinned);
    this.#stopTyping();
    this.#showHeader();
    this.#broadcastFocusMode(false);
  }

  override render() {
    const {
      props: { state, lines, depressedKeys },
      state: { view, tour, focus, focusMode, typing, textSize, pinned },
      handleResetLesson,
      handleSkipLesson,
      handleKeyDown,
      handleKeyUp,
      handleInput,
      handleFocus,
      handleBlur,
      handleChangeView,
      handleToggleFocusMode,
      handleTextSize,
      handleHelp,
      handleTourClose,
    } = this;
    switch (view) {
      case View.Normal:
        return (
          <NormalLayout
            state={state}
            focus={tour || focus}
            focusMode={focusMode}
            typing={typing}
            pinned={pinned}
            depressedKeys={depressedKeys}
            toggledKeys={ModifierState.modifiers}
            controls={
              <Controls
                onChangeView={handleChangeView}
                onResetLesson={handleResetLesson}
                onSkipLesson={handleSkipLesson}
                onHelp={handleHelp}
                textSize={textSize}
                onTextSize={handleTextSize}
              />
            }
            textInput={
              <TextArea
                focusRef={this.focusRef}
                settings={state.textDisplaySettings}
                lines={lines}
                lineNumbers={
                  state.settings.get(lessonProps.type) === LessonType.CODE
                }
                size="X0"
                demo={tour}
                hideStartHint={true}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onInput={handleInput}
              />
            }
            onStart={() => this.focusRef.current?.focus()}
            textSize={textSize}
            tour={tour && <PracticeTour onClose={handleTourClose} />}
          />
        );
      case View.Compact:
        return (
          <CompactLayout
            state={state}
            focus={tour || focus}
            depressedKeys={depressedKeys}
            controls={
              <Controls
                onChangeView={handleChangeView}
                onResetLesson={handleResetLesson}
                onSkipLesson={handleSkipLesson}
                onHelp={handleHelp}
              />
            }
            textInput={
              <Zoomer id="TextArea/Compact">
                <TextArea
                  focusRef={this.focusRef}
                  settings={state.textDisplaySettings}
                  lines={lines}
                  lineNumbers={
                    state.settings.get(lessonProps.type) === LessonType.CODE
                  }
                  size="X1"
                  demo={tour}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onInput={handleInput}
                />
              </Zoomer>
            }
          />
        );
      case View.Bare:
        return (
          <BareLayout
            state={state}
            focus={tour || focus}
            depressedKeys={depressedKeys}
            controls={
              <Controls
                onChangeView={handleChangeView}
                onResetLesson={handleResetLesson}
                onSkipLesson={handleSkipLesson}
                onHelp={handleHelp}
              />
            }
            textInput={
              <Zoomer id="TextArea/Bare">
                <TextArea
                  focusRef={this.focusRef}
                  settings={state.textDisplaySettings}
                  lines={lines}
                  lineNumbers={
                    state.settings.get(lessonProps.type) === LessonType.CODE
                  }
                  size="X2"
                  demo={tour}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onInput={handleInput}
                />
              </Zoomer>
            }
          />
        );
    }
  }

  handleResetLesson = () => {
    this.props.onResetLesson();
    this.focusRef.current?.focus();
  };

  handleSkipLesson = () => {
    this.props.onSkipLesson();
    this.focusRef.current?.focus();
  };

  handleKeyDown = (ev: IKeyboardEvent) => {
    if (this.state.focus) {
      this.props.onKeyDown(ev);
      this.#pokeTyping();
    }
  };

  handleKeyUp = (ev: IKeyboardEvent) => {
    if (this.state.focus) {
      this.props.onKeyUp(ev);
    }
  };

  handleInput = (ev: IInputEvent) => {
    if (this.state.focus) {
      this.props.onInput(ev);
    }
  };

  handleFocus = () => {
    this.setState(
      {
        focus: true,
      },
      () => {
        this.props.onResetLesson();
      },
    );
  };

  handleBlur = () => {
    this.#stopTyping();
    this.setState(
      {
        focus: false,
      },
      () => {
        this.props.onResetLesson();
      },
    );
  };

  handleChangeView = () => {
    this.setState(
      ({ view }) => {
        const nextView = getNextView(view);
        Preferences.set(propView, nextView);
        return { view: nextView };
      },
      () => {
        this.props.onResetLesson();
        this.focusRef.current?.focus();
      },
    );
  };

  handleTextSize = (textSize: number) => {
    Preferences.set(propTextSize, textSize);
    this.setState({ textSize });
  };

  handleToggleFocusMode = () => {
    this.setState(
      ({ focusMode }) => ({ focusMode: !focusMode }),
      () => {
        this.#broadcastFocusMode(this.state.focusMode);
        this.focusRef.current?.focus();
      },
    );
  };

  handleHelp = () => {
    this.setState(
      {
        view: View.Normal,
        tour: true,
      },
      () => {
        this.props.onResetLesson();
        this.focusRef.current?.blur();
      },
    );
  };

  handleTourClose = () => {
    this.setState(
      {
        view: View.Normal,
        tour: false,
      },
      () => {
        this.props.onResetLesson();
        this.focusRef.current?.focus();
      },
    );
  };
}

function NormalLayout({
  state,
  focus,
  focusMode,
  typing,
  pinned,
  depressedKeys,
  toggledKeys,
  controls,
  textInput,
  textSize,
  onStart,
  tour,
}: {
  readonly state: LessonState;
  readonly focus: boolean;
  readonly focusMode: boolean;
  readonly typing: boolean;
  readonly pinned: boolean;
  readonly depressedKeys: readonly string[];
  readonly toggledKeys: readonly string[];
  readonly controls: ReactNode;
  readonly textInput: ReactNode;
  readonly textSize: number;
  readonly onStart: () => void;
  readonly tour: ReactNode;
}) {
  // The set of keys in play, and how sure each one is, changes when a lesson
  // does — not when a key is pressed. Rebuilding the array every keystroke
  // handed the keyboard a new prop each time and cost it its memo.
  const masteryKeys = useMemo(() => masteryKeysOf(state), [state]);
  return (
    <Screen className={styles.screen}>
      {focusMode || (
        // While typing, everything but the text and keyboard steps back a
        // touch so the typing zone owns the attention.
        <div
          className={clsx(styles.chrome, typing && !pinned && styles.dimmed)}
        >
          <Indicators state={state} />
          {/* The practice tools ride inside the telemetry island's top-right
              corner, as drawn in the redesign mockup. */}
          <div className={styles.chromeTools}>{controls}</div>
        </div>
      )}
      <div
        id={names.textInput}
        className={clsx(
          styles.textInput_normal,
          state.settings.get(lessonProps.type) === LessonType.CODE &&
            styles.textInput_code,
          hasCodeTheme(state.settings) && styles.textInput_themed,
        )}
        style={
          {
            "--text-scale":
              textSize *
              (state.settings.get(lessonProps.type) === LessonType.CODE
                ? CODE_TEXT_SCALE
                : 1),
            ...codeStyle(state.settings),
          } as CSSProperties
        }
      >
        {textInput}
      </div>
      <div id={names.keyboard} className={styles.keyboard}>
        {focus && !focusMode && state.settings.get(uiProps.ghostRace) && (
          <GhostTrack state={state} />
        )}
        <ResetNotice />
        <GuideRetired lessonKeys={state.lessonKeys} />
        {focus || (
          // The invitation as a self-pressing Enter keycap in the app's own
          // key style, with the message riding under it as a micro-label.
          <button type="button" className={styles.startHint} onClick={onStart}>
            <span className={styles.startKeycap}>
              <svg viewBox="0 0 24 24" aria-hidden={true}>
                <path d="M19 6v6a2 2 0 0 1-2 2H6.8M10 10l-4 4 4 4" />
              </svg>
            </span>
            <span className={styles.startLabel}>
              <FormattedMessage
                id="textArea.startTyping"
                defaultMessage="Press Enter to start typing"
              />
            </span>
          </button>
        )}
        {state.settings.get(uiProps.hideKeyboard) || (
          <DeferredKeyboardPresenter
            focus={focus}
            depressedKeys={depressedKeys}
            toggledKeys={toggledKeys}
            suffix={state.suffix}
            lastLesson={state.lastLesson}
            masteryKeys={masteryKeys}
          />
        )}
      </div>
      {focusMode || (
        // While the resting hands are draped over the keyboard the journey
        // strip slides down out from under them, and back up when typing.
        <div
          className={
            focus
              ? clsx(styles.footerZone, typing && styles.dimmed)
              : styles.footerZone_rest
          }
        >
          <JourneyStrip state={state} />
        </div>
      )}
      {tour}
    </Screen>
  );
}

/**
 * Says that the line was restarted, and why.
 *
 * The restart itself is right — a lesson clock that kept running while you
 * were in another tab would record a speed you never typed at — but it used to
 * happen in silence, so somebody who looked away came back to their work gone
 * and nothing to explain it. One quiet line, gone after a moment, is the whole
 * fix: the behaviour was never the problem.
 */
function ResetNotice(): ReactNode {
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => {
    const onReset = (ev: Event) => {
      setReason((ev as CustomEvent<string>).detail);
    };
    window.addEventListener("keylearn:lesson-reset", onReset);
    return () => window.removeEventListener("keylearn:lesson-reset", onReset);
  }, []);
  useEffect(() => {
    if (reason == null) {
      return;
    }
    const timer = setTimeout(() => setReason(null), 4000);
    return () => clearTimeout(timer);
  }, [reason]);
  if (reason == null) {
    return null;
  }
  return (
    <p className={styles.resetNotice} role="status">
      {reason === "idle" ? (
        <FormattedMessage
          id="practice.reset.idle"
          defaultMessage="Line restarted after a pause — so the speed stays honest."
        />
      ) : (
        <FormattedMessage
          id="practice.reset.away"
          defaultMessage="Line restarted while you were away — so the speed stays honest."
        />
      )}
    </p>
  );
}

/**
 * Retires the finger guide once it has done its job.
 *
 * The pointer under the next key answers "which finger?", and a learner who
 * can already answer it reads it as clutter — but nobody turns off a hint
 * they have stopped noticing, so it lingers for months. This watches for the
 * moment it stopped being needed and takes it away, with a line saying where
 * to get it back.
 *
 * "Stopped being needed" is measured, not guessed at: every key the lesson
 * has unlocked has to sit above the pass bar the unlock rules themselves use
 * (see {@link Target.passes}), and at least half the alphabet has to be in
 * play — all-of-five-keys is confidence about five keys, not about a
 * keyboard.
 *
 * It happens once ever. Somebody who turns the guide back on keeps it.
 */
function GuideRetired({
  lessonKeys,
}: {
  readonly lessonKeys: LessonState["lessonKeys"];
}): ReactNode {
  const { settings, updateSettings } = useSettings();
  const [shown, setShown] = useState(false);
  const pointers = settings.get(keyboardProps.pointers);
  const keys = [...lessonKeys];
  const included = keys.filter(({ isIncluded }) => isIncluded);
  const fluent =
    included.length > 0 &&
    included.length >= Math.ceil(keys.length / 2) &&
    included.every(({ bestConfidence }) => Target.passes(bestConfidence));
  useEffect(() => {
    if (!fluent || !pointers) {
      return;
    }
    const key = profileStorageKey("practice.guideRetired");
    try {
      if (localStorage.getItem(key) != null) {
        return;
      }
      localStorage.setItem(key, "1");
    } catch {
      // A learner with storage blocked simply keeps the guide.
      return;
    }
    updateSettings(settings.set(keyboardProps.pointers, false));
    setShown(true);
  }, [fluent, pointers, settings, updateSettings]);
  useEffect(() => {
    if (!shown) {
      return;
    }
    const timer = setTimeout(() => setShown(false), 8000);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!shown) {
    return null;
  }
  return (
    <p className={styles.resetNotice} role="status">
      <FormattedMessage
        id="practice.guideRetired"
        defaultMessage="You know these keys now, so the finger guide has stepped back. Turn it on again any time in keyboard settings."
      />
    </p>
  );
}

function masteryKeysOf(state: LessonState) {
  const keys = [...state.lessonKeys];
  // Code and number lessons start with every key in play, so a bar under each
  // one draws a full row that never changes. An indicator that always says the
  // same thing is decoration.
  if (keys.every((key) => key.isIncluded)) {
    return [];
  }
  return keys
    .filter((key) => key.isIncluded)
    .map(({ letter: { codePoint }, confidence }) => ({
      codePoint,
      confidence: confidence ?? 0,
    }));
}

function CompactLayout({
  state,
  controls,
  textInput,
}: {
  readonly state: LessonState;
  readonly focus: boolean;
  readonly depressedKeys: readonly string[];
  readonly controls: ReactNode;
  readonly textInput: ReactNode;
}) {
  return (
    <Screen>
      <Indicators state={state} />
      <div id={names.textInput} className={styles.textInput_compact}>
        {textInput}
        {controls}
      </div>
    </Screen>
  );
}

function BareLayout({
  state,
  controls,
  textInput,
}: {
  readonly state: LessonState;
  readonly focus: boolean;
  readonly depressedKeys: readonly string[];
  readonly controls: ReactNode;
  readonly textInput: ReactNode;
}) {
  return (
    <Screen>
      <div id={names.textInput} className={styles.textInput_bare}>
        {textInput}
        {controls}
      </div>
    </Screen>
  );
}
