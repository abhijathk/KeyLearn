import { Reader, unscramble, Writer } from "@keylearn/binary";
import { type Codec } from "./codec.ts";
import { writeUser } from "./codec.user.ts";
import { MessageError } from "./errors.ts";
import {
  CHAT_NOTICE_ID,
  CHAT_POST_ID,
  CHAT_SAY_ID,
  type ChatNoticeMessage,
  type ChatPostMessage,
  type ChatSayMessage,
  type ClientMessage,
  GAME_CONFIG_ID,
  GAME_READY_ID,
  GAME_WORLD_ID,
  type GameConfigMessage,
  type GameReadyMessage,
  type GameWorldMessage,
  PLAYER_ANNOUNCE_ID,
  PLAYER_JOIN_ID,
  PLAYER_LEAVE_ID,
  PLAYER_PROGRESS_ID,
  type PlayerAnnounceMessage,
  type PlayerJoinMessage,
  type PlayerLeaveMessage,
  type PlayerProgressMessage,
  type ServerMessage,
} from "./messages.ts";

export class ServerCodec implements Codec<ClientMessage, ServerMessage> {
  decode(data: Uint8Array): ClientMessage {
    const reader = new Reader(unscramble(data));
    const type = reader.getUint8();
    switch (type) {
      case PLAYER_ANNOUNCE_ID:
        return readPlayerAnnounce(reader);
      case PLAYER_PROGRESS_ID:
        return readPlayerProgress(reader);
      case CHAT_SAY_ID:
        return readChatSay(reader);
      default:
        throw new MessageError("Unrecognized client message " + type);
    }
  }

  encode(message: ServerMessage): Uint8Array {
    switch (message.type) {
      case PLAYER_JOIN_ID:
        return writePlayerJoin(message);
      case PLAYER_LEAVE_ID:
        return writePlayerLeave(message);
      case GAME_CONFIG_ID:
        return writeGameConfig(message);
      case GAME_READY_ID:
        return writeGameReady(message);
      case GAME_WORLD_ID:
        return writeGameWorld(message);
      case CHAT_POST_ID:
        return writeChatPost(message);
      case CHAT_NOTICE_ID:
        return writeChatNotice(message);
    }
  }
}

function readPlayerAnnounce(reader: Reader): PlayerAnnounceMessage {
  const signature = reader.getUint32();
  return { type: PLAYER_ANNOUNCE_ID, signature };
}

function readPlayerProgress(reader: Reader): PlayerProgressMessage {
  const elapsed = reader.getUint32();
  const codePoint = reader.getUint32();
  return { type: PLAYER_PROGRESS_ID, elapsed, codePoint };
}

function writePlayerJoin(message: PlayerJoinMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(PLAYER_JOIN_ID);
  writer.putUint32(message.joinedId);
  const players = message.players;
  writer.putUint8(players.length);
  for (const player of players) {
    writer.putUint32(player.id);
    writeUser(player.user, writer);
  }
  return writer.buffer();
}

function writePlayerLeave(message: PlayerLeaveMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(PLAYER_LEAVE_ID);
  writer.putUint32(message.leftId);
  const players = message.players;
  writer.putUint8(players.length);
  for (const player of players) {
    writer.putUint32(player.id);
    writeUser(player.user, writer);
  }
  return writer.buffer();
}

function writeGameConfig(message: GameConfigMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(GAME_CONFIG_ID);
  writer.putString(message.text);
  return writer.buffer();
}

function writeGameReady(message: GameReadyMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(GAME_READY_ID);
  writer.putUint8(message.gameState);
  writer.putUint8(message.countDown);
  return writer.buffer();
}

function writeGameWorld(message: GameWorldMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(GAME_WORLD_ID);
  writer.putUint32(message.elapsed);
  const players = [...message.playerState];
  writer.putUint8(players.length);
  for (const [id, player] of players) {
    writer.putUint32(id);
    writer.putUint8((player.spectator ? 1 : 0) | (player.finished ? 2 : 0));
    writer.putUint8(player.position);
    writer.putUint16(player.offset);
    writer.putUint16(player.speed);
    writer.putUint16(player.errors);
  }
  return writer.buffer();
}

function readChatSay(reader: Reader): ChatSayMessage {
  return { type: CHAT_SAY_ID, text: reader.getString() };
}

function writeChatPost(message: ChatPostMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(CHAT_POST_ID);
  writer.putUint32(message.playerId);
  writer.putString(message.text);
  // A message is capped well below 255 characters, so it can never carry more
  // spans than a byte can count.
  writer.putUint8(message.blurred.length);
  for (const [start, end] of message.blurred) {
    writer.putUint16(start);
    writer.putUint16(end);
  }
  return writer.buffer();
}

function writeChatNotice(message: ChatNoticeMessage): Uint8Array {
  const writer = new Writer();
  writer.putUint8(CHAT_NOTICE_ID);
  writer.putString(message.kind);
  writer.putUint32(Math.round(message.untilMs / 1000));
  return writer.buffer();
}
