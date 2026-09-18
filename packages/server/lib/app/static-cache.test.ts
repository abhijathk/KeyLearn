import { mkdir, readdir, utimes, writeFile } from "node:fs/promises";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { Application, type Context } from "@fastr/core";
import { Container } from "@fastr/invert";
import { compress } from "@fastr/middleware-compress";
import { conditional } from "@fastr/middleware-conditional";
import { staticFiles } from "@fastr/middleware-static-files";
import { removeDir } from "@sosimple/fsx";
import { equal, isNotNull, isTrue } from "rich-assert";
import { StaticCache } from "./static-cache.ts";

/**
 * Over real HTTP, on purpose: the bug this middleware exists for was two
 * middlewares each behaving correctly in isolation and cancelling out in the
 * chain, and the only assertion that would have caught it is on the bytes
 * that actually left the socket. Node's own `http` rather than the fastr
 * test client because that client decodes `Content-Encoding` for you, which
 * is precisely what must not be hidden here.
 */

const root = join(tmpdir(), `keylearn-static-cache-${process.pid}`);
const publicDir = join(root, "public");
const cacheDir = join(root, "cache");
const assets = join(publicDir, "kids-assets", "models");

/**
 * Compressible, and unlike anything a compressor has a dictionary for: a
 * glTF-shaped JSON header, which is what the real files' first 200 KB is.
 */
const model = (seed: string, accessors = 400): Buffer => {
  const list = [];
  for (let i = 0; i < accessors; i++) {
    list.push({ bufferView: i, componentType: 5126, count: 1000 + i, seed });
  }
  return Buffer.from(JSON.stringify({ asset: { version: "2.0" }, list }));
};

/** Block-compressed already, so incompressible — what a KTX2 is. */
const texture = (): Buffer => {
  const buf = Buffer.alloc(4096);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (i * 2654435761) >>> 24;
  }
  return buf;
};

let server: Server;
let origin: string;
let cache: StaticCache;

before(async () => {
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, "Ranger.glb"), model("ranger"));
  await writeFile(join(assets, "sky.ktx2"), texture());
  await writeFile(join(assets, "tiny.glb"), Buffer.from("{}"));
  cache = new StaticCache(publicDir, cacheDir);
  // The production chain around it, including the compress() whose
  // `Vary: Content-Encoding` lands on every response, and a route past the
  // static handlers that varies on something of its own.
  const app = new Application(new Container())
    .use(conditional())
    .use(compress())
    .use(cache.middleware())
    .use(staticFiles(publicDir))
    .use(async (ctx: Context) => {
      ctx.response.headers.append("Vary", "Cookie");
      ctx.response.type = "text/plain";
      ctx.response.body = "page";
    });
  server = createServer(app.callback());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  origin = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await removeDir(root);
});

type Reply = {
  status: number;
  headers: Record<string, string | undefined>;
  body: Buffer;
};

const get = (
  path: string,
  headers: Record<string, string> = {},
): Promise<Reply> =>
  new Promise((resolve, reject) => {
    request(origin + path, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode!,
          headers: res.headers as Record<string, string | undefined>,
          body: Buffer.concat(chunks),
        }),
      );
      res.on("error", reject);
    })
      .on("error", reject)
      .end();
  });

const decoded = ({ headers, body }: Reply): Buffer => {
  switch (headers["content-encoding"]) {
    case "br":
      return brotliDecompressSync(body);
    case "gzip":
      return gunzipSync(body);
    default:
      return body;
  }
};

/** The background build for one file, however far it has got. */
const settle = () => cache.warm();

test("a model goes out brotli-encoded and decodes to the exact file", async () => {
  const reply = await get("/kids-assets/models/Ranger.glb", {
    "accept-encoding": "gzip, deflate, br",
  });
  equal(reply.status, 200);
  isNotNull(reply.headers["content-encoding"]);
  isTrue(reply.headers["content-encoding"] !== "identity");
  equal(reply.headers["content-type"], "model/gltf-binary");
  // The bug: the raw file was going out with `Content-Encoding: identity`.
  isTrue(reply.body.length < model("ranger").length, "not compressed");
  isTrue(decoded(reply).equals(model("ranger")), "decoded bytes differ");
  // Vary names the REQUEST header the reply depends on. Both @fastr static
  // middlewares write `Content-Encoding` here, which is meaningless to a
  // cache.
  equal(reply.headers["vary"], "Accept-Encoding");
});

test("once built, the cached brotli variant is served with a length", async () => {
  await settle();
  const reply = await get("/kids-assets/models/Ranger.glb", {
    "accept-encoding": "gzip, deflate, br",
  });
  equal(reply.headers["content-encoding"], "br");
  isNotNull(reply.headers["content-length"], "streamed live, not cached");
  equal(Number(reply.headers["content-length"]), reply.body.length);
  isTrue(decoded(reply).equals(model("ranger")));
  // The client's preference is honoured when brotli is not on the list.
  const gz = await get("/kids-assets/models/Ranger.glb", {
    "accept-encoding": "gzip",
  });
  equal(gz.headers["content-encoding"], "gzip");
  isTrue(decoded(gz).equals(model("ranger")));
});

