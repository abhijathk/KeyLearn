import {
  assess,
  bandFor,
  type CertificateCheck,
  type CertificateEvidence,
} from "@keylearn/certificate";
import { artKindOf, ArtMotif } from "@keylearn/identicon";
import { loadKeyboard } from "@keylearn/keyboard";
import { type ProfileDetails, usePageData } from "@keylearn/pages-shared";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { type Result } from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { BrailleBadge } from "../profiles/BrailleBadge.tsx";
import { useProfiles } from "../profiles/context.tsx";
import specimenAdult from "./assets/specimen-adult.jpg";
import specimenKid from "./assets/specimen-kid.jpg";
import * as styles from "./CoursePane.module.less";
import { brailleEvidence, typingEvidence } from "./evidence.ts";

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
  const anyKid = profiles.some((p) => p.kind === "kid");
  const anyAdult = profiles.some((p) => p.kind !== "kid");

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

      {(anyAdult || anyKid) && (
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
              defaultMessage="Shown only for the kinds of learner this household has. A braille learner gets whichever of these their profile is set to — the only difference is their name repeated in grade 1 beneath it, and cells per minute where the speed goes."
            />
          </p>
          <div className={styles.sampleRow}>
            {anyAdult && (
              <Specimen
                kind="adult"
                caption="Grown-ups — speed and accuracy printed, no grade."
              />
            )}
            {anyKid && (
              <Specimen
                kind="kid"
                caption="Kids — Bronze, Silver or Gold for their age."
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
  const layout = results[0]?.layout ?? loadKeyboard(undefined as never).layout;
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
          language={String(layout)}
        />
      )}
    </PhoneticModelLoader>
  );
}

function Row({
  profile,
  evidence,
  language,
}: {
  readonly profile: ProfileDetails;
  readonly evidence: CertificateEvidence;
  readonly language?: string;
}): ReactNode {
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
          <FormattedMessage
            id="account.course.ready"
            defaultMessage="Everything the practice has to prove is proved. The assessment is what decides it."
          />
        ) : (
          <FormattedMessage
            id="account.course.outstanding"
            defaultMessage="Next: {what}."
            values={{ what: verdict.outstanding[0]?.label.toLowerCase() ?? "" }}
          />
        )}
      </div>
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
function Specimen({
  kind,
  caption,
}: {
  readonly kind: "adult" | "kid";
  readonly caption: string;
}): ReactNode {
  return (
    <figure className={styles.specimen}>
      <div className={clsx(styles.sheet, kind === "kid" && styles.sheetKid)}>
        <img
          className={styles.sheetImage}
          src={kind === "kid" ? specimenKid : specimenAdult}
          alt=""
        />
        <span className={styles.stamp}>
          <FormattedMessage
            id="account.course.specimen"
            defaultMessage="Specimen"
          />
        </span>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
