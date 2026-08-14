import { alphabetName, groupNumber } from "@keylearn/certificate";
import { type IssuedCertificate, myCertificates } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import * as styles from "./EarnedMedals.module.less";
import { Medal, medalFor } from "./Medal.tsx";

/**
 * The medals one learner has earned, each carrying its certificate.
 *
 * A learner with none renders nothing at all — no greyed silhouette, no
 * "0 certificates". An empty trophy cabinet drawn for a child every time a
 * parent opens their page is worse than the absence of one.
 *
 * The detail is on hover rather than behind a click because a medal is not a
 * control: pressing it should not be necessary to find out what it is, and
 * there is nowhere for a click to go that the account page does not already
 * do better.
 */
export function EarnedMedals({
  certificates,
  size = "normal",
}: {
  readonly certificates: readonly IssuedCertificate[];
  readonly size?: "pin" | "small" | "medium" | "normal";
}): ReactNode {
  const { formatMessage } = useIntl();
  if (certificates.length === 0) {
    return null;
  }
  return (
    <span className={styles.row}>
      {certificates.map((certificate) => (
        <span key={certificate.number} className={styles.slot} tabIndex={0}>
          <Medal
            kind={medalFor(certificate.level, certificate.kind)}
            size={size}
          />
          <span className={styles.card} role="tooltip">
            <b className={styles.title}>{titleOf(certificate)}</b>
            <Line
              label={formatMessage({
                id: "earnedMedals.alphabet",
                defaultMessage: "Alphabet",
              })}
              value={alphabetName(certificate.language)}
            />
            <Line
              label={
                certificate.kind === "braille" ? "Cells a minute" : "Speed"
              }
              value={
                certificate.kind === "braille"
                  ? `${Math.round(certificate.speed)}`
                  : `${Math.round(certificate.speed * 10) / 10} wpm`
              }
            />
            <Line
              label={formatMessage({
                id: "earnedMedals.accuracy",
                defaultMessage: "Accuracy",
              })}
              value={`${(certificate.accuracy * 100).toFixed(1)}%`}
            />
            <Line
              label={formatMessage({
                id: "earnedMedals.issued",
                defaultMessage: "Issued",
              })}
              value={dateOf(certificate.issued)}
            />
            <Line
              label="Number"
              value={groupNumber(certificate.number)}
              mono={true}
            />
          </span>
        </span>
      ))}
    </span>
  );
}

function Line({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): ReactNode {
  return (
    <span className={styles.line}>
      <i>{label}</i>
      <b className={mono ? styles.mono : undefined}>{value}</b>
    </span>
  );
}

const LEVEL: Readonly<Record<string, string>> = {
  completion: "Certificate of Completion",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

function titleOf(certificate: IssuedCertificate): string {
  const level = LEVEL[certificate.level] ?? certificate.level;
  return certificate.level === "completion"
    ? level
    : `${level} — Certificate of Completion`;
}

function dateOf(issued: string): string {
  const at = new Date(issued);
  return Number.isFinite(at.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(at)
    : "—";
}

/**
 * The certificates one learner holds, by their history namespace.
 *
 * The namespace is what every page already has to hand — `profile-<id>` —
 * where the profile id itself often is not. Signed out, or on a page with no
 * learner selected, this is simply empty.
 */
export function useEarnedCertificates(
  namespace: string | null | undefined,
): readonly IssuedCertificate[] {
  const [held, setHeld] = useState<readonly IssuedCertificate[]>([]);
  const profileId =
    namespace != null && namespace.startsWith("profile-")
      ? namespace.slice("profile-".length)
      : null;
  useEffect(() => {
    if (profileId == null) {
      setHeld([]);
      return;
    }
    let cancelled = false;
    void myCertificates().then((list) => {
      if (!cancelled) {
        setHeld(list.filter((c) => String(c.profileId) === profileId));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);
  return held;
}
