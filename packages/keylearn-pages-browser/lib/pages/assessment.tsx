import {
  AssessmentProvider,
  AssessmentSettings,
  BetweenRuns,
  CertificateDialog,
  Hud,
  type Outcome,
  OutcomeDialog,
} from "@keylearn/assessment";
import {
  assess,
  type AssessmentVerdict,
  BRAILLE_ALPHABET,
  type CertificateEvidence,
  type Run,
} from "@keylearn/certificate";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import {
  brailleEvidence,
  languageLineOf,
  typingEvidence,
  useProfiles,
} from "@keylearn/page-account";
import { BraillePage } from "@keylearn/page-braille";
import { KidsPage } from "@keylearn/page-kids";
import { PracticePage } from "@keylearn/page-practice";
import {
  issueCertificate,
  type IssuedCertificate,
  Pages,
  postSitting,
  usePageData,
} from "@keylearn/pages-shared";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { type Result } from "@keylearn/result";
import { openResultStorage, ResultLoader } from "@keylearn/result-loader";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate } from "react-router";
import { WithAdaptations } from "../adaptations.tsx";

/**
 * Sitting the assessment.
 *
 * The learner's own practice surface, with the clock over it — the same page,
 * the same renderer, the same feel. A separate assessment screen would look
 * like a different application at the exact moment somebody is most nervous,
 * and the only things that actually change are that the hints go away and that
 * there is a timer.
 *
 * Which surface appears is decided from the stored profile and never from the
 * URL, so there is no path by which a child reaches the grown-up drill or a
 * sighted learner reaches the braille one.
 */
export default function Page(): ReactNode {
  const navigate = useNavigate();
  const { publicUser } = usePageData();
  const { namespace, active } = useProfiles();

  // Certificates are for signed-in households: the number comes from the
  // server, and uniqueness is a property of a sequence that has to live
  // somewhere authoritative.
  if (publicUser.id == null || active == null) {
    return (
      <Notice
        title={
          <FormattedMessage
            id="assess.gate.title"
            defaultMessage="Sign in to sit the assessment"
          />
        }
        body={
          <FormattedMessage
            id="assess.gate.body"
            defaultMessage="A certificate carries a number anyone can check, and that number is issued by the server — so this needs an account and a learner selected."
          />
        }
        onBack={() => {
          void navigate(Pages.account.path);
        }}
      />
    );
  }

  const braille = active.visionSupport === true;
  return braille ? (
    <BrailleSitting />
  ) : (
    <ResultLoader namespace={namespace}>
      <TypingSitting />
    </ResultLoader>
  );
}

/** A braille learner's evidence is read straight from the braille store. */
function BrailleSitting(): ReactNode {
  const { active } = useProfiles();
  return (
    <Sitting
      evidence={brailleEvidence(active!)}
      // A braille learner has no layout, so the key is the code itself. It
      // still has to be a key and not the printed line: sittings are grouped
      // by it, and finishing one alphabet says nothing about another.
      language={BRAILLE_ALPHABET}
      languageLine={languageLineOf(Layout.EN_US, true)}
    >
      <BraillePage />
    </Sitting>
  );
}

/**
 * A typing learner's evidence, from the same history the account page reads.
 *
 * Gathered here rather than passed in from the account page: somebody can
 * reach this route directly, and evidence carried through a URL is evidence a
 * learner can edit.
 */
