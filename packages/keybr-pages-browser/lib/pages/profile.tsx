import { ProfilePage, PublicProfilePage } from "@keybr/page-profile";
import { PublicResultLoader, ResultLoader } from "@keybr/result-loader";
import { clsx } from "clsx";
import { useState } from "react";
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

// The kids trail keeps its own local history, so a grown-up can flip to the
// Kids tab and read the child's progress with the exact same charts.
function Profile() {
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
