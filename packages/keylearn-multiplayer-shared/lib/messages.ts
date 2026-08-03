import { type BasicPlayer, type PlayerState } from "./types.ts";

export const PLAYER_KICKED = 4001;

export enum GameState {
  /** Game is initializing. */
  INITIALIZING = -1,
  /** Waiting for more players. */
  WAITING = 0,
  /** Game is about to start, a count down is in progress. */
  STARTING = 1,
  /** Game is active and the game world is updated by the users. */
  RUNNING = 2,
  /** Game is finished. */
  FINISHED = 3,
}

export type ServerMessage =
  | PlayerJoinMessage
  | PlayerLeaveMessage
  | GameConfigMessage
  | GameReadyMessage
  | GameWorldMessage
  | ChatPostMessage
  | ChatNoticeMessage;

export type ClientMessage =
  | PlayerAnnounceMessage
  | PlayerProgressMessage
  | ChatSayMessage;

export const PLAYER_JOIN_ID = 0x11 as const;

/** The set of players is changed. */
export type PlayerJoinMessage = {
  readonly type: typeof PLAYER_JOIN_ID;
  readonly joinedId: number;
  readonly players: readonly BasicPlayer[];
};

export const PLAYER_LEAVE_ID = 0x12 as const;

/** The set of players is changed. */
export type PlayerLeaveMessage = {
  readonly type: typeof PLAYER_LEAVE_ID;
  readonly leftId: number;
  readonly players: readonly BasicPlayer[];
};

export const GAME_CONFIG_ID = 0x21 as const;

/** New game details. */
export type GameConfigMessage = {
  readonly type: typeof GAME_CONFIG_ID;
  readonly text: string;
};

export const GAME_READY_ID = 0x22 as const;

/** New game is about to start. */
export type GameReadyMessage = {
  readonly type: typeof GAME_READY_ID;
  readonly gameState: GameState;
  readonly countDown: number;
};

export const GAME_WORLD_ID = 0x23 as const;

/** Game world has changed. */
export type GameWorldMessage = {
  readonly type: typeof GAME_WORLD_ID;
  readonly elapsed: number;
  readonly playerState: ReadonlyMap<number, PlayerState>;
};

export const PLAYER_ANNOUNCE_ID = 0x11 as const;

/** Player is ready to join. */
export type PlayerAnnounceMessage = {
  readonly type: typeof PLAYER_ANNOUNCE_ID;
  readonly signature: number;
};

export const PLAYER_PROGRESS_ID = 0x21 as const;

/** Player updates game world. */
export type PlayerProgressMessage = {
  readonly type: typeof PLAYER_PROGRESS_ID;
  readonly elapsed: number;
  readonly codePoint: number;
};

export const CHAT_POST_ID = 0x31 as const;

/** Somebody said something, and the room is allowed to see it. */
export type ChatPostMessage = {
  readonly type: typeof CHAT_POST_ID;
  readonly playerId: number;
  readonly text: string;
  /**
   * Half-open [start, end) ranges of `text` to draw blurred.
   *
   * The server decides; the client only draws. A client asked to censor itself
   * is a client that can be asked not to.
   */
  readonly blurred: readonly (readonly [number, number])[];
};

export const CHAT_NOTICE_ID = 0x32 as const;

/**
 * Something the room needs to know that nobody said: a warning, a mute, a
 * removal. Sent only to the player it concerns.
 */
export type ChatNoticeMessage = {
  readonly type: typeof CHAT_NOTICE_ID;
  /** `warn` | `mute` | `blocked` | `slowdown` */
  readonly kind: string;
  /** When a mute or block lifts, as a wall-clock stamp; 0 when not timed. */
  readonly untilMs: number;
};

export const CHAT_SAY_ID = 0x31 as const;

/** A player wants to say something. Nothing is trusted until the server reads it. */
export type ChatSayMessage = {
  readonly type: typeof CHAT_SAY_ID;
  readonly text: string;
};
