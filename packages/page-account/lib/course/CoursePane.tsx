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
  type CourseId,
  courseNamespace,
  type IssuedCertificate,
  myCertificates,
  Pages,
  type ProfileDetails,
  usePageData,
} from "@keylearn/pages-shared";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
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
 * How many condition lines a placeholder row stands in for.
 *
 * Seven conditions for everybody, and a child gets an eighth for the medal
 * band. Known from the profile alone, so the placeholder is the height of the
 * row that replaces it rather than an average of all of them.
 */
function skeletonChecks(profile: ProfileDetails): number {
  return profile.kind === "kid" ? 8 : 7;
}

/**
 * Everything one row needs, already resolved.
 *
 * Rows used to fetch for themselves, which meant three staggered awaits each —
 * stored history, then the alphabet, then the certificates — and the pane
 * reflowed once per stage per learner. Now the pane resolves all of it and a
 * row is a pure function of this.
 */
type RowData = {
  readonly profile: ProfileDetails;
  readonly evidence: CertificateEvidence;
  readonly layout: Layout;
  readonly language?: string;
  readonly course?: CourseId;
  readonly held: readonly IssuedCertificate[];
};

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
  // Null until every learner's history, alphabet and certificates have all
  // arrived. The pane shows a skeleton of the right shape until then and then
  // renders once — nothing appears while anything is still coming.
  const [rows, setRows] = useState<readonly RowData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Guided practice and Classic are separate courses with separate
      // histories, and a certificate is earned on one of them — not on the two
      // added together, which would count a learner's first week twice.
      const read = async (profile: ProfileDetails, which: CourseId) => {
        try {
          const storage = openResultStorage({
            type: "private",
            userId: publicUser.id ?? null,
            kids: profile.kind === "kid",
            namespace: courseNamespace(profile.id, which),
          });
          return await storage.load();
        } catch {
          // A learner whose local database will not open shows as having no
          // practice rather than breaking the page for everybody else.
          return [];
        }
      };

      // One request for the whole household. Each row used to ask for this
      // separately even though the endpoint answers for everybody either way.
      const certificates = myCertificates().catch(() => []);

      const built = await Promise.all(
        profiles.map(async (profile): Promise<Omit<RowData, "held">> => {
          if (profile.visionSupport === true) {
            return {
              profile,
              evidence: brailleEvidence(profile),
              layout: Layout.EN_US,
            };
          }
          const [guided, classic] = await Promise.all([
            read(profile, "guided"),
            read(profile, "classic"),
          ]);
          // The further one is what the row reports, because that is the one
          // they are actually doing; the row says which.
          const on: CourseId =
            classic.length > guided.length ? "classic" : "guided";
          const results = on === "classic" ? classic : guided;
          // A learner with no practice yet still has a row, and it still has to
          // name an alphabet — so fall back to the default layout rather than
          // asking the keyboard loader for one that does not exist.
          const layout = results[0]?.layout ?? Layout.EN_US;
          let letters: readonly Letter[] = [];
          try {
            letters = Letter.restrict(
              (await PhoneticModelLoader.loader(layout.language)).letters,
              loadKeyboard(layout).getCodePoints(),
            );
          } catch {
            // Coverage cannot be judged without an alphabet, and inventing one
            // would misreport it. An empty set reads as nothing learned yet,
            // which is wrong but visibly so, rather than a row that never
            // arrives.
          }
          return {
            profile,
            evidence: typingEvidence(profile, results, letters),
            layout,
            language: languageLineOf(layout, false),
            course: on,
          };
        }),
      );

      const held = await certificates;
      if (!cancelled) {
        setRows(
          built.map((row) => ({
            ...row,
            held: held.filter((c) => String(c.profileId) === row.profile.id),
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profiles, publicUser.id]);
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
      {profiles.length === 0 && (
        <p className={styles.empty}>
          <FormattedMessage
            id="account.course.noLearners"
            defaultMessage="No learners yet. Add one under Learners and their progress will appear here."
          />
        </p>
      )}

      {rows == null
        ? profiles.map((profile) => (
            <div key={profile.id} className={styles.row}>
              <Head profile={profile} state="loading" />
              {/* The shape of the row that is coming, at the height it will
                  come at. A three-line placeholder standing in for a nine-line
                  row still moves the page by a couple of hundred pixels per
                  learner the moment the real one lands, which is the whole
                  thing this exists to prevent. */}
              <div className={styles.skeleton} aria-hidden={true}>
                <span className={styles.skelBar} />
                <span className={styles.skelChecks}>
                  {Array.from({ length: skeletonChecks(profile) }, (_, i) => (
                    <span key={i} className={styles.skelCheck} />
                  ))}
                </span>
                <span className={styles.skelNext} />
              </div>
            </div>
          ))
        : rows.map((row) => <Row key={row.profile.id} {...row} />)}

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
 * One learner, fully resolved.
 *
 * Everything this needs arrives as a prop. It renders in one pass and never
 * changes shape afterwards, which is what stops the pane from moving under
 * somebody who has started reading it.
 */
function Row({
  profile,
  evidence,
  layout = Layout.EN_US,
  language,
  course,
  held,
}: RowData): ReactNode {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { select } = useProfiles();
  const [showing, setShowing] = useState<IssuedCertificate | null>(null);
  const verdict = assess(evidence);
  const state = verdict.eligible ? "ready" : "going";
  // How far along, as one number. Every condition counts the same and none can
  // count more than once — a learner who has typed ten times the lessons needed
  // is not thereby closer to having practised on enough separate days.
  const progress =
    verdict.checks.reduce(
      (sum, check) =>
        sum +
        Math.min(1, check.required > 0 ? check.actual / check.required : 1),
      0,
    ) / Math.max(1, verdict.checks.length);
  const [bronze, silver, gold] = bandFor(evidence.age, evidence.kind);
  return (
    <div className={clsx(styles.row, styles.rowReady)}>
      <Head
        profile={profile}
        state={state}
        language={language}
        course={course}
      />
      {/* The same thin line the practice page uses, for the same reason: a
          household scanning five learners reads five bars faster than five
          lists of conditions. The list underneath is what says why. */}
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className={clsx(styles.barFill, verdict.eligible && styles.barDone)}
          style={{ inlineSize: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className={styles.checks}>
        {verdict.checks.map((check) => (
          <Check
            key={check.id}
            check={check}
            braille={evidence.kind === "braille"}
            total={evidence.total}
          />
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
          <>
            <FormattedMessage
              id="account.course.outstanding"
              defaultMessage="Next: {what}."
              values={{
                what: verdict.outstanding[0]?.label.toLowerCase() ?? "",
              }}
            />{" "}
            {/* Said plainly, because the absence of a link is not a message.
                Every condition above is met by practising; none of them is met
                by looking for a button that is not there yet. */}
            <span className={styles.locked}>
              <FormattedMessage
                id="account.course.locked"
                defaultMessage="The link to sit the assessment appears here once every condition above is met."
              />
            </span>
          </>
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
  course,
}: {
  readonly profile: ProfileDetails;
  readonly state: "ready" | "going" | "loading";
  readonly language?: string;
  readonly course?: CourseId;
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
      {braille && <BrailleBadge />}
      <span
        className={clsx(
          styles.badge,
          profile.kind === "kid" ? styles.kid : styles.adult,
        )}
      >
        {profile.kind === "kid" ? (
          <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
        ) : (
          <FormattedMessage id="profiles.adult" defaultMessage="Grown-up" />
        )}
      </span>
      <span className={styles.meta}>
        {braille ? "Unified English Braille · grade 1" : (language ?? "")}
        {/* Named only when it is not the ordinary one, so five guided rows do
            not each carry a word that distinguishes nothing. */}
        {course === "classic" && (
          <>
            {" · "}
            <FormattedMessage
              id="texts.mode.curriculum"
              defaultMessage="Classic course"
            />
          </>
        )}
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

/**
 * The name of one condition, in the reader's language.
 *
 * `assess` lives in a package that is also the server's judge, so its labels
 * are plain English strings with no react-intl anywhere near them — and the
 * type has always said the UI renders a translated label. It did not, so this
 * pane read half in Tamil and half in English the moment anything was
 * translated. Keyed by the check's own id, which is stable and already exists.
 */
function CheckLabel({
  id,
  braille,
  total,
}: {
  readonly id: string;
  readonly braille: boolean;
  readonly total: number;
}): ReactNode {
  switch (id) {
    case "coverage":
      return braille ? (
        <FormattedMessage
          id="account.check.coverage.cells"
          defaultMessage="Every one of the {total} cells introduced"
          values={{ total }}
        />
      ) : (
        <FormattedMessage
          id="account.check.coverage.letters"
          defaultMessage="Every one of the {total} letters introduced"
          values={{ total }}
        />
      );
    case "settled":
      return braille ? (
        <FormattedMessage
          id="account.check.settled.cells"
          defaultMessage="Every cell reliable, not merely met"
        />
      ) : (
        <FormattedMessage
          id="account.check.settled.letters"
          defaultMessage="Every letter reliable, not merely met"
        />
      );
    case "volume":
      return braille ? (
        <FormattedMessage
          id="account.check.volume.cells"
          defaultMessage="Cells entered correctly"
        />
      ) : (
        <FormattedMessage
          id="account.check.volume.lessons"
          defaultMessage="Course lessons completed"
        />
      );
    case "days":
      return (
        <FormattedMessage
          id="account.check.days"
          defaultMessage="Days practised"
        />
      );
    case "elapsed":
      return (
        <FormattedMessage
          id="account.check.elapsed"
          defaultMessage="Days from the first lesson to the last"
        />
      );
    case "speed":
      return (
        <FormattedMessage
          id="account.check.speed"
          defaultMessage="Sustained speed"
        />
      );
    case "accuracy":
      return (
        <FormattedMessage
          id="account.check.accuracy"
          defaultMessage="Sustained accuracy"
        />
      );
    default:
      return null;
  }
}

function Check({
  check,
  braille,
  total,
}: {
  readonly check: CertificateCheck;
  readonly braille: boolean;
  readonly total: number;
}): ReactNode {
  const shown = (value: number) =>
    check.unit === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : Math.round(value * 10) / 10;
  return (
    <span className={clsx(styles.check, check.met ? styles.met : styles.miss)}>
      <i className={styles.dot} />
      <span className={styles.label}>
        {/* The English on the check itself is the last resort, for an id this
            does not know about. */}
        <CheckLabel id={check.id} braille={braille} total={total} />
      </span>
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
