import {
  alphabetName,
  formatCertificateNumber,
  isCertificateNumber,
  normalizeCertificateNumber,
} from "@keylearn/certificate";
import { verifyCertificate, type VerifyResult } from "@keylearn/pages-shared";
import { FloatingShell } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, FormattedNumber, useIntl } from "react-intl";
import { useParams } from "react-router";
import * as styles from "./verify.module.less";

/**
 * Checking a certificate.
 *
 * Whoever needs this is usually not the person holding the certificate, and
 * frequently has no account — a teacher with a printed sheet, an employer with
 * a CV. So it asks for nothing, stores nothing, and says as little as it can.
 */
export default function Page(): ReactNode {
  const { formatDate, formatMessage } = useIntl();
  const { number: fromPath } = useParams();
  const [typed, setTyped] = useState(fromPath ?? "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = (value: string) => {
    const number = normalizeCertificateNumber(value);
    // The check character catches a mistyped number here, without a request.
    // It is also what stops this page being a way to sweep for what exists.
    if (!isCertificateNumber(number)) {
      setResult({ valid: false });
      return;
    }
    setChecking(true);
    void verifyCertificate(number)
      .then(setResult)
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    if (fromPath != null && fromPath !== "") {
      check(fromPath);
    }
    // Only on arrival: typing afterwards is handled by the form.
  }, [fromPath]);

  const tidy = normalizeCertificateNumber(typed);
  const wellFormed = isCertificateNumber(tidy);

  // A window rather than a page. Whoever is here has one eight-character
  // question and wants one answer; a full page of empty column either side of
  // a short form says the answer is bigger than it is.
  return (
    <FloatingShell
      compact={true}
      title={
        <FormattedMessage
          id="verify.title"
          defaultMessage="Check a certificate"
        />
      }
    >
      <div className={styles.root}>
        <p className={styles.lede}>
          <FormattedMessage
            id="verify.lede"
            defaultMessage="Type the eight characters printed on the certificate. Case and spacing do not matter."
          />
        </p>

        <form
          className={styles.form}
          onSubmit={(ev) => {
            ev.preventDefault();
            check(typed);
          }}
        >
          <input
            className={styles.field}
            value={typed}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="WM2F RJ2B"
            aria-label={formatMessage({
              id: "verify.numberLabel",
              defaultMessage: "Certificate number",
            })}
            onChange={(ev) => {
              setTyped(ev.target.value);
              setResult(null);
            }}
          />
          <button
            type="submit"
            className={styles.go}
            disabled={!wellFormed || checking}
          >
            <FormattedMessage id="verify.check" defaultMessage="Check" />
          </button>
        </form>

        {typed !== "" && !wellFormed && (
          <p className={styles.hint}>
            <FormattedMessage
              id="verify.malformed"
              defaultMessage="That is not a KeyLearn certificate number. They are eight characters long and never contain the letters I, L, O or U, or the digits 0 or 1."
            />
          </p>
        )}

        {result != null && (
          <div
            className={clsx(
              styles.card,
              result.valid ? styles.good : styles.bad,
            )}
          >
            {result.valid ? (
              <>
                <div className={styles.verdict}>
                  <FormattedMessage
                    id="verify.valid"
                    defaultMessage="This certificate was issued by KeyLearn."
                  />
                </div>
                <dl className={styles.facts}>
                  <dt>
                    <FormattedMessage
                      id="verify.number"
                      defaultMessage="Number"
                    />
                  </dt>
                  <dd className={styles.mono}>
                    {formatCertificateNumber(tidy)}
                  </dd>
                  <dt>
                    <FormattedMessage
                      id="verify.level"
                      defaultMessage="Level"
                    />
                  </dt>
                  <dd className={styles.level}>{result.level}</dd>
                  <dt>
                    <FormattedMessage
                      id="verify.alphabet"
                      defaultMessage="Alphabet"
                    />
                  </dt>
                  <dd>{alphabetName(result.language)}</dd>
                  <dt>
                    <FormattedMessage
                      id="verify.issued"
                      defaultMessage="Issued"
                    />
                  </dt>
                  {/* In the page's language, not the browser's (which gave
                      "25/09/2026" on a Japanese page), with the month named so
                      nobody has to guess day-first or month-first. <bdi> keeps
                      it in one piece inside a right-to-left page. Gregorian
                      always, to match the date printed on the certificate
                      (Persian would otherwise default to Solar Hijri). */}
                  <dd>
                    <bdi>
                      {formatDate(result.issued, {
                        calendar: "gregory",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </bdi>
                  </dd>
                  {result.criteriaVersion != null && (
                    <>
                      <dt>
                        <FormattedMessage
                          id="verify.criteriaVersion"
                          defaultMessage="Criteria version"
                        />
                      </dt>
                      <dd>{result.criteriaVersion}</dd>
                    </>
                  )}
                  {result.speed != null && (
                    <>
                      <dt>
                        <FormattedMessage
                          id="assess.fig.speed"
                          defaultMessage="Speed"
                        />
                      </dt>
                      <dd>
                        {result.kind === "braille" ? (
                          <FormattedMessage
                            id="verify.cpm"
                            defaultMessage="{speed} cells per minute"
                            values={{ speed: Math.round(result.speed) }}
                          />
                        ) : (
                          <FormattedMessage
                            id="report.sheet.wpm"
                            defaultMessage="{speed} wpm"
                            values={{ speed: Math.round(result.speed) }}
                          />
                        )}
                      </dd>
                    </>
                  )}
                  {result.accuracy != null && (
                    <>
                      <dt>
                        <FormattedMessage
                          id="assess.fig.acc"
                          defaultMessage="Accuracy"
                        />
                      </dt>
                      <dd>
                        <FormattedNumber
                          value={result.accuracy}
                          style="percent"
                          maximumFractionDigits={1}
                        />
                      </dd>
                    </>
                  )}
                  {result.name != null && (
                    <>
                      <dt>
                        <FormattedMessage
                          id="verify.holder"
                          defaultMessage="Holder"
                        />
                      </dt>
                      <dd>{result.name}</dd>
                    </>
                  )}
                </dl>
                {result.evidence === "self-reported" && (
                  <p className={styles.hint}>
                    <FormattedMessage
                      id="verify.selfReported"
                      defaultMessage="Issued before KeyLearn checked certificates against the learner’s own recorded practice. Its figures were reported by the learner’s device, not measured by us."
                    />
                  </p>
                )}
                {result.name == null && (
                  <p className={styles.hint}>
                    <FormattedMessage
                      id="verify.unnamed"
                      defaultMessage="The holder is not named here. Children never are, and a grown-up is named only if they chose to be."
                    />
                  </p>
                )}
              </>
            ) : (
              <div className={styles.verdict}>
                <FormattedMessage
                  id="verify.invalid"
                  defaultMessage="No certificate with that number has been issued."
                />
              </div>
            )}
          </div>
        )}

        <p className={styles.small}>
          <FormattedMessage
            id="verify.scope"
            defaultMessage="A KeyLearn certificate records a programme completed and a standard met in practice conditions. It is not a proctored examination, and it does not expire."
          />
        </p>
      </div>
    </FloatingShell>
  );
}
