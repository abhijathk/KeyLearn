import { EventEmitter } from "@keylearn/lang";
import {
  type ClientMessage,
  GameState,
  handleTextInput,
  makeWorldState,
  PLAYER_ANNOUNCE_ID,
  PLAYER_PROGRESS_ID,
  type ServerMessage,
  updateWorldState,
  type WorldState,
} from "@keylearn/multiplayer-shared";
import { useSettings } from "@keylearn/settings";
import { toTextDisplaySettings } from "@keylearn/textinput";
import { type IInputEvent } from "@keylearn/textinput-events";
import { TextArea } from "@keylearn/textinput-ui";
import { type Focusable, useScreenSize } from "@keylearn/widget";
import { useEffect, useMemo, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { Countdown } from "./Countdown.tsx";
import * as styles from "./Game.module.less";
import { DeferredRails } from "./Rails.tsx";
import { type Transport } from "./transport.ts";

const handleFocus = () => {};
const handleBlur = () => {};
const WORLD_CHANGE_EVENT = "world-change";

export const Game = ({
  transport,
}: {
  transport: Transport<ServerMessage, ClientMessage>;
}) => {
  const intl = useIntl();
  const wrapper = useMemo(
    () => new WorldStateWrapper(transport, intl),
    [transport, intl],
  );
  const [worldState, setWorldState] = useState(wrapper.worldState);
  const focusRef = useRef<Focusable>(null);
  useEffect(() => {
    const eventListener = () => {
      setWorldState(wrapper.worldState);
      switch (wrapper.worldState.gameState) {
        case GameState.STARTING:
        case GameState.RUNNING: {
          focusRef.current?.focus();
          break;
        }
      }
    };
    wrapper.on(WORLD_CHANGE_EVENT, eventListener);
    wrapper.connect();
    return () => {
      wrapper.off(WORLD_CHANGE_EVENT, eventListener);
      wrapper.disconnect();
    };
  }, [wrapper]);
  const { settings } = useSettings();
  const textDisplaySettings = useMemo(
    () => toTextDisplaySettings(settings),
    [settings],
  );
  useScreenSize(); // Repaint on window resize.
  const { gameState, countDown, players, lines, ticker } = worldState;
  // The ring covers the states it is drawn for; the ticker still carries what
  // the others have to say — "Race started!", the finishing place, and the
  // waiting-for-the-next-one line. Dropping it entirely lost information the
  // page had no other way to give.
  const counting =
    gameState === GameState.STARTING || gameState === GameState.WAITING;
  return (
    <div className={styles.game}>
      {/*
        The countdown replaces the ticker line while a race is being set up; the
        rails carry the state of play once it is running. Between them they say
        everything the old scrolling ticker said, without anybody having to read
        a sentence in the two seconds before they start typing.
      */}
      <Countdown
        gameState={gameState}
        countDown={countDown}
        players={players}
      />
      {!counting && ticker !== "" && (
        <div className={styles.ticker}>{ticker}</div>
      )}
      <DeferredRails players={players} />
      <div className={styles.textArea}>
        <TextArea
          focusRef={focusRef}
          settings={textDisplaySettings}
          lines={lines}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onInput={wrapper.handleInput}
        />
      </div>
    </div>
  );
};

class WorldStateWrapper extends EventEmitter {
  #worldState: WorldState;

  constructor(
    readonly transport: Transport<ServerMessage, ClientMessage>,
    readonly intl: IntlShape,
  ) {
    super();
    this.#worldState = makeWorldState(this.intl);
  }

  get worldState(): WorldState {
    return this.#worldState;
  }

  setWorldState(worldState: WorldState) {
    this.#worldState = worldState;
    this.emit(WORLD_CHANGE_EVENT, worldState);
  }

  handleReceive = (message: ServerMessage) => {
    this.setWorldState(updateWorldState(this.intl, this.#worldState, message));
  };

  handleInput = ({ inputType, codePoint }: IInputEvent) => {
    if (inputType === "appendChar") {
      const result = handleTextInput(this.#worldState, codePoint);
      if (result != null) {
        const { worldState, elapsed } = result;
        this.setWorldState(worldState);
        this.transport.send({
          type: PLAYER_PROGRESS_ID,
          elapsed,
          codePoint,
        });
      }
    }
  };

  connect() {
    this.transport.addReceiver(this.handleReceive);
    this.transport.send({
      type: PLAYER_ANNOUNCE_ID,
      signature: 0xdeadbabe,
    });
  }

  disconnect() {
    this.transport.removeReceiver(this.handleReceive);
  }
}
