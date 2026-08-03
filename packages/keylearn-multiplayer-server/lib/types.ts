import {
  type ClientMessage,
  type ServerMessage,
} from "@keylearn/multiplayer-shared";
import { type AnyUser } from "@keylearn/pages-shared";

export type Session = {
  readonly id: string;
  readonly user: AnyUser;
  ping(data?: any, mask?: boolean): void;
  pong(data?: any, mask?: boolean): void;
  send(message: ServerMessage): void;
  close(code?: number, data?: string): void;
  terminate(): void;
};

export type ClientFactory = {
  (session: Session): Client;
};

export type Client = {
  onPing(data: ArrayBuffer): void;
  onPong(data: ArrayBuffer): void;
  onMessage(message: ClientMessage): void;
  onClose(code: number, reason: string): void;
};

export type TotalStats = {
  readonly roomsCreated: number;
  readonly roomsDestroyed: number;
  readonly gamesCompleted: number;
  readonly playersJoined: number;
  readonly playersLeft: number;
  readonly roomStats: readonly RoomStats[];
};

export type RoomStats = {
  readonly gamesCompleted: number;
  readonly playersJoined: number;
  readonly playersLeft: number;
  readonly playerStats: readonly PlayerStats[];
};

export type PlayerStats = {
  readonly user: AnyUser;
  readonly gamesCompleted: number;
  readonly gamesWon: number;
};

/**
 * What the join dialog shows before a socket is opened: the room a newcomer
 * would actually be put in, and who is already in it.
 */
export type RoomPeek = {
  readonly players: readonly AnyUser[];
  readonly capacity: number;
  readonly free: number;
  readonly countDown: number;
  /** True when joining would open a new room rather than enter an existing one. */
  readonly fresh: boolean;
};
