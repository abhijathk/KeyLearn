import { type Timer } from "@keylearn/lang";
import { type AnyUser } from "@keylearn/pages-shared";
import { type LineList, type TextInput } from "@keylearn/textinput";
import { type GameState } from "./messages.ts";

export type WorldState = {
  readonly gameState: GameState;
  /**
   * Seconds until the race starts, while the state is STARTING.
   *
   * The server has always sent this; it used to be folded straight into the
   * ticker sentence, which meant the only way to draw a countdown was to parse
   * a translated string back into a number. Carried plainly so the UI can show
   * it as a number, a ring, or nothing at all.
   */
  readonly countDown: number;
  readonly players: PlayerList;
  readonly textInput: TextInput;
  readonly lines: LineList;
  readonly timer: Timer;
  readonly ticker: string;
};

export type BasicPlayer = {
  readonly id: number;
  readonly user: AnyUser;
};

export type PlayerState = {
  readonly spectator: boolean;
  readonly finished: boolean;
  readonly position: number;
  readonly offset: number;
  readonly speed: number;
  readonly errors: number;
};

export type Player = BasicPlayer &
  PlayerState & {
    readonly progress: number;
  };

export type PlayerList = {
  readonly all: readonly Player[];
  readonly me: Player;
};
