import { type KeyId } from "@keybr/keyboard";
import { names } from "@keybr/lesson-ui";
import { Screen } from "@keybr/pages-shared";
import { enumProp, numberProp, Preferences } from "@keybr/settings";
import { type LineList } from "@keybr/textinput";
import {
  type IInputEvent,
  type IKeyboardEvent,
  ModifierState,
} from "@keybr/textinput-events";
import { TextArea } from "@keybr/textinput-ui";
import { type Focusable, Zoomer } from "@keybr/widget";
import {
  createRef,
  type CSSProperties,
  PureComponent,
  type ReactNode,
} from "react";
import { FormattedMessage } from "react-intl";
import { uiProps } from "@keybr/result";
import { Controls } from "./Controls.tsx";
import { GhostTrack } from "./GhostTrack.tsx";
import { Indicators } from "./Indicators.tsx";
import { DeferredKeyboardPresenter } from "./KeyboardPresenter.tsx";
import { PracticeTour } from "./PracticeTour.tsx";
import * as styles from "./Presenter.module.less";
import { type LessonState } from "./state/index.ts";
import { StatusFooter } from "./StatusFooter.tsx";

type Props = {
  readonly state: LessonState;
  readonly lines: LineList;
  readonly depressedKeys: readonly KeyId[];
  readonly colorOf?: (codePoint: number) => string | null;
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
    textSize: Preferences.get(propTextSize),
  };

  override componentDidMount() {
    window.addEventListener("keylearn:focus-mode", this.handleToggleFocusMode);
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
  }

  override render() {
    const {
      props: { state, lines, depressedKeys, colorOf },
      state: { view, tour, focus, focusMode, textSize },
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
            depressedKeys={depressedKeys}
            toggledKeys={ModifierState.modifiers}
            controls={
              <Controls
                onChangeView={handleChangeView}
                onResetLesson={handleResetLesson}
                onSkipLesson={handleSkipLesson}
                onHelp={handleHelp}
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
                colorOf={colorOf}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onInput={handleInput}
              />
            }
            onStart={() => this.focusRef.current?.focus()}
            textSize={textSize}
            sizer={
              <label className={styles.sizer} title="Practice text size">
                <span className={styles.sizerIcon}>Aa</span>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={textSize}
                  onChange={(ev) => {
                    handleTextSize(Number(ev.target.value));
                  }}
                />
              </label>
            }
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
  depressedKeys,
  toggledKeys,
  controls,
  textInput,
  textSize,
  sizer,
  onStart,
  tour,
}: {
  readonly state: LessonState;
  readonly focus: boolean;
  readonly focusMode: boolean;
  readonly depressedKeys: readonly string[];
  readonly toggledKeys: readonly string[];
  readonly controls: ReactNode;
  readonly textInput: ReactNode;
  readonly textSize: number;
  readonly sizer: ReactNode;
  readonly onStart: () => void;
  readonly tour: ReactNode;
}) {
  return (
    <Screen className={styles.screen}>
      {focusMode || <Indicators state={state} />}
      <div
        id={names.textInput}
        className={styles.textInput_normal}
        style={{ "--text-scale": textSize } as CSSProperties}
      >
        {textInput}
        {sizer}
      </div>
      <div id={names.keyboard} className={styles.keyboard}>
        {focus && !focusMode && state.settings.get(uiProps.ghostRace) && (
          <GhostTrack state={state} />
        )}
        {focus || (
          <button
            type="button"
            className={styles.startHint}
            onClick={onStart}
          >
            <FormattedMessage
              id="textArea.startTyping"
              defaultMessage="Press Enter to start typing"
            />
          </button>
        )}
        <DeferredKeyboardPresenter
          focus={focus}
          depressedKeys={depressedKeys}
          toggledKeys={toggledKeys}
          suffix={state.suffix}
          lastLesson={state.lastLesson}
          masteryKeys={masteryKeysOf(state)}
        />
      </div>
      {focusMode || <StatusFooter state={state} />}
      {controls}
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
      </div>
      {controls}
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
      </div>
      {controls}
    </Screen>
  );
}
