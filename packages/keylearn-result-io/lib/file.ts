import { Reader, Writer } from "@keylearn/binary";
import { type Result } from "@keylearn/result";
import { readStructuredContent, writeResults } from "./binary.ts";
import { HEADER } from "./header.ts";

export function fileHeader(): Uint8Array {
  return HEADER;
}

export function fileChunk(results: Iterable<Result>): Uint8Array {
  const writer = new Writer();
  writeResults(writer, results);
  return writer.buffer();
}

export function parseFile(buffer: Uint8Array): Iterable<Result> {
  return readStructuredContent(new Reader(buffer));
}

export function formatFile(results: Iterable<Result>): Uint8Array {
  const writer = new Writer();
  writer.putBuffer(HEADER);
  writeResults(writer, results);
  return writer.buffer();
}
