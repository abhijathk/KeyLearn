import {
  AssessmentProvider,
  AssessmentSettings,
  BetweenRuns,
  CertificateDialog,
  type LoggedSegment,
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
import { LessonType, lessonProps } from "@keylearn/lesson";
import {
  brailleEvidence,
  pullBrailleProgress,
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
  startSitting,
  usePageData,
} from "@keylearn/pages-shared";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { type Result } from "@keylearn/result";
import { SettingsContext, useSettings } from "@keylearn/settings";
import { openResultStorage, ResultLoader } from "@keylearn/result-loader";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

/**
 * A braille learner's evidence is read from the braille store — after the
 * account's synced copy has been folded in. Read before that, a learner on a
 * device they have not practised on was told "Not yet" however much they had
 * done, while the server (which judges the synced copy) would have agreed.
 */
function BrailleSitting(): ReactNode {
  const { active } = useProfiles();
  const profileId = active?.id ?? null;
  const [pulled, setPulled] = useState(false);
  useEffect(() => {
    let live = true;
    setPulled(false);
    void pullBrailleProgress(profileId).finally(() => {
      if (live) {
        setPulled(true);
      }
    });
    return () => {
      live = false;
    };
  }, [profileId]);
  if (!pulled) {
    return null;
  }
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

  // Each attempt starts on the server: its clock, and the text it is typed
  // on. The keystrokes that come back are checked against both. Undefined
  // while that is on its way; null if it could not be had, in which case the
  // sitting still runs on the page's own text and the server refuses it.
  const [served, setServed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setServed(undefined);
    void startSitting(String(profile.id)).then((started) => {
      if (live) {
        setServed(started?.text ?? null);
      }
    });
    return () => {
      live = false;
    };
  }, [attempt, profile.id]);

  const onSitting = useCallback(
    async (
      runs: readonly Run[],
      logs: readonly (readonly LoggedSegment[])[],
    ) => {
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
        log: { runs: logs },
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

  // The surface waits for the server's text: mounted before it, the page
  // would build its first lines from its own lesson and keep them.
  if (served === undefined) {
    return null;
  }

  return (
    <AssessmentProvider
      key={attempt}
      kind={evidence.kind}
      audience={evidence.audience}
      age={evidence.age}
      served={served}
      onSitting={(runs, logs) => {
        void onSitting(runs, logs);
      }}
      onQuit={leave}
    >
      <AssessmentSettings>
        {evidence.kind === "typing" && evidence.audience === "adult" ? (
          <ServedText text={served ?? null}>{children}</ServedText>
        ) : (
          children
        )}
      </AssessmentSettings>
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

/**
 * The practice page, typing the server's text for the sitting.
 *
 * Re-provided rather than stored, like `AssessmentSettings`: nothing here
 * outlives the sitting. A custom-text lesson walks its words in order, so the
 * lines the page shows are consecutive stretches of exactly what was served.
 */
function ServedText({
  text,
  children,
}: {
  readonly text: string | null;
  readonly children: ReactNode;
}): ReactNode {
  const { settings, updateSettings } = useSettings();
  const value = useMemo(
    () => ({
      settings:
        text == null || text === ""
          ? settings
          : settings
              .set(lessonProps.type, LessonType.CUSTOM)
              .set(lessonProps.customText.content, text)
              .set(lessonProps.customText.randomize, false)
              .set(lessonProps.customText.lettersOnly, false)
              .set(lessonProps.customText.lowercase, false),
      updateSettings,
    }),
    [settings, updateSettings, text],
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
