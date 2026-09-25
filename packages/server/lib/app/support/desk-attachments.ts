import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type DataDir } from "@keylearn/config";
import { SupportAttachment } from "@keylearn/database";
import { bytesMatchType } from "./my-controller.ts";
import { fetchDeskAttachment } from "./qdesk-forward.ts";
import { ScannerDown, scanningRequired, scanUpload } from "./virus-scan.ts";

/** One file a desk reply says it carries, as the desk describes it. */
export type DeskFile = {
  readonly id: number;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
};

/**
 * Brings the files a staffer attached on the desk into this app's own
 * storage, bound to the reply that carried them.
 *
 * Held to exactly the rules a customer's upload meets — the type list, the
 * size ceiling, the bytes agreeing with the claimed type, and the virus
 * scan, fail-closed — because a file is not safer for having come from the
 * desk: it came from whoever the staffer got it from. A file that fails any
 * of them is skipped, not the reply: the words still reach the customer,
 * and the count that comes back tells the desk what did not.
 */
export async function storeDeskAttachments(
  dataDir: DataDir,
  ticketId: number,
  messageId: number,
  files: readonly DeskFile[],
): Promise<number> {
  let stored = 0;
  for (const file of files) {
    if (!SupportAttachment.ALLOWED_TYPES.has(file.mimeType)) {
      continue;
    }
    const bytes = await fetchDeskAttachment(ticketId, file.id);
    if (
      bytes == null ||
      bytes.length === 0 ||
      bytes.length > SupportAttachment.MAX_BYTES ||
      !bytesMatchType(bytes, file.mimeType)
    ) {
      continue;
    }
    let scanner: string | null = null;
    if (scanningRequired()) {
      try {
        const verdict = await scanUpload(bytes);
        if (!verdict.clean) {
          console.warn(
            `desk-attachment: refused file ${String(file.id)} on ticket ${String(ticketId)} — ${verdict.threat}`,
          );
          continue;
        }
        scanner = "clamav";
      } catch (err) {
        if (err instanceof ScannerDown) {
          console.error("desk-attachment:", err.message);
          continue;
        }
        throw err;
      }
    }
    const row = await SupportAttachment.query().insertAndFetch({
      ticketId,
      messageId,
      userId: null,
      // Display only; never used as a path.
      fileName: file.fileName.slice(0, 200),
      mimeType: file.mimeType,
      size: bytes.length,
      scannedAt: scanner == null ? null : new Date(),
      scanner,
    });
    const path = dataDir.supportAttachmentFile(row.id!);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    stored++;
  }
  return stored;
}
