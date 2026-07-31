import { useProfiles } from "@keybr/page-account";
import { PracticePage } from "@keybr/page-practice";
import { usePageData } from "@keybr/pages-shared";
import { ResultLoader } from "@keybr/result-loader";
import { FormattedMessage } from "react-intl";
import { NavLink } from "react-router";

export default function Page() {
  const { publicUser } = usePageData();
  // Learning always happens under a learner profile — never the bare account.
  // The active profile's own history is loaded via its namespace.
  const { namespace, household } = useProfiles();

  // A signed-in account always gets a default profile (auto-created), so this
  // only appears if the last profile was just deleted — a gentle nudge rather
  // than dropping the learner onto the bare account. Anonymous users are
  // unaffected and practise directly, as before.
  if (publicUser.id != null && household.profiles.length === 0) {
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
        <h2>
          <FormattedMessage
            id="practice.needProfile.title"
            defaultMessage="Create a profile to start"
          />
        </h2>
        <p style={{ maxInlineSize: "30rem", color: "var(--text-color-f1)" }}>
          <FormattedMessage
            id="practice.needProfile.text"
            defaultMessage="Learning happens on a learner profile, so your progress is saved to the right person. Create one to begin — it only takes a moment."
          />
        </p>
        <NavLink to="/account" style={{ fontWeight: 700 }}>
          <FormattedMessage
            id="practice.needProfile.cta"
            defaultMessage="Go to profiles"
          />
        </NavLink>
      </div>
    );
  }

  return (
    <ResultLoader namespace={namespace}>
      <PracticePage />
    </ResultLoader>
  );
}
