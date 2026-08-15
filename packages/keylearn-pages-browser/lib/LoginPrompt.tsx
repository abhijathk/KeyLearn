import { Pages, usePageData } from "@keylearn/pages-shared";
import { Button, FloatingShell } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import loginPromptBanner from "../assets/login-prompt-banner.png";
import loginPromptBannerLight from "../assets/login-prompt-banner-light.png";
import * as styles from "./LoginPrompt.module.less";

const LAST_SHOWN_KEY = "keylearn.loginPromptLastShown";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Once per day, not once per visit — a fresh-every-reload prompt turned out
// to be more nag than nudge. A day is long enough that it's never the same
// session, short enough that it isn't forgotten between visits.
function dueToShow(): boolean {
  try {
    const last = localStorage.getItem(LAST_SHOWN_KEY);
    return last == null || Date.now() - Number(last) > ONE_DAY_MS;
  } catch {
    // Storage unavailable (private mode, an embedded webview) — show it;
    // there's no way to remember we already did.
    return true;
  }
}

function markShown(): void {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // Storage may be unavailable; the prompt will simply show again.
  }
}

// Pages where a signed-out visitor is doing something other than practicing
// — reading a policy, already on the auth flow, in the kids surface — so the
// prompt would only be in the way.
const EXCLUDED_PATHS: readonly string[] = [
  Pages.login.path,
  Pages.register.path,
  Pages.forgotPassword.path,
  Pages.resetPassword.path,
  Pages.kids.path,
  Pages.verify.path,
  Pages.support.path,
  Pages.supportDesk.path,
  Pages.termsOfService.path,
  Pages.privacyPolicy.path,
  Pages.accessibility.path,
  Pages.about.path,
  Pages.help.path,
  Pages.guide.path,
];

/**
 * A dismissible prompt for a signed-out visitor, shown at most once a day
 * (localStorage-remembered, like NoticeBanner's dismissal — but on a timer
 * rather than an id, since this has no server-side identity to key off of).
 * Closing it doesn't block practice; it's here to explain what an account
 * is for before a lesson or two makes that obvious on its own.
 */
export function LoginPrompt({ path }: { readonly path: string }): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { user } = usePageData();
  const [dismissed, setDismissed] = useState(() => !dueToShow());

  const excluded = EXCLUDED_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  const willShow = user == null && !dismissed && !excluded;

  useEffect(() => {
    if (willShow) {
      markShown();
    }
    // Fires when willShow flips to true, not on every render while it
    // stays true — landing on an excluded page first and then navigating
    // to an eligible one in the same visit still gets remembered correctly.
  }, [willShow]);

  if (!willShow) {
    return null;
  }

  const dismiss = () => setDismissed(true);

  return (
    <FloatingShell
      compact={true}
      hideClose={true}
      onClose={dismiss}
      closeLabel={formatMessage({
        id: "loginPrompt.dismiss",
        defaultMessage: "Continue without an account",
      })}
    >
      <img className={styles.banner} src={loginPromptBanner} alt="" />
      <img className={styles.bannerLight} src={loginPromptBannerLight} alt="" />
      <h1 className={styles.title}>
        <FormattedMessage
          id="loginPrompt.title"
          defaultMessage="Create a free account"
        />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="loginPrompt.intro"
          defaultMessage="It only takes a moment, and it's free."
        />
      </p>
      <ul className={styles.benefits}>
        <li>
          <FormattedMessage
            id="loginPrompt.benefitSync"
            defaultMessage="Keep your progress synced on every device"
          />
        </li>
        <li>
          <FormattedMessage
            id="loginPrompt.benefitProgress"
            defaultMessage="Watch your speed and accuracy improve over time"
          />
        </li>
        <li>
          <FormattedMessage
            id="loginPrompt.benefitHousehold"
            defaultMessage="Add a profile for each learner in your household"
          />
        </li>
        <li>
          <FormattedMessage
            id="loginPrompt.benefitCertificates"
            defaultMessage="Earn certificates as you complete lessons"
          />
        </li>
      </ul>
      <div className={styles.primary}>
        <Button
          size="full"
          label={formatMessage({
            id: "loginPrompt.register",
            defaultMessage: "Create account",
          })}
          onClick={() => navigate(Pages.register.path)}
        />
      </div>
      <div className={styles.links}>
        <span className={styles.linkRow}>
          <FormattedMessage
            id="auth.haveAccount"
            defaultMessage="Already have an account?"
          />{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => navigate(Pages.login.path)}
          >
            <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
          </button>
        </span>
        <button type="button" className={styles.skip} onClick={dismiss}>
          <FormattedMessage
            id="loginPrompt.continue"
            defaultMessage="Continue without an account"
          />
        </button>
      </div>
    </FloatingShell>
  );
}
