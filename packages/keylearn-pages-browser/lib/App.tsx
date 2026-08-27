import { ErrorHandler } from "@keylearn/debug";
import {
  ProfilePicker,
  ProfilesProvider,
  useProfiles,
} from "@keylearn/page-account";
import {
  getPageData,
  LoadingProgress,
  PageDataContext,
  Pages,
  Root,
  startLocalSync,
  usePageData,
} from "@keylearn/pages-shared";
import { SettingsLoader } from "@keylearn/settings-loader";
import { querySelector } from "@keylearn/widget";
import { lazy, type ReactNode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useIntl } from "react-intl";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { Captions } from "./Captions.tsx";
import { CursorFog } from "./CursorFog.tsx";
import { IntlLoader } from "./loader/IntlLoader.tsx";
import { kidRestrictedRedirect, practiceRedirect } from "./surface.ts";
import { Template } from "./Template.tsx";
import { ThemeProvider } from "./themes/ThemeProvider.tsx";
import { Title } from "./Title.tsx";

export function main() {
  // Before the first render, on purpose. Packages write their defaults into
  // storage as they boot, and the mirror has to see those writes to tell a
  // default apart from something the learner chose.
  startLocalSync();
  createRoot(querySelector(Root.selector)).render(<App />);
}

const AccountPage = lazy(() => import("./pages/account.tsx"));
const JoinPage = lazy(() => import("./pages/join.tsx"));
const ForSchoolsPage = lazy(() => import("./pages/for-schools.tsx"));
const OrgDeskPage = lazy(() => import("./pages/org.tsx"));
const DeletionCancelPage = lazy(() => import("./pages/deletion-cancel.tsx"));
const DesignPage = lazy(() => import("./pages/design.tsx"));
const VerifyPage = lazy(() => import("./pages/verify.tsx"));
const AssessmentPage = lazy(() => import("./pages/assessment.tsx"));
const LoginPage = lazy(() => import("./pages/login.tsx"));
const RegisterPage = lazy(() => import("./pages/register.tsx"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password.tsx"));
const HelpPage = lazy(() => import("./pages/help.tsx"));
const SupportPage = lazy(() => import("./pages/support.tsx"));
const SupportThreadPage = lazy(() => import("./pages/support-thread.tsx"));
const HelpCentrePage = lazy(() => import("./pages/help-centre.tsx"));
const ProfilesManagePage = lazy(() => import("./pages/profiles.tsx"));
const KidsPage = lazy(() => import("./pages/kids.tsx"));
const LayoutsPage = lazy(() => import("./pages/layouts.tsx"));
const TextsPage = lazy(() => import("./pages/texts.tsx"));
const PracticePage = lazy(() => import("./pages/practice.tsx"));
const ProfilePage = lazy(() => import("./pages/profile.tsx"));
const TypingTestPage = lazy(() => import("./pages/typing-test.tsx"));
const TermsOfServicePage = lazy(() => import("./pages/terms-of-service.tsx"));
const AccessibilityPage = lazy(() => import("./pages/accessibility.tsx"));
const PrivacyPolicyPage = lazy(() => import("./pages/privacy-policy.tsx"));
const AboutPage = lazy(() => import("./pages/about.tsx"));
const GuidePage = lazy(() => import("./pages/guide.tsx"));
const HighScoresPage = lazy(() => import("./pages/high-scores.tsx"));
const BraillePage = lazy(() => import("./pages/braille.tsx"));
const MultiplayerPage = lazy(() => import("./pages/multiplayer.tsx"));

export function App() {
  return (
    <PageDataContext.Provider value={getPageData()}>
      <ErrorHandler>
        <IntlLoader>
          <ProfilesProvider>
            <ProfileScope>
              <SettingsLoader>
                <ThemeProvider>
                  <PageRoutes />
                  {/* Above every page and outside the router, because speech
                      does not stop at a page boundary and neither should the
                      writing-down of it. */}
                  <Captions />
                  {/* Inside ThemeProvider, because the fog is painted in the
                      learner's own accent and reads it off the live custom
                      property. Outside the router, because a page change is
                      not a reason for a trail to blink out. */}
                  <CursorFog />
                </ThemeProvider>
              </SettingsLoader>
            </ProfileScope>
          </ProfilesProvider>
        </IntlLoader>
      </ErrorHandler>
    </PageDataContext.Provider>
  );
}

// Each household profile behaves like its own account: when the active
// profile changes, the whole subtree remounts so settings, result histories
// and game state all reload from that profile's storage.
function ProfileScope({ children }: { readonly children: ReactNode }) {
  const { active } = useProfiles();
  return (
    <div key={active?.id ?? "none"} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

// After a fresh sign-in with no learner profiles on this device, the account
// window opens once as a reminder to set the household up. With profiles
// present (or after that one nudge) the app lands straight on practice.
function FirstRunRedirect(): ReactNode {
  const { publicUser } = usePageData();
  const { household } = useProfiles();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const id = publicUser.id;
    if (id == null || household.profiles.length > 0 || pathname !== "/") {
      return;
    }
    const key = `keylearn.welcomed.${id}`;
    try {
      if (sessionStorage.getItem(key) != null) {
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    navigate(Pages.account.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * Keeps every learner on their own practice surface: a kid never reaches the
 * adult drills, a grown-up never lands in the kids game, and a learner on
 * vision support only ever sees braille — in every direction.
 *
 * Every switcher already routes each profile to the right page, but a
 * bookmark, the back button, a typed URL or a stale tab all bypass that — and
 * landing on the wrong drill either shows a page that is unusable or quietly
 * writes progress into the wrong curriculum. The guard is on the route rather
 * than on each entry point so there is one answer, not four. (The rules live
 * in surface.ts.)
 */
function PracticeSurfaceGuard(): ReactNode {
  const { active } = useProfiles();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const home = practiceRedirect(active, pathname);
  useEffect(() => {
    if (home != null) {
      navigate(home, { replace: true });
    }
  }, [home, navigate]);
  return null;
}

/**
 * Keeps a kid profile out of account settings and profile management —
 * both hold the household owner's PII, a delete-account control, and an
 * edit action on every profile. The nav drawer already locks the link to
 * either page while a kid is active, but that's a UI affordance, not a
 * boundary: a bookmark, a typed URL, or the back button reaches the route
 * directly regardless. Same shape as {@link PracticeSurfaceGuard}, and for
 * the same reason — the guard belongs on the route, not on each entry
 * point, so there is one answer instead of however many ways in exist.
 */
function KidAccountGuard(): ReactNode {
  const { active } = useProfiles();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const home = kidRestrictedRedirect(active, pathname);
  useEffect(() => {
    if (home != null) {
      navigate(home, { replace: true });
    }
  }, [home, navigate]);
  return null;
}

function PageRoutes() {
  const { locale } = useIntl();
  return (
    <BrowserRouter basename={Pages.intlBase(locale)}>
      <FirstRunRedirect />
      <PracticeSurfaceGuard />
      <KidAccountGuard />
      <ProfilePicker />
      <Routes>
        <Route
          index={true}
          path={Pages.practice.path}
          element={
            <Template path={Pages.practice.path}>
              <Title page={Pages.practice} />
              <Suspense fallback={<LoadingProgress />}>
                <PracticePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.org.path}
          element={
            <Template path={Pages.org.path}>
              <Title page={Pages.org} />
              <Suspense fallback={<LoadingProgress />}>
                <OrgDeskPage />
              </Suspense>
            </Template>
          }
        />
        {/* The one org page a visitor can find on their own. Public,
            no sign-in, and not a second way to log in — see spec §8. */}
        <Route
          path={Pages.forSchools.path}
          element={
            <Template path={Pages.forSchools.path}>
              <Title page={Pages.forSchools} />
              <Suspense fallback={<LoadingProgress />}>
                <ForSchoolsPage />
              </Suspense>
            </Template>
          }
        />
        {/* The invite link. Only reachable with a token — there is no
            path to it by clicking around, which is the invite-only rule
            (docs/organisations.md §5.3) expressed as routing. */}
        <Route
          path={`${Pages.join.path}/:token`}
          element={
            <Template path={Pages.join.path}>
              <Title page={Pages.join} />
              <Suspense fallback={<LoadingProgress />}>
                <JoinPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.account.path}
          element={
            <Template path={Pages.account.path}>
              <Title page={Pages.account} />
              <Suspense fallback={<LoadingProgress />}>
                <AccountPage />
              </Suspense>
            </Template>
          }
        />
        {/* Two routes for one page: the bare form, and a link somebody was
            handed with the number already in it. */}
        {[Pages.verify.path, `${Pages.verify.path}/:number`].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <Template path={Pages.verify.path}>
                <Title page={Pages.verify} />
                <Suspense fallback={<LoadingProgress />}>
                  <VerifyPage />
                </Suspense>
              </Template>
            }
          />
        ))}
        <Route
          path={Pages.assessment.path}
          element={
            <Template path={Pages.assessment.path}>
              <Title page={Pages.assessment} />
              <Suspense fallback={<LoadingProgress />}>
                <AssessmentPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.design.path}
          element={
            <Template path={Pages.design.path}>
              <Title page={Pages.design} />
              <Suspense fallback={<LoadingProgress />}>
                <DesignPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.help.path}
          element={
            <Template path={Pages.help.path}>
              <Title page={Pages.help} />
              <Suspense fallback={<LoadingProgress />}>
                <HelpPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.support.path}
          element={
            <Template path={Pages.support.path}>
              <Title page={Pages.support} />
              <Suspense fallback={<LoadingProgress />}>
                <SupportPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.helpCentre.path}
          element={
            <Template path={Pages.helpCentre.path}>
              <Title page={Pages.helpCentre} />
              <Suspense fallback={<LoadingProgress />}>
                <HelpCentrePage />
              </Suspense>
            </Template>
          }
        />
        {/* The customer's own conversation, reached by the token in our
            emails — a public route, no sign-in, since a signed-out guest
            has no other way back to it. */}
        <Route
          path={`${Pages.supportThread.path}/:token`}
          element={
            <Template path={Pages.supportThread.path}>
              <Title page={Pages.supportThread} />
              <Suspense fallback={<LoadingProgress />}>
                <SupportThreadPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={`${Pages.deletionCancel.path}/:token`}
          element={
            <Template path={Pages.deletionCancel.path}>
              <Title page={Pages.deletionCancel} />
              <Suspense fallback={<LoadingProgress />}>
                <DeletionCancelPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.profiles.path}
          element={
            <Template path={Pages.profiles.path}>
              <Title page={Pages.profiles} />
              <Suspense fallback={<LoadingProgress />}>
                <ProfilesManagePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.login.path}
          element={
            <Template path={Pages.login.path}>
              <Title page={Pages.login} />
              <Suspense fallback={<LoadingProgress />}>
                <LoginPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.register.path}
          element={
            <Template path={Pages.register.path}>
              <Title page={Pages.register} />
              <Suspense fallback={<LoadingProgress />}>
                <RegisterPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.forgotPassword.path}
          element={
            <Template path={Pages.forgotPassword.path}>
              <Title page={Pages.forgotPassword} />
              <Suspense fallback={<LoadingProgress />}>
                <ForgotPasswordPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={`${Pages.resetPassword.path}/:token`}
          element={
            <Template path={Pages.resetPassword.path}>
              <Title page={Pages.resetPassword} />
              <Suspense fallback={<LoadingProgress />}>
                <ResetPasswordPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.kids.path}
          element={
            <Template path={Pages.kids.path}>
              <Title page={Pages.kids} />
              <Suspense fallback={<LoadingProgress />}>
                <KidsPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.highScores.path}
          element={
            <Template path={Pages.highScores.path}>
              <Title page={Pages.highScores} />
              <Suspense fallback={<LoadingProgress />}>
                <HighScoresPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.braille.path}
          element={
            <Template path={Pages.braille.path}>
              <Title page={Pages.braille} />
              <Suspense fallback={<LoadingProgress />}>
                <BraillePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.multiplayer.path}
          element={
            <Template path={Pages.multiplayer.path}>
              <Title page={Pages.multiplayer} />
              <Suspense fallback={<LoadingProgress />}>
                <MultiplayerPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.layouts.path}
          element={
            <Template path={Pages.layouts.path}>
              <Title page={Pages.layouts} />
              <Suspense fallback={<LoadingProgress />}>
                <LayoutsPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.texts.path}
          element={
            <Template path={Pages.texts.path}>
              <Title page={Pages.texts} />
              <Suspense fallback={<LoadingProgress />}>
                <TextsPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={`${Pages.profile.path}`}
          element={
            <Template path={Pages.profile.path}>
              <Title page={Pages.profile} />
              <Suspense fallback={<LoadingProgress />}>
                <ProfilePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={`${Pages.profile.path}/:userId`}
          element={
            <Template path={Pages.profile.path}>
              <Title page={Pages.profile} />
              <Suspense fallback={<LoadingProgress />}>
                <ProfilePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.typingTest.path}
          element={
            <Template path={Pages.typingTest.path}>
              <Title page={Pages.typingTest} />
              <Suspense fallback={<LoadingProgress />}>
                <TypingTestPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.termsOfService.path}
          element={
            <Template path={Pages.termsOfService.path}>
              <Title page={Pages.termsOfService} />
              <Suspense fallback={<LoadingProgress />}>
                <TermsOfServicePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.accessibility.path}
          element={
            <Template path={Pages.accessibility.path}>
              <Title page={Pages.accessibility} />
              <Suspense fallback={<LoadingProgress />}>
                <AccessibilityPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.privacyPolicy.path}
          element={
            <Template path={Pages.privacyPolicy.path}>
              <Title page={Pages.privacyPolicy} />
              <Suspense fallback={<LoadingProgress />}>
                <PrivacyPolicyPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.about.path}
          element={
            <Template path={Pages.about.path}>
              <Title page={Pages.about} />
              <Suspense fallback={<LoadingProgress />}>
                <AboutPage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path={Pages.guide.path}
          element={
            <Template path={Pages.guide.path}>
              <Title page={Pages.guide} />
              <Suspense fallback={<LoadingProgress />}>
                <GuidePage />
              </Suspense>
            </Template>
          }
        />
        <Route
          path="*"
          element={
            <Template path={Pages.practice.path}>
              <Title page={Pages.practice} />
              <Suspense fallback={<LoadingProgress />}>
                <PracticePage />
              </Suspense>
            </Template>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
