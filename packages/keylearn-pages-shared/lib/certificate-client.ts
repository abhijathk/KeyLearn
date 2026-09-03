// Talking to the certificate endpoints.
//
// Small on purpose. The rules live in @keylearn/certificate and are re-judged
// on the server; nothing here decides anything, it only carries.

export type IssuedCertificate = {
  readonly number: string;
  readonly level: "completion" | "bronze" | "silver" | "gold";
  /** Which of the three papers this was printed on, fixed at issue. */
  readonly sheet: "adult" | "young" | "child";
  readonly kind: "typing" | "braille";
  readonly audience: "adult" | "kid";
  readonly language: string;
  readonly speed: number;
  readonly accuracy: number;
  readonly name: string;
  /** Whether checking the number reveals who holds it. Never true for a kid. */
  readonly nameVisible: boolean;
  readonly issued: string;
};

export type VerifyResult =
  | { readonly valid: false }
  | {
      readonly valid: true;
      readonly level: string;
      readonly language: string;
      readonly kind: string;
      readonly issued: string;
      /** The criteria version the certificate was issued under. */
      readonly criteriaVersion?: number;
      /** Null unless the holder asked to be named, and never for a child. */
      readonly name: string | null;
    };

/**
 * Record a sitting.
 *
 * Fire and forget from the learner's point of view: the verdict is the median
 * of the last three, so nothing about this one sitting is worth waiting for,
 * and a lost network call costs a sitting rather than an assessment.
 */
export async function postSitting(
  profileId: string,
  sitting: {
    readonly kind: "typing" | "braille";
    readonly language: string;
    readonly speed: number;
    readonly accuracy: number;
    readonly runs: number;
    readonly seconds: number;
  },
): Promise<boolean> {
  try {
    const response = await fetch(`/_/certificate/sitting/${profileId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sitting),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type IssueOutcome =
  | { readonly ok: true; readonly certificate: IssuedCertificate }
  | {
      readonly ok: false;
      readonly reason: "not-eligible" | "not-passed" | "error";
      /**
       * The server's own verdict, when it had one.
       *
       * Carried back so the page can say *why* — how many sittings are still
       * needed, or what the median came to — rather than only that it did not
       * happen. Typed loosely on purpose: this is the server's `judge` result
       * and the page passes it straight to `outcomeMessage`.
       */
      readonly verdict?: unknown;
    };

/** Ask for a certificate. The server decides; this only reports what it said. */
export async function issueCertificate(
  profileId: string,
  claim: Record<string, unknown>,
): Promise<IssueOutcome> {
  try {
    const response = await fetch(`/_/certificate/${profileId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(claim),
    });
    if (response.ok) {
      return {
        ok: true,
        certificate: (await response.json()) as IssuedCertificate,
      };
    }
    if (response.status === 409) {
      const body = (await response.json()) as {
        error?: string;
        verdict?: unknown;
      };
      return {
        ok: false,
        reason: body.error === "not-eligible" ? "not-eligible" : "not-passed",
        verdict: body.verdict,
      };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * The household's certificates, keyed by nothing — the caller matches them to
 * learners itself, because a profile can hold more than one.
 */
export async function myCertificates(): Promise<
  readonly (IssuedCertificate & { readonly profileId: number })[]
> {
  try {
    const response = await fetch("/_/certificate/mine");
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as readonly (IssuedCertificate & {
      readonly profileId: number;
    })[];
  } catch {
    // Signed out, or offline. A learner row simply shows no medals.
    return [];
  }
}

export async function verifyCertificate(number: string): Promise<VerifyResult> {
  try {
    const response = await fetch(
      `/_/certificate/verify/${encodeURIComponent(number)}`,
    );
    if (!response.ok) {
      return { valid: false };
    }
    return (await response.json()) as VerifyResult;
  } catch {
    return { valid: false };
  }
}

/**
 * Choose whether checking this number names its holder.
 *
 * Separate from issuing, because the decision belongs to the moment somebody
 * shares it rather than to the moment it was earned. Refused outright for a
 * child's certificate — the server does not store a preference it would then
 * have to ignore.
 */
export async function setCertificateNamed(
  number: string,
  nameVisible: boolean,
): Promise<boolean> {
  try {
    const response = await fetch(
      `/_/certificate/named/${encodeURIComponent(number)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nameVisible }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
