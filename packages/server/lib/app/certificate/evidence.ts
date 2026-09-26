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
  brailleUnits,
  servedBrailleText,
  servedTypingText,
  typingAlphabet,
  typingEvidence,
  typingUnits,
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
      return {
        evidence: brailleEvidenceFromSnapshot(
          who,
          await this.#brailleSnapshot(profile),
        ),
        language: BRAILLE_ALPHABET,
      };
    }
    const results = await this.#results(profile);
    // The same layout the page takes: the one the practice was typed on.
    const layout = results[0]?.layout ?? Layout.EN_US;
    return {
      evidence: typingEvidence(who, results, await this.alphabet(layout)),
      language: String(layout),
    };
  }

  /**
   * The text a sitting is typed on, chosen here and kept by the caller so the
   * keystrokes can be checked against it (see `proctor`). Long enough for
   * every run at a pace nobody reaches; the page cycles it if they do.
   */
  async serve(profile: Profile, kind: CertificateKind): Promise<string> {
    if (kind === "braille") {
      return servedBrailleText(await this.#brailleSnapshot(profile), 120);
    }
    const results = await this.#results(profile);
    const layout = results[0]?.layout ?? Layout.EN_US;
    const model = await this.#model(layout);
    return model == null ? "" : servedTypingText(layout, model, 1500);
  }

  /** How many keystroke units a stretch of text is, for this kind. */
  unitsOf(kind: CertificateKind): (text: string) => number {
    return kind === "braille" ? brailleUnits : typingUnits;
  }

  async #results(profile: Profile): Promise<Result[]> {
    const owner = learnerOwner(profile);
    const results: Result[] = [];
    if (owner != null) {
      for await (const result of this.userData
        .loadProfile(owner, profile.id!)
        .read()) {
        results.push(result);
      }
    }
    return results;
  }

  async #brailleSnapshot(profile: Profile): Promise<unknown> {
    const owner = learnerOwner(profile);
    if (owner == null) {
      return null;
    }
    try {
      return JSON.parse(
        await readFile(
          this.dataDir.brailleProgressFile(owner, profile.id!),
          "utf8",
        ),
      );
    } catch {
      return null; // No braille practice synced yet: judged as nothing done.
    }
  }

  /** The language model's bytes, as the page downloads them. */
  async #model(layout: Layout): Promise<Uint8Array | null> {
    try {
      const path = this.manifest.assetPath(
        `/assets/model-${layout.language.id}.data`,
      );
      return new Uint8Array(await readFile(join(this.publicDir, path)));
    } catch (err) {
      Logger.warn(err as Error, "Could not load the %s model", layout.id);
      return null;
    }
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
        const model = await this.#model(layout);
        if (model == null) {
          this.#alphabets.delete(layout.id);
          return [];
        }
        return typingAlphabet(layout, model);
      })();
      this.#alphabets.set(layout.id, letters);
    }
    return letters;
  }
}
