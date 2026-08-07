import { CertificateDialog } from "@keylearn/assessment";
import {
  assess,
  bandFor,
  type CertificateCheck,
  type CertificateEvidence,
  type CertificateTemplate,
  certificateTemplate,
} from "@keylearn/certificate";
import { medalFor } from "@keylearn/certificate-ui";
import { artKindOf, ArtMotif } from "@keylearn/identicon";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import {
  type IssuedCertificate,
  myCertificates,
  Pages,
  type ProfileDetails,
  usePageData,
} from "@keylearn/pages-shared";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { type Result } from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate } from "react-router";
import { BrailleBadge } from "../profiles/BrailleBadge.tsx";
import { useProfiles } from "../profiles/context.tsx";
import specimenAdult from "./assets/specimen-adult.jpg";
import specimenChild from "./assets/specimen-child.jpg";
import specimenYoung from "./assets/specimen-young.jpg";
import * as styles from "./CoursePane.module.less";
import { brailleEvidence, typingEvidence } from "./evidence.ts";
import { languageLineOf } from "./language-line.ts";
import { ReadyDialog } from "./ReadyDialog.tsx";

/**
 * How far each learner is from a certificate, and what is left.
 *
 * Checks rather than a percentage. "62% of the way" tells a parent nothing
 * they can act on; "sixteen more letters, then three more days" does, and the
 * criteria already return every check with its required and actual value.
 *
 * Ordered by the household's own order and never by progress — sorting
 * siblings by how far along they are turns a family page into a league table,
 * and the child at the bottom reads it that way.
 */
