import {
  historyNamespace,
  ProfileAvatar,
  useProfiles,
} from "@keybr/page-account";
import { ProfilePage, PublicProfilePage } from "@keybr/page-profile";
import { usePageData } from "@keybr/pages-shared";
import { PublicResultLoader, ResultLoader } from "@keybr/result-loader";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
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

function LearnerTabs(): ReactNode {
  const { household, active } = useProfiles();
  const [selectedId, setSelectedId] = useState(
    active?.id ?? household.profiles[0].id,
  );
  const selected =
    household.profiles.find((p) => p.id === selectedId) ??
    household.profiles[0];
  return (
    <>
      <div className={styles.tabs}>
        {household.profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={clsx(styles.tab, p.id === selected.id && styles.on)}
            onClick={() => setSelectedId(p.id)}
          >
            <span className={styles.tabAvatar}>
              <ProfileAvatar avatar={p.avatar} name={p.firstName} size={20} />
            </span>
            {p.firstName}
          </button>
        ))}
      </div>
      <div className={styles.note}>
        {selected.kind === "kid" ? (
          <FormattedMessage
            id="profile.tab.learnerKidNote"
            defaultMessage="{name}'s progress on the dino trail, in the same charts."
            values={{ name: selected.firstName }}
          />
        ) : (
          <FormattedMessage
            id="profile.tab.learnerNote"
            defaultMessage="{name}'s typing progress on this device."
            values={{ name: selected.firstName }}
          />
        )}
      </div>
      <ResultLoader key={selected.id} namespace={historyNamespace(selected)}>
        <ProfilePage />
      </ResultLoader>
    </>
  );
}

// The kids trail keeps its own local history, so a grown-up can flip to the
// Kids tab and read the child's progress with the exact same charts.
function ModeTabs(): ReactNode {
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
      {kids && (
        <div className={styles.note}>
          <FormattedMessage
            id="profile.tab.kidsNote"
            defaultMessage="Everything typed on the kids dino trail, in the same charts."
          />
        </div>
      )}
      <ResultLoader key={kids ? "kids" : "me"} kids={kids}>
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
