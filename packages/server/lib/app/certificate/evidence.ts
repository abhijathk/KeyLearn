import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inject, injectable } from "@fastr/invert";
import { Manifest } from "@keylearn/assets";
import {
  BRAILLE_ALPHABET,
  type CertificateEvidence,
  type CertificateKind,
} from "@keylearn/certificate";
import { DataDir } from "@keylearn/config";
import { type Profile } from "@keylearn/database";
import { Layout } from "@keylearn/keyboard";
import { Logger } from "@keylearn/logger";
import {
  brailleEvidenceFromSnapshot,
  typingAlphabet,
  typingEvidence,
} from "@keylearn/page-account";
import { type Result } from "@keylearn/result";
import { UserDataFactory } from "@keylearn/result-userdata";
import { learnerOwner } from "../access/owner.ts";

type Alphabet = ReturnType<typeof typingAlphabet>;

/**
 * What a certificate is judged on, worked out here from the learner's own
 * synced record — never taken from the request.
 *
 * Until this existed the browser sent the figures and the server graded
 * them, so three requests with invented numbers produced a real, verifiable
 * certificate. Now the server reads the same history the account page reads
 * (the learner's results file, or their synced braille record) and reduces it
 * with the same functions (`typingEvidence`, `brailleEvidenceFromSnapshot`),
 * so the page's "you're ready" and the server's verdict cannot disagree
 * unless the page is looking at practice the server has not been sent yet.
 */
@injectable()
export class EvidenceSource {
  readonly #alphabets = new Map<string, Promise<Alphabet>>();

  constructor(
    readonly userData: UserDataFactory,
    readonly dataDir: DataDir,
    readonly manifest: Manifest,
    @inject("publicDir") readonly publicDir: string,
  ) {}

  async derive(
    profile: Profile,
    kind: CertificateKind,
  ): Promise<{ evidence: CertificateEvidence; language: string }> {
    const owner = learnerOwner(profile);
    const who = {
      kind: profile.kind as "adult" | "kid",
      birthYear: profile.birthYear ?? null,
    };
    if (kind === "braille") {
      let snapshot: unknown = null;
      if (owner != null) {
        try {
          snapshot = JSON.parse(
            await readFile(
              this.dataDir.brailleProgressFile(owner, profile.id!),
              "utf8",
            ),
          );
        } catch {
          // No braille practice synced yet: judged as nothing done.
        }
      }
      return {
        evidence: brailleEvidenceFromSnapshot(who, snapshot),
        language: BRAILLE_ALPHABET,
      };
    }
    const results: Result[] = [];
    if (owner != null) {
      for await (const result of this.userData
        .loadProfile(owner, profile.id!)
        .read()) {
        results.push(result);
      }
    }
    // The same layout the page takes: the one the practice was typed on.
    const layout = results[0]?.layout ?? Layout.EN_US;
    return {
      evidence: typingEvidence(who, results, await this.alphabet(layout)),
      language: String(layout),
    };
  }

  /**
   * The letters a layout's certificate covers, from the language model the
   * page itself downloads. Cached per layout; an unreadable model yields an
   * empty alphabet, which reads as "nothing covered" and so can only refuse.
   */
  alphabet(layout: Layout): Promise<Alphabet> {
    let letters = this.#alphabets.get(layout.id);
    if (letters == null) {
      letters = (async () => {
        try {
          const path = this.manifest.assetPath(
            `/assets/model-${layout.language.id}.data`,
          );
          const bytes = await readFile(join(this.publicDir, path));
          return typingAlphabet(layout, new Uint8Array(bytes));
        } catch (err) {
          Logger.warn(
            err as Error,
            "Could not load the %s alphabet",
            layout.id,
          );
          this.#alphabets.delete(layout.id);
          return [];
        }
      })();
      this.#alphabets.set(layout.id, letters);
    }
    return letters;
  }
}