export function CoursePane(): ReactNode {
  const { household } = useProfiles();
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const profiles = household.profiles;
  // Which of the three sheets this household would actually be handed. A home
  // of eleven-year-olds sees only the middle one; nobody is shown a specimen
  // nobody there could earn.
  const sheets = new Set<CertificateTemplate>(
    profiles.map((p) =>
      certificateTemplate(
        p.birthYear == null ? null : new Date().getFullYear() - p.birthYear,
        p.kind === "kid" ? "kid" : "adult",
      ),
    ),
  );

  return (
    <>
      <h2 className={styles.title}>
        <FormattedMessage
          id="account.course.title"
          defaultMessage="Course & certificates"
        />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="account.course.note"
          defaultMessage="Where each learner is, and what stands between them and a certificate. Only guided practice, the classic course, the kids trail and braille count — other modes are practice, but their letters are chosen by the text rather than by the curriculum."
        />
      </p>

      {profiles.length === 0 && (
        <p className={styles.empty}>
          <FormattedMessage
            id="account.course.noLearners"
            defaultMessage="No learners yet. Add one under Learners and their progress will appear here."
          />
        </p>
      )}

      {profiles.map((profile) => (
        <CourseRow key={profile.id} profile={profile} />
      ))}

      {!signedIn && (
        <p className={styles.warn}>
          <FormattedMessage
            id="account.course.needAccount"
            defaultMessage="Certificates need an account. The number has to come from somewhere authoritative, or it cannot be unique across your devices and nobody can check it. Everything else — the report, the CSV — works signed out."
          />
        </p>
      )}

      {sheets.size > 0 && (
        <div className={styles.samples}>
          <h3 className={styles.subTitle}>
            <FormattedMessage
              id="account.course.samples"
              defaultMessage="What they look like"
            />
          </h3>
          <p className={styles.note}>
            <FormattedMessage
              id="account.course.samples.note"
              defaultMessage="Shown only for the ages this household actually has. The sheet is chosen by age — under nine, nine to thirteen, and fourteen and over — while the standard is chosen by whether the learner is a child or a grown-up. A braille learner gets whichever of the three matches their age; the only difference is their name repeated in grade 1 beneath it, and cells per minute where the speed goes."
            />
          </p>
          <div className={styles.sampleRow}>
            {sheets.has("adult") && (
              <Specimen
                kind="adult"
                caption="Fourteen and over — speed and accuracy printed, no grade."
              />
            )}
            {sheets.has("young") && (
              <Specimen
                kind="young"
                caption="Nine to thirteen — the same standard, on a sheet that suits the age."
              />
            )}
            {sheets.has("child") && (
              <Specimen
                kind="child"
                caption="Under nine — Bronze, Silver or Gold for their age."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * One learner.
 *
 * Both of its inputs are asynchronous — the learner's own stored history, and
 * the alphabet of whichever language they practise. Coverage cannot be
 * answered without the second: "every letter" means nothing until something
 * says whose alphabet.
 */
function CourseRow({
  profile,
}: {
  readonly profile: ProfileDetails;
}): ReactNode {
  const braille = profile.visionSupport === true;
  const [results, setResults] = useState<readonly Result[] | null>(null);
  const { publicUser } = usePageData();

  useEffect(() => {
    if (braille) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const storage = openResultStorage({
          type: "private",
          userId: publicUser.id ?? null,
          kids: profile.kind === "kid",
          namespace: `profile-${profile.id}`,
        });
        const loaded = await storage.load();
        if (!cancelled) {
          setResults(loaded);
        }
      } catch {
        // A learner whose local database will not open shows as having no
        // practice rather than breaking the page for everybody else.
        if (!cancelled) {
          setResults([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [braille, profile.id, profile.kind, publicUser.id]);

  if (braille) {
    return <Row profile={profile} evidence={brailleEvidence(profile)} />;
  }
  if (results == null) {
    return (
      <div className={styles.row}>
        <Head profile={profile} state="loading" />
      </div>
    );
  }
  // A learner with no practice yet still has a row, and it still has to name
  // an alphabet — so fall back to the default layout rather than asking the
  // keyboard loader for one that does not exist. The first version passed it
  // `undefined`, which threw and took the whole pane down the moment a new
  // profile was added.
  const layout = results[0]?.layout ?? Layout.EN_US;
  return (
    <PhoneticModelLoader language={layout.language}>
      {({ letters }) => (
        <Row
          profile={profile}
          evidence={typingEvidence(
            profile,
            results,
            Letter.restrict(letters, loadKeyboard(layout).getCodePoints()),
          )}
          layout={layout}
          language={languageLineOf(layout, false)}
        />
      )}
    </PhoneticModelLoader>
  );
}

function Row({
  profile,
  evidence,
  layout = Layout.EN_US,
  language,
}: {
  readonly profile: ProfileDetails;
  readonly evidence: CertificateEvidence;
  /** Absent for a braille learner, who has no layout at all. */
  readonly layout?: Layout;
  readonly language?: string;
}): ReactNode {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { select } = useProfiles();
  // What this learner already holds. Fetched per row rather than once for the
  // pane because a row is where it is shown, and the endpoint answers for the
  // whole household in one request either way.
  const [held, setHeld] = useState<readonly IssuedCertificate[]>([]);
  const [showing, setShowing] = useState<IssuedCertificate | null>(null);
  useEffect(() => {
    let cancelled = false;
    void myCertificates().then((list) => {
      if (!cancelled) {
        setHeld(list.filter((c) => String(c.profileId) === profile.id));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);
  const verdict = assess(evidence);
  const state = verdict.eligible ? "ready" : "going";
  const [bronze, silver, gold] = bandFor(evidence.age, evidence.kind);
  return (
    <div className={styles.row}>
      <Head profile={profile} state={state} language={language} />
      <div className={styles.checks}>
        {verdict.checks.map((check) => (
          <Check key={check.id} check={check} />
        ))}
        {evidence.audience === "kid" && (
          <span className={clsx(styles.check, styles.band)}>
            <FormattedMessage
              id="account.course.band"
              defaultMessage="Bronze at {bronze} · Silver {silver} · Gold {gold}"
              values={{ bronze, silver, gold }}
            />
          </span>
        )}
      </div>
      <div className={styles.next}>
        {verdict.eligible ? (
          <>
            <FormattedMessage
              id="account.course.ready"
              defaultMessage="Everything the practice has to prove is proved. The assessment is what decides it."
            />{" "}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setReady(true)}
            >
              <FormattedMessage
                id="account.course.sit"
                defaultMessage="Sit the assessment"
              />
            </button>
          </>
        ) : (
          <FormattedMessage
            id="account.course.outstanding"
            defaultMessage="Next: {what}."
            values={{ what: verdict.outstanding[0]?.label.toLowerCase() ?? "" }}
          />
        )}
      </div>
      {held.length > 0 && (
        <div className={styles.next}>
          <FormattedMessage
            id="account.course.holds"
            defaultMessage="Certificate earned."
          />{" "}
          {held.map((certificate) => (
            <button
              key={certificate.number}
              type="button"
              className={styles.linkBtn}
              onClick={() => setShowing(certificate)}
            >
              <FormattedMessage
                id="account.course.open"
                defaultMessage="Open and download"
              />
            </button>
          ))}
        </div>
      )}
      {showing != null && (
        <CertificateDialog
          certificate={showing}
          languageLine={languageLineOf(layout, evidence.kind === "braille")}
          onClose={() => setShowing(null)}
        />
      )}
      {ready && (
        <ReadyDialog
          name={profile.firstName}
          evidence={evidence}
          medal={medalFor(
            evidence.audience === "kid" ? "gold" : "completion",
            evidence.kind,
          )}
          onClose={() => setReady(false)}
          onStart={() => {
            // Make this learner the active one first. The assessment page
            // reads the profile from the app rather than from the URL — which
            // is what keeps a child off the grown-up drill — so a parent
            // clicking a sibling's row has to switch who is practising.
            select(profile.id);
            void navigate(Pages.assessment.path);
          }}
        />
      )}
    </div>
  );
}

function Head({
  profile,
  state,
  language,
}: {
  readonly profile: ProfileDetails;
  readonly state: "ready" | "going" | "loading";
  readonly language?: string;
}): ReactNode {
  const braille = profile.visionSupport === true;
  const art = profile.avatar?.type === "art" ? profile.avatar : null;
  return (
    <div className={styles.head}>
      {/* Their own painting, very faint, so a household scanning this page
          finds the right learner by colour before they read the name. */}
      {art != null && (
        <ArtMotif
          className={styles.headArt}
          family={art.family}
          seed={art.seed}
          kind={
            artKindOf(art.family) ?? (profile.kind === "kid" ? "kid" : "adult")
          }
        />
      )}
      <span className={styles.name}>{profile.firstName}</span>
      {/* The same compact mark the picker and the learner tabs use, so a
          braille learner is recognised the same way everywhere. The kind badge
          stays beside it: braille says which page they get, not whether they
          are a child. */}
      {braille && (
        <span className={styles.brailleMark}>
          <BrailleBadge />
        </span>
      )}
      <span
        className={clsx(
          styles.badge,
          profile.kind === "kid" ? styles.kid : styles.adult,
        )}
      >
        {profile.kind === "kid" ? "kid" : "grown-up"}
      </span>
      <span className={styles.meta}>
        {braille ? "Unified English Braille · grade 1" : (language ?? "")}
      </span>
      <span
        className={clsx(
          styles.state,
          state === "ready" && styles.stateReady,
          state === "going" && styles.stateGoing,
        )}
      >
        {state === "loading" ? (
          <FormattedMessage
            id="account.course.reading"
            defaultMessage="Reading…"
          />
        ) : state === "ready" ? (
          <FormattedMessage
            id="account.course.readyTag"
            defaultMessage="Ready to sit"
          />
        ) : (
          <FormattedMessage
            id="account.course.goingTag"
            defaultMessage="In progress"
          />
        )}
      </span>
    </div>
  );
}

function Check({ check }: { readonly check: CertificateCheck }): ReactNode {
  const shown = (value: number) =>
    check.unit === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : Math.round(value * 10) / 10;
  return (
    <span className={clsx(styles.check, check.met ? styles.met : styles.miss)}>
      <i className={styles.dot} />
      <span className={styles.label}>{check.label}</span>
      <span className={styles.value}>
        {shown(check.actual)} / {shown(check.required)}
      </span>
    </span>
  );
}

/**
 * A specimen, and only a specimen.
 *
 * Deliberately small, watermarked, and not downloadable: a clean blank
 * certificate on a page anybody can reach is a forgery kit — somebody types a
 * name into it and it is indistinguishable from a real one. It also never
 * carries a certificate number.
 */
const SHEET: Readonly<Record<CertificateTemplate, string>> = {
  adult: specimenAdult,
  young: specimenYoung,
  child: specimenChild,
};

function Specimen({
  kind,
  caption,
}: {
  readonly kind: CertificateTemplate;
  readonly caption: string;
}): ReactNode {
  // A div, not a <figure>. The global stylesheet claims `figure` for document
  // figures — a border, a rem of padding, and a rem of margin on every one
  // after the first — which boxed each specimen and pushed two of the three
  // down out of line with the first. These are cards in a grid, so they should
  // not be asking for that styling in the first place.
  return (
    <div className={styles.specimen}>
      <div className={styles.sheet}>
        <img className={styles.sheetImage} src={SHEET[kind]} alt="" />
        <span className={styles.stamp}>
          <FormattedMessage
            id="account.course.specimen"
            defaultMessage="Specimen"
          />
        </span>
      </div>
      <div className={styles.specimenCaption}>{caption}</div>
    </div>
  );
}
