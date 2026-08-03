import { injectable } from "@fastr/invert";
import { Tasks } from "@keylearn/lang";
import { Player } from "./player.ts";
import { Room } from "./room.ts";
import {
  type Client,
  type PlayerStats,
  type RoomPeek,
  type RoomStats,
  type Session,
  type TotalStats,
} from "./types.ts";

@injectable({ singleton: true })
export class Game {
  /**
   * Ceiling on concurrent players in this worker, and so indirectly on rooms.
   * Sized well above any plausible real load — it exists to bound an abusive
   * client, not to ration ordinary play.
   */
  static maxPlayers = Number(process.env.MULTIPLAYER_MAX_PLAYERS || 500);

  readonly #tasks = new Tasks();

  readonly rooms = new Set<Room>();

  readonly stats = {
    roomsCreated: 0,
    roomsDestroyed: 0,
    gamesCompleted: 0,
    playersJoined: 0,
    playersLeft: 0,
  };

  constructor() {}

  start() {
    this.#tasks.repeated(1000, () => this.#kickIdlePlayers());
  }

  joinPlayer(session: Session): Client | null {
    // The endpoint needs no account, so without a ceiling one client can open
    // connections until the process runs out of memory — every new player that
    // finds no room with space creates one, and every room is then walked once
    // a second by the idle sweep. Refuse instead of growing without bound.
    if (this.#playerCount >= Game.maxPlayers) {
      return null;
    }
    const player = new Player(session, this.#nextPlayerId());
    this.#joinPlayer(player);
    return player;
  }

  #joinPlayer(player: Player) {
    for (const room of this.rooms) {
      if (room.canJoin()) {
        room.join(player);
        return room;
      }
    }
    const room = new Room(this, this.#nextRoomId());
    this.rooms.add(room);
    room.join(player);
    return room;
  }

  /** Total concurrent players across all rooms. */
  get #playerCount(): number {
    let count = 0;
    for (const room of this.rooms) {
      count += room.players.size;
    }
    return count;
  }

  /**
   * What a newcomer would be walking into: the room they would be put in, who
   * is already there, and how much space is left.
   *
   * Read over plain HTTP rather than the socket, because it has to be
   * answerable BEFORE a socket exists — the whole point is to let somebody
   * decide whether to join, and under what name, while they are still outside.
   * It names only people already visible to anyone who joins, so it discloses
   * nothing the next second would not.
   */
  peek(): RoomPeek {
    for (const room of this.rooms) {
      if (room.canJoin()) {
        return {
          players: [...room.players.values()].map(({ user }) => user),
          capacity: room.capacity,
          free: room.capacity - room.players.size,
          countDown: room.countDown,
          fresh: false,
        };
      }
    }
    // Nothing with space: joining would open a new room, so say so rather than
    // showing a full one the visitor will never be put in.
    return {
      players: [],
      capacity: Room.defaultSize(),
      free: Room.defaultSize(),
      countDown: 0,
      fresh: true,
    };
  }

  collectStats(): TotalStats {
    const roomStats: RoomStats[] = [];
    for (const room of this.rooms) {
      const playerStats: PlayerStats[] = [];
      for (const player of room.players.values()) {
        playerStats.push({
          user: player.user,
          gamesCompleted: player.gamesCompleted,
          gamesWon: player.gamesWon,
        });
      }
      roomStats.push({
        gamesCompleted: room.gamesCompleted,
        playersJoined: room.playersJoined,
        playersLeft: room.playersLeft,
        playerStats,
      });
    }
    return {
      ...this.stats,
      roomStats,
    };
  }

  #kickIdlePlayers() {
    for (const room of this.rooms) {
      room.kickIdlePlayers();
    }
  }

  #roomId = 1;

  #nextRoomId() {
    return this.#roomId++;
  }

  #playerId = 1;

  #nextPlayerId() {
    return this.#playerId++;
  }
}