function TypingSitting(): ReactNode {
  const { active } = useProfiles();
  const { publicUser } = usePageData();
  const profile = active!;
  const [results, setResults] = useState<readonly Result[] | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // The same request the account page's course pane makes. A different
        // one here would read a different database and judge eligibility on
        // history the learner has never seen.
        const storage = await openResultStorage({
          type: "private",
          userId: publicUser.id ?? null,
          kids: profile.kind === "kid",
          namespace: `profile-${profile.id}`,
        });
        const loaded = await storage.load();
        if (live) {
          setResults(loaded);
        }
      } catch {
        if (live) {
          setResults([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [profile.id, profile.kind, publicUser.id]);

  if (results == null) {
    return null;
  }
  const layout = results[0]?.layout ?? Layout.EN_US;
  const kid = profile.kind === "kid";
  return (
    <PhoneticModelLoader language={layout.language}>
      {({ letters }) => (
        <Sitting
          evidence={typingEvidence(
            profile,
            results,
            Letter.restrict(letters, loadKeyboard(layout).getCodePoints()),
          )}
          language={String(layout)}
          languageLine={languageLineOf(layout, false)}
        >
          {kid ? <KidsPage /> : <PracticePage />}
        </Sitting>
      )}
    </PhoneticModelLoader>
  );
}

/**
 * The sitting itself: the surface, the clock over it, and what happens after.
 *
 * Eligibility is checked here as well as on the server. Not as a security
 * measure — the server is the one that decides — but because arriving at a
 * timed run and only being told afterwards that it could never have counted is
 * the worst possible order to learn it in.
 */
function Sitting({
  evidence,
  language,
  languageLine,
  children,
}: {
  readonly evidence: CertificateEvidence;
  /**
   * The alphabet key sittings and certificates are grouped by — a layout id,
   * or the braille code. Short and stable, because it is stored and matched
   * on; the printed wording is `languageLine` and is derived from it.
   */
  readonly language: string;
  readonly languageLine: string;
  readonly children: ReactNode;
}): ReactNode {
  const navigate = useNavigate();
  const { active } = useProfiles();
  const profile = active!;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [certificate, setCertificate] = useState<IssuedCertificate | null>(
    null,
  );
  const [showing, setShowing] = useState(false);
  // Bumping this remounts the provider, which is how "sit it again" starts a
  // genuinely fresh sitting rather than resuming a finished one.
  const [attempt, setAttempt] = useState(0);

  const leave = useCallback(() => {
    void navigate(Pages.account.path);
  }, [navigate]);

  const onSitting = useCallback(
    async (runs: readonly Run[]) => {
      setOutcome({ state: "sending" });
      if (runs.length === 0) {
        // Nothing measurable happened — the clock ran out before a line was
        // finished. Recording it would be recording a silence, and judging it
        // would be judging one. Said as its own outcome rather than as an
        // error: nothing failed, and telling somebody to check their
        // connection over a line they did not finish is a wrong answer.
        setOutcome({ state: "empty" });
        return;
      }
      const median = (xs: readonly number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        const mid = s.length >> 1;
        return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
      };
      const ok = await postSitting(String(profile.id), {
        kind: evidence.kind,
        language,
        speed: median(runs.map((r) => r.speed)),
        accuracy: median(runs.map((r) => r.accuracy)),
        runs: runs.length,
        seconds: Math.round(runs.reduce((sum, r) => sum + r.seconds, 0)),
      });
      if (!ok) {
        setOutcome({ state: "error" });
        return;
      }
      // The server re-judges over every sitting this learner has, not just
      // this one, and decides for itself whether that is a pass.
      const issued = await issueCertificate(String(profile.id), {
        ...evidence,
        language,
      });
      if (issued.ok) {
        setCertificate(issued.certificate);
        setOutcome({ state: "won", certificate: issued.certificate });
        return;
      }
      if (issued.reason === "not-passed" && issued.verdict != null) {
        setOutcome({
          state: "judged",
          verdict: issued.verdict as AssessmentVerdict,
        });
        return;
      }
      setOutcome({
        state: issued.reason === "not-eligible" ? "not-eligible" : "error",
      });
    },
    [profile.id, evidence, language],
  );

  const verdict = assess(evidence);
  if (!verdict.eligible) {
    return (
      <Notice
        title={
          <FormattedMessage id="assess.early.title" defaultMessage="Not yet" />
        }
        body={
          <FormattedMessage
            id="assess.early.body"
            defaultMessage="The practice has not proved everything the certificate asks for. Next: {what}."
            values={{
              what: verdict.outstanding[0]?.label.toLowerCase() ?? "",
            }}
          />
        }
        onBack={leave}
      />
    );
  }

  return (
    <AssessmentProvider
      key={attempt}
      kind={evidence.kind}
      audience={evidence.audience}
      age={evidence.age}
      onSitting={(runs) => {
        void onSitting(runs);
      }}
      onQuit={leave}
    >
      <AssessmentSettings>{children}</AssessmentSettings>
      <Hud />
      <BetweenRuns />
      {outcome != null && !showing && (
        <OutcomeDialog
          outcome={outcome}
          audience={evidence.audience}
          name={profile.firstName}
          onAgain={() => {
            setOutcome(null);
            setAttempt((n) => n + 1);
          }}
          onLeave={leave}
          onShow={() => {
            setShowing(true);
          }}
        />
      )}
      {showing && certificate != null && (
        <CertificateDialog
          certificate={certificate}
          languageLine={languageLine}
          onClose={leave}
        />
      )}
    </AssessmentProvider>
  );
}

/** A plain page for the two ways this route can be reached but not used. */
function Notice({
  title,
  body,
  onBack,
}: {
  readonly title: ReactNode;
  readonly body: ReactNode;
  readonly onBack: () => void;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        minBlockSize: "60vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2>{title}</h2>
      <p style={{ maxInlineSize: "30rem", color: "var(--text-color-f1)" }}>
        {body}
      </p>
      <button type="button" onClick={onBack} style={{ fontWeight: 700 }}>
        <FormattedMessage
          id="assess.notice.back"
          defaultMessage="Back to the account"
        />
      </button>
    </div>
  );
}
