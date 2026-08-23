import {
  BrailleAvatar,
  BrailleBadge,
  useProfiles,
} from "@keylearn/page-account";
import {
  BrailleProfileScreen,
  openReport,
  openShare,
  ProfilePage,
  PublicProfilePage,
} from "@keylearn/page-profile";
import {
  accessibilityActive,
  Avatar,
  courseNamespace,
  courseOf,
  Screen,
  usePageData,
} from "@keylearn/pages-shared";
import {
  openResultStorage,
  PublicResultLoader,
  ResultLoader,
} from "@keylearn/result-loader";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useParams } from "react-router";
import { ProfileLoader } from "../loader/ProfileLoader.tsx";
import * as styles from "./profile-tabs.module.less";

export default function Page() {
  const { userId = "me" } = useParams();
  if (userId === "me") {
    return <Profile />;
  } else {
    return <PublicProfile userId={userId} />;
  }
}

// With a signed-in household the tabs are the learners themselves — one per
// profile, each reading that learner's own history. Without profiles we keep
// the plain Grown-up / Kids split.
function Profile(): ReactNode {
  const { publicUser } = usePageData();
  const { household, active } = useProfiles();
  const signedIn = publicUser.id != null;
  if (signedIn && household.profiles.length > 0) {
    return <LearnerTabs />;
  }
  return <ModeTabs />;
}

/**
 * Whether this learner has anything under Classic.
 *
 * Asked of the history rather than of the current setting: a learner who did
 * Classic for a term and has since moved back to guided practice still did the
 * work, and a page that hid it would be reporting less than it knows.
 */
