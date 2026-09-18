import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { constants, createBrotliCompress, createGzip } from "node:zlib";
import { type Context, type Middleware, type Next } from "@fastr/core";
import { type CacheControl } from "@fastr/headers";
import { Logger } from "@keylearn/logger";

/**
 * Compressed variants of the large static files, built once and served from
 * disk — the kids world's 3D models above all.
 *
 * Why this exists at all: the village downloads about 11.5 MB from
 * `/kids-assets/` on a cold load, and every byte of it was going out raw.
 * Not because nobody asked for compression — `compress()` sits in the chain
 * ahead of `staticFiles()` — but because `staticFiles()` stamps
 * `Content-Encoding: identity` on everything it serves and `compress()` reads
 * an existing `Content-Encoding` header as "someone already did this". The
 * two middlewares cancel each other out for every static file, and nothing
 * under `/kids-assets/` has the precompressed `.gz`/`.br` siblings that
 * webpack writes for `/assets/`, so there was nothing on disk to fall back
 * to either.
 *
 * Measured on the assets themselves (16 Sep 2026, brotli quality 11 unless
 * stated): a rigged hero GLB is 1,200-odd accessors of JSON around its
 * meshopt streams and shrinks to ~40% (Ranger 320 → 130 KB); the tree packs
 * to 43–75% (MegaDead 1,363 → 591 KB); the Basis transcoder wasm to 39%
 * (515 → 199 KB); the HDR sky maps to 56–72%. The villagers with baked
 * textures inside the GLB only reach 73–91%, because the bulk of those files
 * is already-compressed JPEG. KTX2 textures stop at 98% — they are
 * block-compressed already — and so are deliberately NOT in the list below:
 * compressing them costs CPU on every request and saves nothing.
 *
 * Why a cache rather than on-the-fly compression: brotli at quality 11 takes
 * 1–13 SECONDS per model on this machine. That is fine done once and
 * unthinkable per request. gzip at level 6 is 5–130 ms and is what a cache
 * miss falls back to, so no request ever waits for the slow encoder and
 * nothing is ever sent raw once this middleware has seen it.
 *
 * Why a cache rather than precompressed siblings on disk: `staticFiles()`
 * picks a `.br` sibling by size alone and never checks its date. A model
 * re-exported over a stale sibling would keep serving the OLD model to every
 * browser that accepts brotli — which is all of them — while `curl` and the
 * developer looking at the file saw the new one. The models are re-exported
 * often. Every entry here is keyed on the source file's path, size and
 * mtime, so a changed file simply misses and is rebuilt; it cannot be served
 * stale.
 */

/**
 * Extensions worth compressing, by measurement (see above). Anything not
 * listed falls through to `staticFiles()` untouched — that is where the
 * KTX2, PNG and JPEG textures go.
 */
const COMPRESSIBLE: ReadonlyMap<string, string> = new Map([
  ["glb", "model/gltf-binary"],
  ["gltf", "model/gltf+json"],
  ["bin", "application/octet-stream"],
  // No registered type staticFiles() knows of; this is what it sends.
  ["hdr", "application/octet-stream"],
  ["wasm", "application/wasm"],
  ["js", "text/javascript"],
  ["mjs", "text/javascript"],
  ["json", "application/json"],
  ["css", "text/css"],
  ["svg", "image/svg+xml"],
]);

/**
 * ALREADY COMPRESSED, AND STILL WORTH SERVING FROM HERE.
 *
 * Brotli on a JPEG or a KTX2 texture costs CPU and saves nothing — which is
 * why these are absent from `COMPRESSIBLE` and left to `staticFiles()`.
 *
 * But `staticFiles()` knows nothing about the version segment, so once URLs
 * carry one these thirty-odd files (3.6 MB, the picker's faces among them)
 * would 404 on the very URLs the manifest hands out. Serving them here,
 * unencoded, keeps one place that understands what a versioned URL means.
 */
