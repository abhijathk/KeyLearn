// Talking to the certificate endpoints.
//
// Small on purpose. The rules live in @keylearn/certificate and are re-judged
// on the server; nothing here decides anything, it only carries.

export type IssuedCertificate = {
  readonly number: string;
  readonly level: "completion" | "bronze" | "silver" | "gold";
  readonly kind: "typing" | "braille";
  readonly audience: "adult" | "kid";
  readonly language: string;
  readonly speed: number;
  readonly accuracy: number;
  readonly name: string;
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
      const body = (await response.json()) as { error?: string };
      return {
        ok: false,
        reason: body.error === "not-eligible" ? "not-eligible" : "not-passed",
      };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
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