function useHasClassic(profileId: string, kid: boolean): boolean {
  const { publicUser } = usePageData();
  const [has, setHas] = useState(() => courseOf(profileId) === "classic");
  useEffect(() => {
    let cancelled = false;
    // Answer for this learner before asking the disk about them. The initial
    // state is computed once, at mount, for whoever was selected then — so
    // switching to a sibling kept the first learner's answer and the filter
    // never appeared for the one who needed it.
    setHas(courseOf(profileId) === "classic");
    void (async () => {
      try {
        const storage = openResultStorage({
          type: "private",
          userId: publicUser.id ?? null,
          kids: kid,
          namespace: courseNamespace(profileId, "classic"),
        });
        const loaded = await storage.load();
        if (!cancelled && loaded.length > 0) {
          setHas(true);
        }
      } catch {
        // Leave it at whatever the setting said. A history that will not open
        // is not evidence that there is none.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, kid, publicUser.id]);
  return has;
}

function LearnerTabs(): ReactNode {
  const { publicUser } = usePageData();
  const { household, active } = useProfiles();
  const [selectedId, setSelectedId] = useState(
    active?.id ?? household.profiles[0].id,
  );
  const selected =
    household.profiles.find((p) => p.id === selectedId) ??
    household.profiles[0];
  // Which course is on screen. Classic is its own course — its own letters in
  // its own order, its own history — so its speed and its lesson count belong
  // beside guided practice, not mixed into it. Reset whenever the learner
  // changes: the course one child is on says nothing about the next.
  const [course, setCourse] = useState(() => courseOf(selected.id));
  useEffect(() => {
    setCourse(courseOf(selectedId));
  }, [selectedId]);
  const hasClassic = useHasClassic(selected.id, selected.kind === "kid");
  return (
    <>
      <Screen className={styles.tabScreen}>
        <div className={styles.tabRow}>
          {/*
          Whose account this is, named beside the learners rather than nowhere.
          On a household device the account holder is the only thing that says
          which family's progress is on screen.
        */}
          <div className={styles.accountBlock}>
            <div className={styles.account}>
              <Avatar user={publicUser} size="normal" />
              <div>
                <span className={styles.accountName}>{publicUser.name}</span>
                <span className={styles.accountRole}>
                  <FormattedMessage
                    id="profile.tab.accountHolder"
                    defaultMessage="Account holder"
                  />
                </span>
              </div>
            </div>
            {/* Under the whole block rather than inside the name column: putting
              them beside the name shifted the avatar and the name out of the
              alignment they already had. Small on purpose — these are
              occasional actions, and the learner tabs are the navigation. */}
            <div className={styles.accountActions}>
              <button
                type="button"
                className={styles.miniAction}
                onClick={() => openReport()}
              >
                <FormattedMessage
                  id="profile.saveReport"
                  defaultMessage="⤓ Save a report"
                />
              </button>
              <button
                type="button"
                className={styles.miniAction}
                onClick={() => openShare()}
              >
                <FormattedMessage
                  id="profile.shareProgress"
                  defaultMessage="↗ Share progress"
                />
              </button>
            </div>
          </div>
          {/* One learner is not a choice — the same rule the course filter
              below already follows. A single tab cannot be switched away
              from, and it repeats a name the heading underneath already
              says, so it is furniture with a click target. */}
          {household.profiles.length > 1 && (
            <div className={styles.tabs}>
              {household.profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={clsx(
                    styles.tab,
                    p.id === selected.id && styles.on,
                  )}
                  onClick={() => setSelectedId(p.id)}
                >
                  {/*
                No avatar on the tabs: at this size a lettered disc beside the
                name is the same letter twice. The braille badge does stay,
                because it is the one marker that says something the name does
                not — that this learner gets a different page and a voice.
              */}
                  {p.visionSupport && (
                    <span className={styles.tabAvatar}>
                      <BrailleBadge />
                    </span>
                  )}
                  {p.firstName}
                </button>
              ))}
            </div>
          )}
        </div>
        {/*
          No caption under the tabs. The selected tab already says whose page
          this is, and a line repeating the name on every switch was a caption
          that told the reader nothing they had not just clicked.
        */}
        {/* Shown only to a learner who has both. One course is not a choice,
            and a filter with a single option is furniture. */}
        {hasClassic && !selected.visionSupport && (
          <div className={styles.courseRow} role="group">
            <button
              type="button"
              className={clsx(
                styles.course,
                course === "guided" && styles.courseOn,
              )}
              aria-pressed={course === "guided"}
              onClick={() => setCourse("guided")}
            >
              <FormattedMessage
                id="profile.course.guided"
                defaultMessage="Guided practice"
              />
            </button>
            <button
              type="button"
              className={clsx(
                styles.course,
                course === "classic" && styles.courseOn,
              )}
              aria-pressed={course === "classic"}
              onClick={() => setCourse("classic")}
            >
              <FormattedMessage
                id="profile.course.classic"
                defaultMessage="Classic"
              />
            </button>
          </div>
        )}
      </Screen>
      {/*
        Same page, same tabs, same chrome — the content is what differs. A
        braille learner produces no typing results, so the ordinary charts
        would every one read zero.
      */}
      {selected.visionSupport ? (
        <BrailleProfileScreen
          profileId={selected.id}
          name={selected.firstName}
          kid={selected.kind === "kid"}
          avatar={
            <BrailleAvatar
              avatar={selected.avatar}
              name={selected.firstName}
              size={42}
              braille={selected.visionSupport}
              accessible={accessibilityActive(selected.id)}
            />
          }
        />
      ) : (
        <ResultLoader
          key={`${selected.id}:${course}`}
          namespace={courseNamespace(selected.id, course)}
          profileName={selected.firstName}
          kidProfile={selected.kind === "kid"}
          profileBirthYear={selected.birthYear}
          profileAvatar={
            <BrailleAvatar
              avatar={selected.avatar}
              name={selected.firstName}
              size={42}
              braille={selected.visionSupport}
              accessible={accessibilityActive(selected.id)}
            />
          }
        >
          <ProfilePage />
        </ResultLoader>
      )}
    </>
  );
}

// The kids trail keeps its own local history, so a grown-up can flip to the
// Kids tab and read the child's progress with the exact same charts.
function ModeTabs(): ReactNode {
  const { publicUser } = usePageData();
  const [kids, setKids] = useState(false);
  return (
    <>
      <div className={styles.tabs}>
        <button
          type="button"
          className={clsx(styles.tab, !kids && styles.on)}
          onClick={() => setKids(false)}
        >
          <FormattedMessage
            id="profile.tab.grownUp"
            defaultMessage="Grown-up"
          />
        </button>
        <button
          type="button"
          className={clsx(styles.tab, kids && styles.on)}
          onClick={() => setKids(true)}
        >
          <FormattedMessage id="profile.tab.kids" defaultMessage="Kids" />
        </button>
      </div>
      <ResultLoader
        key={kids ? "kids" : "me"}
        kids={kids}
        profileName={kids ? "kids" : (publicUser.name ?? null)}
      >
        <ProfilePage />
      </ResultLoader>
    </>
  );
}

function PublicProfile({ userId }: { readonly userId: string }) {
  return (
    <ProfileLoader userId={userId}>
      {(user) => (
        <PublicResultLoader user={user}>
          <PublicProfilePage user={user} />
        </PublicResultLoader>
      )}
    </ProfileLoader>
  );
}