const AS_IS: ReadonlyMap<string, string> = new Map([
  ["webp", "image/webp"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["ktx2", "image/ktx2"],
]);

/**
 * Only this subtree. `/assets/` is webpack's output and arrives with `.gz`
 * and `.br` siblings in production, which `staticFiles()` already serves; in
 * development it is rebuilt on every save, and caching a variant per rebuild
 * would grow the cache without bound.
 */
const SCOPE = "/kids-assets/";

/** Below this, the headers outweigh the saving. Same figure `compress()` uses. */
const MIN_SIZE = 1024;

type Encoding = {
  readonly id: "br" | "gzip";
  readonly ext: string;
  /** The slow, thorough encoder for the cache. */
  readonly cached: () => Transform;
  /** The fast encoder for a miss, when the reply cannot wait. */
  readonly live: () => Transform;
};

const brotli = (quality: number, size: number) =>
  createBrotliCompress({
    params: {
      [constants.BROTLI_PARAM_QUALITY]: quality,
      [constants.BROTLI_PARAM_SIZE_HINT]: size,
    },
  });

const encodingsFor = (size: number): readonly Encoding[] => [
  {
    id: "br",
    ext: ".br",
    cached: () => brotli(11, size),
    // Quality 4 lands near gzip-6 in both speed and ratio; the point of the
    // live path is not to block, not to be small.
    live: () => brotli(4, size),
  },
  {
    id: "gzip",
    ext: ".gz",
    cached: () => createGzip({ level: 9 }),
    live: () => createGzip({ level: 6 }),
  },
];

/** Preference order when the client accepts both. */
const ENCODING_IDS = ["br", "gzip"] as const;

export type StaticCacheOptions = {
  readonly cacheControl?: ((path: string) => CacheControl | null) | null;
};

export class StaticCache {
  /** Builds in flight in THIS process, so a burst of misses builds once. */
  readonly #building = new Map<string, Promise<void>>();
  /**
   * Builds run one at a time. Brotli-11 on a 1.8 MB model is twelve seconds
   * of a zlib thread; four workers each running four of those on a cold start
   * is a server that answers nothing else. The queue keeps it to one.
   */
  #queue: Promise<void> = Promise.resolve();

  constructor(
    readonly publicDir: string,
    readonly cacheDir: string,
  ) {}

  /**
   * The cache entry's stem for a source file: changes whenever the file does.
   * The path is part of it so two identical files do not share an entry that
   * one of them can then invalidate for the other.
   */
  keyOf(relPath: string, stats: { size: number; mtimeMs: number }): string {
    const hash = createHash("sha1");
    hash.update(relPath);
    hash.update("\0");
    hash.update(String(stats.size));
    hash.update("\0");
    hash.update(String(Math.floor(stats.mtimeMs)));
    return hash.digest("hex").slice(0, 32);
  }

  /**
   * A versioned file that is already compressed: straight off disk, with the
   * headers its URL has earned. No encoder, no cache entry, no variant — the
   * only thing this adds over `staticFiles()` is understanding the segment.
   */
  async #sendAsIs(
    ctx: Context,
    path: string,
    type: string,
    cacheControl: StaticCacheOptions["cacheControl"],
  ): Promise<boolean> {
    let relPath: string;
    try {
      relPath = unversion(safeRelative(path));
    } catch {
      return false;
    }
    const source = join(this.publicDir, relPath);
    const stats = await tryStat(source);
    if (stats == null) {
      return false; // Let staticFiles() produce the 404.
    }
    ctx.response.status = 200;
    ctx.response.type = type;
    ctx.response.length = stats.size;
    // Size and mtime, the same entity the file itself has — there is no
    // encoding to distinguish here, so no suffix either.
    ctx.response.etag = `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;
    const cacheHeader = cacheControl?.(path) ?? null;
    if (cacheHeader != null) {
      ctx.response.headers.set("Cache-Control", cacheHeader);
    }
    ctx.response.body = createReadStream(source);
    return true;
  }

  /** The middleware. Place it BEFORE `staticFiles()`, which is its fallback. */
  middleware({ cacheControl = null }: StaticCacheOptions = {}): Middleware {
    return async (ctx: Context, next: Next): Promise<void> => {
      if (!(await this.#serve(ctx, cacheControl))) {
        await next();
      }
      // Both @fastr static middlewares write `Vary: Content-Encoding`, and so
      // does compress() upstream, on every response — which names the wrong
      // header: Vary lists REQUEST headers the response depends on, and this
      // response depends on `Accept-Encoding`. A shared cache that honours
      // Vary literally would hand a brotli body to a client that never asked
      // for one. Fixed here for everything that passes through, not only the
      // files this middleware serves itself — token by token, because the
      // page controller appends `Cookie` to the same header and a wholesale
      // replacement would have thrown that away.
      fixVary(ctx);
    };
  }

  async #serve(
    ctx: Context,
    cacheControl: StaticCacheOptions["cacheControl"],
  ): Promise<boolean> {
    const { method, path } = ctx.request;
    // HEAD is left to staticFiles(): it answers with the raw file's headers,
    // which is accurate and costs no encoder.
    if (method !== "GET" || !path.startsWith(SCOPE)) {
      return false;
    }
    /*
     * A VERSIONED URL IS OURS, WHATEVER ELSE IS TRUE.
     *
     * Nothing downstream can find the file behind that segment, so every
     * path out of this method that would have handed the request on has to
     * serve it here instead. Getting this wrong is not a slow reply, it is a
     * 404 on a file that exists.
     *
     * It was wrong once already: the early return below for a request with
     * no `Accept-Encoding` sent such a URL to `staticFiles()`, which 404'd
     * it. Every browser sends that header — but the rule this breaks is that
     * nothing in the versioning may be a way for the game not to start, and
     * a client that does not send it is exactly the client least able to
     * cope with a mystery 404.
     */
    const owned = VERSIONED.test(path);
    const ext = extname(path).slice(1).toLowerCase();
    const type = COMPRESSIBLE.get(ext);
    if (type == null) {
      // Already compressed, or a type this does not know. Octet-stream is
      // what `staticFiles()` sends for the unknown ones too.
      return owned
        ? await this.#sendAsIs(
            ctx,
            path,
            AS_IS.get(ext) ?? "application/octet-stream",
            cacheControl,
          )
        : false;
    }
    // Only when the client SAYS it can decode. RFC 9110 lets a server read a
    // missing Accept-Encoding as "anything goes", and @fastr does — which is
    // how a plain `curl` of a model came back as brotli it could not unpack.
    // Every browser sends the header; a client that does not gets the file.
    if (ctx.request.headers.get("accept-encoding") == null) {
      return owned
        ? await this.#sendAsIs(ctx, path, type, cacheControl)
        : false;
    }
    // Our preference among what the client takes, not the client's own order:
    // Chrome lists gzip before br, and negotiateEncoding() would follow it
    // to the larger file.
    const accepted = ENCODING_IDS.find((id) => ctx.request.acceptsEncoding(id));
    if (accepted == null) {
      return owned
        ? await this.#sendAsIs(ctx, path, type, cacheControl)
        : false;
    }
    let relPath: string;
    try {
      relPath = unversion(safeRelative(path));
    } catch {
      return false; // Let staticFiles() raise its own 400.
    }
    const source = join(this.publicDir, relPath);
    const stats = await tryStat(source);
    if (stats == null || stats.size < MIN_SIZE) {
      // Too small to be worth encoding — but still behind a segment only
      // this class understands. A missing file falls through either way, so
      // `staticFiles()` keeps producing the 404s that are real.
      return owned && stats != null
        ? await this.#sendAsIs(ctx, path, type, cacheControl)
        : false;
    }
    const key = this.keyOf(relPath, stats);
    const encodings = encodingsFor(stats.size);

    // A finished variant in the client's preferred encoding, else any
    // finished variant it accepts. A cached gzip beats a live brotli: it is
    // smaller (level 9 vs quality 4) and costs nothing to send.
    for (const encoding of encodings) {
      if (!ctx.request.acceptsEncoding(encoding.id)) {
        continue;
      }
      const variant = join(this.cacheDir, key + encoding.ext);
      const variantStats = await tryStat(variant);
      if (variantStats != null) {
        send(ctx, path, encoding.id, key, cacheControl, type);
        ctx.response.length = variantStats.size;
        ctx.response.body = createReadStream(variant);
        return true;
      }
    }

    // Nothing cached yet: encode this reply on the fly with the fast encoder
    // and start the real build behind it. The next request finds it.
    void this.#build(relPath, source, stats.size, key);
    const encoding = encodings.find(({ id }) => id === accepted)!;
    send(ctx, path, encoding.id, key, cacheControl, type);
    const transform = encoding.live();
    // Errors on the file stream surface on the transform, which is what the
    // response is holding; without this a vanished file hangs the reply.
    createReadStream(source)
      .on("error", (err) => transform.destroy(err))
      .pipe(transform);
    ctx.response.body = transform;
    return true;
  }

  /**
   * Writes every variant for one file, once per process at a time. Entries
   * are written to a temporary name and renamed into place, so a reader can
   * only ever see a complete file — including a reader in another worker
   * that is racing this one to build the same entry; the last rename wins
   * with identical bytes.
   */
  #build(
    relPath: string,
    source: string,
    size: number,
    key: string,
  ): Promise<void> {
    let pending = this.#building.get(key);
    if (pending == null) {
      pending = (this.#queue = this.#queue.then(() =>
        this.#write(relPath, source, size, key),
      )).finally(() => {
        this.#building.delete(key);
      });
      this.#building.set(key, pending);
    }
    return pending;
  }

  async #write(
    relPath: string,
    source: string,
    size: number,
    key: string,
  ): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      for (const encoding of encodingsFor(size)) {
        const target = join(this.cacheDir, key + encoding.ext);
        if ((await tryStat(target)) != null) {
          continue; // Another process got there first.
        }
        const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
        try {
          await pipeline(
            createReadStream(source),
            encoding.cached(),
            createWriteStream(temp),
          );
          await rename(temp, target);
        } catch (err) {
          await unlink(temp).catch(() => {});
          throw err;
        }
      }
    } catch (err) {
      // A failed build is a served-with-gzip-on-the-fly file, not an outage.
      Logger.warn(err as Error, "Could not cache a compressed variant", {
        path: relPath,
      });
    }
  }

  /**
   * Builds the variant of every file in scope that has none yet, then drops
   * the entries no current file maps to — the leftovers of re-exported
   * models. Meant for the cluster's primary process, once per deployment,
   * so that the first learner after a deploy is not the one who pays for the
   * slow encoder, and so that four workers do not do it four times.
   *
   * Runs in the background: it is minutes of encoder time for the full tree
   * and nothing waits on it. A worker that gets a request for a file this
   * has not reached yet serves it live and builds it itself; the two builds
   * cannot produce different bytes.
   */
  async warm(): Promise<{ files: number; built: number; pruned: number }> {
    const root = join(this.publicDir, SCOPE.slice(1, -1));
    const live = new Set<string>();
    let files = 0;
    let built = 0;
    for (const source of await walk(root)) {
      const ext = extname(source).slice(1).toLowerCase();
      if (!COMPRESSIBLE.has(ext)) {
        continue;
      }
      const stats = await tryStat(source);
      if (stats == null || stats.size < MIN_SIZE) {
        continue;
      }
      files += 1;
      const relPath = relative(this.publicDir, source);
      const key = this.keyOf(relPath, stats);
      live.add(key);
      const missing = await Promise.all(
        encodingsFor(stats.size).map(
          async ({ ext }) =>
            (await tryStat(join(this.cacheDir, key + ext))) == null,
        ),
      );
      if (missing.some(Boolean)) {
        await this.#build(relPath, source, stats.size, key);
        built += 1;
      }
    }
    let pruned = 0;
    for (const name of await tryReaddir(this.cacheDir)) {
      const stem = name.split(".")[0];
      // Temp files belong to a build in progress somewhere; leave them.
      if (name.endsWith(".tmp") || live.has(stem)) {
        continue;
      }
      await unlink(join(this.cacheDir, name)).catch(() => {});
      pruned += 1;
    }
    return { files, built, pruned };
  }
}

/** `Vary: Content-Encoding, Cookie, Content-Encoding` → `Cookie, Accept-Encoding`. */
function fixVary(ctx: Context): void {
  const vary = ctx.response.headers.get("Vary");
  if (vary == null || !/content-encoding/i.test(vary)) {
    return;
  }
  const kept: string[] = [];
  for (const token of vary.split(",")) {
    const name = token.trim();
    if (
      name !== "" &&
      name.toLowerCase() !== "content-encoding" &&
      !kept.some((k) => k.toLowerCase() === name.toLowerCase())
    ) {
      kept.push(name);
    }
  }
  if (!kept.some((k) => k.toLowerCase() === "accept-encoding")) {
    kept.push("Accept-Encoding");
  }
  ctx.response.headers.set("Vary", kept.join(", "));
}

function send(
  ctx: Context,
  path: string,
  encodingId: string,
  key: string,
  cacheControl: StaticCacheOptions["cacheControl"],
  type: string,
): void {
  ctx.response.status = 200;
  ctx.response.type = type;
  ctx.response.headers.set("Content-Encoding", encodingId);
  ctx.response.headers.set("Vary", "Accept-Encoding");
  // The key already changes with the file, so it IS the entity tag; the
  // encoding suffix is the same convention `compress()` and `staticFiles()`
  // follow, so a browser's If-None-Match from either era still compares.
  ctx.response.etag = `"${key.slice(0, 20)}-${encodingId}"`;
  const cacheHeader = cacheControl?.(path) ?? null;
  if (cacheHeader != null) {
    ctx.response.headers.set("Cache-Control", cacheHeader);
  }
}

/**
 * Takes the content hash back out of a versioned URL.
 *
 * `kids-assets/v1a2b3c4d/models/x.glb` is the same file as
 * `kids-assets/models/x.glb`; the segment exists only so the URL changes when
 * the bytes do, which is what lets the reply be marked `immutable` — see
 * `kids-manifest.mjs` for why, and `cachecontrol.ts` for the header it earns.
 *
 * ONE FILE, MANY URLS. The alternative is writing hashed copies into the
 * public tree at build time, which doubles forty megabytes on disk and leaves
 * two things that have to be kept in step. Stripping a segment costs a regex.
 *
 * Deliberately narrow: `v` and exactly eight lowercase hex. Anything else is
 * left alone, so a real directory that happens to start with a v is safe.
 */
/** `/kids-assets/v1a2b3c4d/…` — the same shape `cachecontrol.ts` trusts. */
const VERSIONED = /^\/kids-assets\/v[0-9a-f]{8}\//;

function unversion(relPath: string): string {
  return relPath.replace(/^(kids-assets\/)v[0-9a-f]{8}\//, "$1");
}

/**
 * The URL path as a path under the public directory, refusing anything that
 * could climb out of it. Mirrors the checks in `staticFiles()`; the encoded
 * form of a dot or slash is the classic way past a naive prefix test.
 */
function safeRelative(path: string): string {
  if (path.includes("%2F") || path.includes("%2f")) {
    throw new Error("encoded slash");
  }
  const decoded = decodeURIComponent(path);
  if (
    decoded.includes("/../") ||
    decoded.startsWith("../") ||
    decoded.endsWith("/..") ||
    decoded.includes("\0")
  ) {
    throw new Error("relative segment");
  }
  return decoded.slice(1);
}

async function tryStat(path: string) {
  try {
    const stats = await stat(path);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

async function tryReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}
