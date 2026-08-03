import { Writer } from "@keylearn/binary";
import { type Result } from "@keylearn/result";
import { HEADER, writeResult } from "@keylearn/result-io";
import { rename } from "@sosimple/fsx";
import { type File } from "@sosimple/fsx-file";

export async function fixFile(file: File, results: readonly Result[]) {
  await renameOldFile(file);
  if (results.length > 0) {
    await writeNewFile(file, results);
  }
}

async function renameOldFile(file: File) {
  const { name } = file;
  try {
    await rename(name, name + "~corrupted");
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function writeNewFile(file: File, results: readonly Result[]) {
  const writer = new Writer();
  writer.putBuffer(HEADER);
  for (const result of results) {
    writeResult(writer, result);
  }
  await file.write(writer.buffer());
}
