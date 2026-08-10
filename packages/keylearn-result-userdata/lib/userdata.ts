import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type Context } from "@fastr/core";
import { type PublicId } from "@keylearn/publicid";
import { type Result } from "@keylearn/result";
import { fileChunk, fileHeader, parseFile } from "@keylearn/result-io";
import { type Stats } from "@sosimple/fsx";
import { File } from "@sosimple/fsx-file";

export class UserData {
  constructor(
    readonly id: PublicId,
    readonly file: File,
  ) {}

  async serve(ctx: Context): Promise<void> {
    try {
      const stats = await this.file.stat();
      const content = this.file.readStream();
      const etag = this.etag(stats);
      ctx.response.length = stats.size;
      ctx.response.body = content;
      ctx.response.etag = etag;
      ctx.state.compress = false;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        ctx.response.body = Buffer.alloc(0);
        ctx.response.etag = this.etag(null);
      } else {
        throw err;
      }
    }
    // The order of statements is important here.
    // Calling `attachment(...)` will overwrite type,
    // so `type = ...` must come last.
    ctx.response.type = "application/octet-stream";
    ctx.response.headers.set(
      "Content-Disposition",
      `attachment; filename="stats.data"`,
    );
    ctx.response.headers.set("Cache-Control", "private, no-cache");
  }

  async exists(): Promise<boolean> {
    return await this.file.exists();
  }

  async *read(): AsyncIterable<Result> {
    if (await this.exists()) {
      const buffer = await this.file.read();
      for (const result of parseFile(buffer)) {
        yield result;
      }
    }
  }

  async append(results: readonly Result[]): Promise<void> {
    if (results.length > 0) {
      await this.file.append(fileHeader(), { flag: "ax" });
      for (const chunk of partition(results)) {
        await this.file.append(fileChunk(chunk), { flag: "a" });
      }
    }
  }

  /**
   * Erase this history.
   *
   * This used to rename the file aside to `name~1` instead of removing it, so
   * every "clear my statistics" and every account deletion left a complete copy
   * of the history it claimed to have erased — and a fresh copy each time, so
   * they accumulated. The interface promises the opposite in as many words
   * ("There is no undo"), and so does the privacy policy.
   *
   * The copies left behind by that behaviour go too: someone who asked to be
   * erased before this was fixed should not stay on disk because they asked
   * early.
   */
  async delete(): Promise<void> {
    await this.file.delete();
    const dir = dirname(this.file.name);
    const base = basename(this.file.name);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return; // No directory means nothing left to erase.
    }
    for (const name of names) {
      // Only this history's own copies — `19~1` belongs to `19`, `191` does not.
      if (
        name.startsWith(`${base}~`) &&
        /^\d+$/.test(name.slice(base.length + 1))
      ) {
        await new File(join(dir, name)).delete();
      }
    }
  }

  etag(stats: Stats | null): string {
    const hash = createHash("md5");
    hash.update(String(this.id));
    if (stats != null) {
      hash.update(String(stats.size));
      hash.update(String(stats.mtime));
    } else {
      hash.update("empty");
    }
    return hash.digest("hex");
  }
}

function* partition<T>(
  results: readonly T[],
  size: number = 100,
): Iterable<T[]> {
  let offset = 0;
  while (offset < results.length) {
    yield results.slice(offset, offset + size);
    offset += size;
  }
}
