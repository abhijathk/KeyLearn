import { connect, type Socket } from "node:net";

/**
 * Scanning what customers attach, before any of it is kept.
 *
 * Everything else on the attachment path is a guess about intent: the
 * MIME allow-list believes the header the uploader sent, and the size
 * limit only says a payload is small enough to be worth storing. Neither
 * looks at the bytes. This does, by handing them to clamd — the ClamAV
 * daemon — over its INSTREAM protocol:
 *
 *   > zINSTREAM\0
 *   > <uint32 length><chunk>     repeated, in order
 *   > <uint32 0>                 nothing more is coming
 *   < stream: OK\0
 *   < stream: Eicar-Test-Signature FOUND\0
 *
 * Spoken directly rather than through a client library. It is a length
 * prefix and a sentinel, and a package sitting in front of every file
 * entering the system is one more thing to keep patched for no gain.
 *
 * ClamAV is free and runs locally, which is what makes this affordable on
 * every upload: the bytes never leave the host, so there is no per-file
 * cost, no third party reading customer screenshots, and no round trip to
 * somebody else's availability.
 */

/**
 * Three outcomes, and the caller has to face all of them.
 *
 * "Could not scan" is an exception rather than a third member of this
 * union on purpose — a union invites a default branch, and the default
 * branch someone writes in a hurry is the one that lets the file through.
 */
export type ScanVerdict =
  | { readonly clean: true }
  | { readonly clean: false; readonly threat: string };

/** The scanner could not answer. Never the same thing as a clean file. */
export class ScannerDown extends Error {
  constructor(why: string) {
    super(`The virus scanner could not be reached: ${why}`);
    this.name = "ScannerDown";
  }
}

export type ScannerAddress = {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
};

/** Where clamd is, or null if nobody has said. */
export function scannerAddress(): ScannerAddress | null {
  const host = process.env["CLAMAV_HOST"] ?? "";
  if (host === "") {
    return null;
  }
  return {
    host,
    port: Number(process.env["CLAMAV_PORT"] ?? 3310),
    timeoutMs: Number(process.env["CLAMAV_TIMEOUT_MS"] ?? 20_000),
  };
}

/**
 * Whether an unscanned file may be stored.
 *
 * Required by default, and a missing CLAMAV_HOST refuses uploads instead
 * of accepting them unchecked. The alternative fails open, which means
 * the protection disappears silently on the day a hostname is mistyped —
 * and it disappears into exactly the outcome it was built to prevent.
 *
 * ATTACHMENT_SCAN=off exists so a developer with no clamd on their laptop
 * can still attach a file. It has to be typed out, which is the point.
 */
export function scanningRequired(): boolean {
  return (process.env["ATTACHMENT_SCAN"] ?? "required").toLowerCase() !== "off";
}

/** clamd's own default StreamMaxLength is 25 MB; our uploads cap at 10. */
const CHUNK_BYTES = 64 * 1024;

export function scanBuffer(
  data: Buffer,
  where: ScannerAddress,
): Promise<ScanVerdict> {
  return new Promise<ScanVerdict>((resolve, reject) => {
    const reply: Buffer[] = [];
    let socket: Socket;
    let settled = false;

    // Every path below ends here, and only the first one counts: an
    // "error" after a verdict, or a "close" following an "end", must not
    // reject a promise that already resolved.
    const finish = (act: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      act();
    };

    try {
      socket = connect({ host: where.host, port: where.port });
    } catch (err) {
      reject(new ScannerDown(err instanceof Error ? err.message : String(err)));
      return;
    }

    socket.setTimeout(where.timeoutMs);
    socket.on("timeout", () => {
      finish(() => {
        reject(new ScannerDown(`no verdict within ${where.timeoutMs} ms`));
      });
    });
    socket.on("error", (err) => {
      finish(() => {
        reject(new ScannerDown(err.message));
      });
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let at = 0; at < data.length; at += CHUNK_BYTES) {
        const part = data.subarray(at, at + CHUNK_BYTES);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(part.length, 0);
        socket.write(length);
        socket.write(part);
      }
      // The zero-length chunk is the whole end-of-file signal. Omit it
      // and clamd waits for a chunk that never comes, so a perfectly
      // healthy scan reads as an outage twenty seconds later.
      socket.write(Buffer.from([0, 0, 0, 0]));
    });

    socket.on("data", (part: Buffer) => {
      reply.push(part);
    });

    const readVerdict = (): void => {
      finish(() => {
        const said = Buffer.concat(reply)
          .toString("utf8")
          .replace(/\0+$/, "")
          .trim();
        if (said === "") {
          reject(new ScannerDown("clamd hung up without answering"));
          return;
        }
        if (said.endsWith("OK")) {
          resolve({ clean: true });
          return;
        }
        const found = /^stream:\s*(.+?)\s+FOUND$/i.exec(said);
        if (found != null) {
          resolve({ clean: false, threat: found[1]! });
          return;
        }
        // "INSTREAM size limit exceeded. ERROR", an unknown command, a
        // future reply this code has never seen. An answer we cannot read
        // is not an answer that the file is safe.
        reject(new ScannerDown(said));
      });
    };

    socket.on("end", readVerdict);
    socket.on("close", readVerdict);
  });
}

/** Scans against the configured daemon, or says why it could not. */
export async function scanUpload(data: Buffer): Promise<ScanVerdict> {
  const where = scannerAddress();
  if (where == null) {
    throw new ScannerDown("no CLAMAV_HOST is configured");
  }
  return await scanBuffer(data, where);
}