test("a client that sends no Accept-Encoding gets the plain file", async () => {
  // RFC 9110 lets a missing header mean "anything goes", and @fastr reads it
  // that way — which handed a plain `curl` brotli it could not unpack.
  const reply = await get("/kids-assets/models/Ranger.glb");
  equal(reply.status, 200);
  equal(reply.headers["content-encoding"], "identity");
  isTrue(reply.body.equals(model("ranger")));
  // …and still with the corrected Vary, which is set on the way out for
  // everything under the static handlers.
  equal(reply.headers["vary"], "Accept-Encoding");
});

test("a texture is passed through untouched", async () => {
  // KTX2 measured at 98% of its size after brotli: block-compressed already.
  // Encoding it burns CPU on every request to save nothing.
  const reply = await get("/kids-assets/models/sky.ktx2", {
    "accept-encoding": "br",
  });
  equal(reply.status, 200);
  equal(reply.headers["content-encoding"], "identity");
  isTrue(reply.body.equals(texture()));
});

test("a file below the threshold is passed through", async () => {
  const reply = await get("/kids-assets/models/tiny.glb", {
    "accept-encoding": "br",
  });
  equal(reply.headers["content-encoding"], "identity");
});

test("a re-exported model is never served from the old variant", async () => {
  // The reason this is a cache and not a `.br` sibling on disk: staticFiles()
  // picks a sibling by size alone. Overwrite the file in place — same name,
  // and force a DIFFERENT mtime so the check is on the key, not on luck.
  await settle();
  const path = join(assets, "Ranger.glb");
  const fresh = model("ranger-v2", 420);
  await writeFile(path, fresh);
  const later = new Date(Date.now() + 5000);
  await utimes(path, later, later);
  const reply = await get("/kids-assets/models/Ranger.glb", {
    "accept-encoding": "br",
  });
  equal(reply.status, 200);
  isTrue(decoded(reply).equals(fresh), "served the stale variant");
  // The ETag moved with the file, so a browser holding the old one refetches.
  const again = await get("/kids-assets/models/Ranger.glb", {
    "accept-encoding": "br",
    "if-none-match": reply.headers["etag"]!,
  });
  equal(again.status, 304);
});

test("warm() builds every variant in scope and prunes the leftovers", async () => {
  await settle();
  const before = await readdir(cacheDir);
  // Two encodings for each of the two compressible files large enough —
  // and nothing for the texture or the tiny one.
  const entries = before.filter((name) => !name.endsWith(".tmp"));
  equal(entries.filter((n) => n.endsWith(".br")).length, 1);
  equal(entries.filter((n) => n.endsWith(".gz")).length, 1);
  // Change the file again: the old entries are orphans now.
  const path = join(assets, "Ranger.glb");
  await writeFile(path, model("ranger-v3", 430));
  const later = new Date(Date.now() + 10000);
  await utimes(path, later, later);
  const summary = await cache.warm();
  equal(summary.files, 1);
  equal(summary.built, 1);
  equal(summary.pruned, 2);
  const afterNames = await readdir(cacheDir);
  equal(afterNames.filter((n) => !n.endsWith(".tmp")).length, 2);
});

test("a path that climbs out of the tree is not served", async () => {
  // Beside the public directory, not inside it. @fastr resolves `..` before
  // the middleware sees the path, so the only escape that can reach the
  // filesystem is one that survives normalisation — and this asserts that
  // whatever does, nothing under the cache's own handling opens it.
  await writeFile(join(root, "secret.glb"), model("secret"));
  const reply = await get(
    "/kids-assets/models/%2e%2e/%2e%2e/%2e%2e/secret.glb",
    { "accept-encoding": "br" },
  );
  isTrue(
    reply.status >= 400 || !decoded(reply).equals(model("secret")),
    "served the file beside the public directory",
  );
});

test("a route's own Vary survives the correction", async () => {
  // The page controller appends `Cookie`; a wholesale replacement of the
  // header would have silently dropped it.
  const reply = await get("/some/page", { "accept-encoding": "br" });
  equal(reply.status, 200);
  equal(reply.headers["vary"], "Cookie, Accept-Encoding");
});

test("outside /kids-assets/ nothing changes", async () => {
  await mkdir(join(publicDir, "other"), { recursive: true });
  await writeFile(join(publicDir, "other", "big.glb"), model("other"));
  const reply = await get("/other/big.glb", { "accept-encoding": "br" });
  equal(reply.status, 200);
  equal(reply.headers["content-encoding"], "identity");
});
