import { existsSync } from "node:fs";
import { statfs, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { ForbiddenError, ServiceUnavailableError } from "@fastr/errors";
import { type DataDir, Env } from "@keylearn/config";
import { SupportAttachment } from "@keylearn/database";
import { Logger } from "@keylearn/logger";

/**
 * Bounds on how much customer upload this deployment will hold.
 *
 * Each file was already capped at 10 MB and an unbound tray at ten files,
 * but nothing bounded the total: a signed-in script could attach 10 MB to
 * every message of every ticket it opened until the data disk filled, and
 * a full data disk takes every learner's progress down with it, not just
 * support. Three checks, cheapest first: what this ticket already holds,
 * what this account already holds, and whether the disk itself has room
 * to spare.
 */

const MB = 1024 * 1024;

export function ticketQuotaBytes(): number {
  return Env.getNumber("SUPPORT_ATTACHMENT_TICKET_MB", 50) * MB;
}

export function accountQuotaBytes(): number {
  return Env.getNumber("SUPPORT_ATTACHMENT_ACCOUNT_MB", 200) * MB;
}

/** Free space the data disk must keep AFTER the file is written. */
export function diskFloorBytes(): number {
  return Env.getNumber("SUPPORT_DISK_FREE_FLOOR_MB", 1024) * MB;
}

/** How long an upload may sit unsent before the sweep removes it. */
export function pendingUploadMaxAgeMs(): number {
  return Env.getNumber("SUPPORT_PENDING_UPLOAD_HOURS", 24) * 60 * 60 * 1000;
}

async function sumSize(
  column: "ticketId" | "userId",
  value: number,
): Promise<number> {
  const rows = (await SupportAttachment.query()
    .where(column, value)
    .sum("size as n")) as unknown as { n: number | string | null }[];
  return Number(rows[0]?.n ?? 0);
}

/** Refuses an upload that would take a ticket or an account past its quota. */
export async function assertWithinQuota({
  userId,
  ticketId,
  size,
}: {
  readonly userId: number | null;
  readonly ticketId: number | null;
  readonly size: number;
}): Promise<void> {
  if (
    ticketId != null &&
    (await sumSize("ticketId", ticketId)) + size > ticketQuotaBytes()
  ) {
    throw new ForbiddenError(
      "This conversation already holds as many files as it can. Please describe the rest in a message.",
      { expose: true },
    );
  }
  if (
    userId != null &&
    (await sumSize("userId", userId)) + size > accountQuotaBytes()
  ) {
    throw new ForbiddenError(
      "Your account has reached its limit for attached files. Please describe it in a message instead.",
      { expose: true },
    );
  }
}

/** The nearest directory that exists, for statfs. */
function existingDir(path: string): string {
  let dir = path;
  while (!existsSync(dir)) {
    const up = dirname(dir);
    if (up === dir) {
      break;
    }
    dir = up;
  }
  return dir;
}

/**
 * Whether the data disk can take `size` more bytes and still keep the floor.
 * A statfs that fails is logged and allowed: it says nothing about space,
 * and refusing every upload over a diagnostic would be its own outage.
 */
export async function assertDiskRoom(
  dataDir: DataDir,
  size: number,
): Promise<void> {
  let free: number;
  try {
    const s = await statfs(
      existingDir(dirname(dataDir.supportAttachmentFile(1))),
    );
    free = Number(s.bavail) * Number(s.bsize);
  } catch (err: any) {
    Logger.warn(err, "support-attachment: statfs failed; allowing upload");
    return;
  }
  if (free - size < diskFloorBytes()) {
    Logger.error("support-attachment: data disk below the free-space floor", {
      freeMb: Math.floor(free / MB),
      floorMb: Math.floor(diskFloorBytes() / MB),
    });
    // ASCII only — the message reaches the HTTP status line.
    throw new ServiceUnavailableError(
      "Files can't be stored right now. Please try again later. Your message is safe.",
      { expose: true },
    );
  }
}

/**
 * Removes uploads that never made it into a sent message: chosen, then the
 * tab closed or the draft abandoned. Without this every abandoned tray was
 * kept forever, and the per-account quota above would slowly fill with
 * files nobody can see.
 */
export async function sweepStaleUploads(
  dataDir: DataDir,
  now: number = Date.now(),
): Promise<number> {
  const cutoff = new Date(now - pendingUploadMaxAgeMs());
  let removed = 0;
  for (;;) {
    const rows = await SupportAttachment.query()
      .whereNull("messageId")
      .where("createdAt", "<", cutoff)
      .orderBy("id", "asc")
      .limit(200);
    if (rows.length === 0) {
      break;
    }
    for (const row of rows) {
      await unlink(dataDir.supportAttachmentFile(row.id!)).catch(() => {});
      await SupportAttachment.query().deleteById(row.id!);
      removed += 1;
    }
    if (rows.length < 200) {
      break;
    }
  }
  return removed;
}
