import { type KeyId } from "@keybr/keyboard";
import { names } from "@keybr/lesson-ui";
import { Screen } from "@keybr/pages-shared";
import { uiProps } from "@keybr/result";
import { enumProp, numberProp, Preferences } from "@keybr/settings";
import { type LineList } from "@keybr/textinput";
import {
  type IInputEvent,
  type IKeyboardEvent,
  ModifierState,
} from "@keybr/textinput-events";
import { TextArea } from "@keybr/textinput-ui";
import { type Focusable, Zoomer } from "@keybr/widget";
import { clsx } from "clsx";
import {
  createRef,
  type CSSProperties,
  PureComponent,
  type ReactNode,
} from "react";
import { FormattedMessage } from "react-intl";
import { Controls } from "./Controls.tsx";
import { GhostTrack } from "./GhostTrack.tsx";
import { Indicators, JourneyStrip } from "./Indicators.tsx";
import { DeferredKeyboardPresenter } from "./KeyboardPresenter.tsx";
import { PracticeTour } from "./PracticeTour.tsx";
import * as styles from "./Presenter.module.less";
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
    focusMode: false,
    typing: false,
    textSize: Preferences.get(propTextSize),
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
    if (this.props.state.settings.get(uiProps.hideHeaderWhileTyping)) {
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

  override componentDidMount() {
    window.addEventListener("keylearn:focus-mode", this.handleToggleFocusMode);
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
    this.#stopTyping();
    this.#showHeader();
    this.#broadcastFocusMode(false);
  }

  override render() {
    const {
      props: { state, lines, depressedKeys },
      state: { view, tour, focus, focusMode, typing, textSize },
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
                sessionToggle={true}
              />
            }
            textInput={
              <TextArea
                focusRef={this.focusRef}
                settings={state.textDisplaySettings}
                lines={lines}
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
                sessionToggle={true}
              />
            }
            textInput={
              <Zoomer id="TextArea/Compact">
                <TextArea
                  focusRef={this.focusRef}
                  settings={state.textDisplaySettings}
                  lines={lines}
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
  readonly depressedKeys: readonly string[];
  readonly toggledKeys: readonly string[];
  readonly controls: ReactNode;
  readonly textInput: ReactNode;
  readonly textSize: number;
  readonly onStart: () => void;
  readonly tour: ReactNode;
}) {
  return (
    <Screen className={styles.screen}>
      {focusMode || (
        // While typing, everything but the text and keyboard steps back a
        // touch so the typing zone owns the attention.
        <div className={clsx(styles.chrome, typing && styles.dimmed)}>
          <Indicators state={state} />
          {/* The practice tools ride inside the telemetry island's top-right
              corner, as drawn in the redesign mockup. */}
          <div className={styles.chromeTools}>{controls}</div>
        </div>
      )}
      <div
        id={names.textInput}
        className={styles.textInput_normal}
        style={{ "--text-scale": textSize } as CSSProperties}
      >
        {textInput}
      </div>
      <div id={names.keyboard} className={styles.keyboard}>
        {focus && !focusMode && state.settings.get(uiProps.ghostRace) && (
          <GhostTrack state={state} />
        )}
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
            masteryKeys={masteryKeysOf(state)}
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

function masteryKeysOf(state: LessonState) {
  return [...state.lessonKeys]
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
