import { ErrorHandler } from "@keybr/debug";
import { ProfilesProvider, useProfiles } from "@keybr/page-account";
import {
  getPageData,
  LoadingProgress,
  PageDataContext,
  Pages,
  Root,
  usePageData,
} from "@keybr/pages-shared";
import { SettingsLoader } from "@keybr/settings-loader";
import { querySelector } from "@keybr/widget";
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
import { IntlLoader } from "./loader/IntlLoader.tsx";
import { Template } from "./Template.tsx";
import { ThemeProvider } from "./themes/ThemeProvider.tsx";
import { Title } from "./Title.tsx";

export function main() {
  createRoot(querySelector(Root.selector)).render(<App />);
}

const AccountPage = lazy(() => import("./pages/account.tsx"));
const LoginPage = lazy(() => import("./pages/login.tsx"));
const RegisterPage = lazy(() => import("./pages/register.tsx"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password.tsx"));
const HelpPage = lazy(() => import("./pages/help.tsx"));
const ProfilesManagePage = lazy(() => import("./pages/profiles.tsx"));
const KidsPage = lazy(() => import("./pages/kids.tsx"));
const LayoutsPage = lazy(() => import("./pages/layouts.tsx"));
const PracticePage = lazy(() => import("./pages/practice.tsx"));
const ProfilePage = lazy(() => import("./pages/profile.tsx"));
const TypingTestPage = lazy(() => import("./pages/typing-test.tsx"));
const TermsOfServicePage = lazy(() => import("./pages/terms-of-service.tsx"));
const PrivacyPolicyPage = lazy(() => import("./pages/privacy-policy.tsx"));
const AboutPage = lazy(() => import("./pages/about.tsx"));

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

function PageRoutes() {
  const { locale } = useIntl();
  return (
    <BrowserRouter basename={Pages.intlBase(locale)}>
      <FirstRunRedirect />
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
