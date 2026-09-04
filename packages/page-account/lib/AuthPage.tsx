import {
  Pages,
  PROFILE_NAME_MAX,
  usePageData,
  usePageOffered,
} from "@keylearn/pages-shared";
import { Button, CheckBox, Icon, TextField } from "@keylearn/widget";
import { AnimatedHeight, FloatingShell } from "@keylearn/widget";
import {
  mdiAccountPlus,
  mdiCheckDecagramOutline,
  mdiEmailFastOutline,
  mdiKeyVariant,
  mdiLoginVariant,
} from "@mdi/js";
import { clsx } from "clsx";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import {
  defineMessage,
  FormattedMessage,
  type MessageDescriptor,
  useIntl,
} from "react-intl";
import * as styles from "./AuthPage.module.less";
import { DobEntry, type DobResult, GrownUpGate } from "./DobEntry.tsx";
import { PasswordStrength } from "./PasswordStrength.tsx";
import { AccountService } from "./service.ts";
import { isCaptchaRequired, useCaptcha } from "./turnstile.tsx";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "magic";

/**
 * True when the card is already flying an organisation's colours — the
 * join page. The signpost asks "running a school?" of someone a school
 * has just invited, which is noise at best, so it stands down.
 */
const InvitedContext = createContext(false);

/**
 * What the OAuth callback bounced back with, if anything.
 *
 * Every one of these is a redirect the server can send, and each needs saying
 * out loud — a redirect that lands on an unchanged form reads to the visitor as
 * "nothing happened", which is exactly how a working flow gets reported as
 * broken.
 */
function ssoParam(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("sso");
}

function ssoEmail(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("email");
}

/**
 * Where a successful sign-in lands, when the caller asked for somewhere
 * other than home — e.g. the staff desk's own sign-in screen, bounced back
 * to after an ordinary email/password login. Only an internal path is
 * honoured; anything that would leave the app's own origin is not.
 *
 * This resolves through the URL parser rather than checking the raw string
 * with startsWith("/")/startsWith("//") — that check alone is not enough.
 * The browser normalises a backslash to a forward slash for special schemes
 * before it navigates, and strips embedded tab/CR/LF first, so a value like
 * "/\evil.com" or a path with an encoded tab in it starts with one slash,
 * not two, yet still resolves to a scheme-relative "//evil.com" once handed
 * to location.href — the exact string check this used to do would let it
 * through. Letting the URL constructor do the same normalisation the
 * browser will do anyway, then comparing the resolved origin, closes that.
 */
function loginReturnTo(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (raw == null) {
    return "/";
  }
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return "/";
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}

function reload(url: string) {
  window.location.href = url;
}

/**
 * All the auth screens live in one compact floating window. Switching between
 * them swaps the form in place (with the window gliding to the new height) and
 * rewrites the URL, so /login and /register stay deep-linkable without a
 * jarring page swap.
 */
export function AuthPage({
  mode: initialMode,
  token,
  banner,
}: {
  readonly mode: AuthMode;
  readonly token?: string;
  /**
   * Rendered inside the card, above the form. The join page puts the
   * invite band here rather than beside the card, because the card is a
   * modal: anything outside it sits behind the scrim, and a parent
   * cannot read which school invited them through a blur.
   */
  readonly banner?: ReactNode;
}): ReactNode {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [carriedEmail, setCarriedEmail] = useState("");

  const go = (next: AuthMode, path: string) => {
    setMode(next);
    window.history.replaceState({}, "", path);
  };
  const toLogin = () => go("login", Pages.login.path);
  const toRegister = () => go("register", Pages.register.path);
  const toRegisterWith = (email: string) => {
    setCarriedEmail(email);
    toRegister();
  };
  const toForgot = () => go("forgot", Pages.forgotPassword.path);
  const toMagic = () => go("magic", Pages.login.path);

  return (
    <InvitedContext value={banner != null}>
      <FloatingShell compact={true}>
        {banner}
        <AnimatedHeight>
          <div key={mode} className={styles.swap}>
            {mode === "register" ? (
              <RegisterForm toLogin={toLogin} email={carriedEmail} />
            ) : mode === "forgot" ? (
              <ForgotForm toLogin={toLogin} />
            ) : mode === "reset" ? (
              <ResetForm token={token ?? ""} />
            ) : mode === "magic" ? (
              <MagicForm toLogin={toLogin} />
            ) : (
              <LoginForm
                toRegisterWith={toRegisterWith}
                toForgot={toForgot}
                toMagic={toMagic}
              />
            )}
          </div>
        </AnimatedHeight>
      </FloatingShell>
    </InvitedContext>
  );
}

/**
 * The one organisation thing on this screen — docs/organisations.md §5.3.
 *
 * A signpost to an information page, NOT a way to sign in: there is no
 * organisation login to offer, because staff credentials only ever come
 * from an accepted invite. So it is a sentence rather than a control,
 * below the form and under a hairline, where the eye reaches it only
 * after the buttons above have been read and found to be for somebody
 * else. A button in the stack would read as a fifth way to log in and
 * send families down a dead end.
 */
function ForSchoolsSignpost(): ReactNode {
  const offered = usePageOffered();
  if (useContext(InvitedContext)) {
    return null;
  }
  // The signpost goes wherever the page goes. A link that 404s is worse than
  // no link at all, and while the schools tier is unreleased this offers
  // something we cannot yet honour.
  if (!offered("forSchools")) {
    return null;
  }
  return (
    <p className={styles.signpost}>
      <FormattedMessage
        id="auth.forSchools"
        defaultMessage="Running a school or community class?"
      />{" "}
      <a href={Pages.forSchools.path}>
        <FormattedMessage
          id="auth.forSchools.link"
          defaultMessage="KeyLearn for schools"
        />
      </a>
    </p>
  );
}

function ModeTitle({ mode }: { readonly mode: AuthMode }): ReactNode {
  switch (mode) {
    case "register":
      return (
        <FormattedMessage
          id="auth.register.submit"
          defaultMessage="Create account"
        />
      );
    case "forgot":
      return (
        <FormattedMessage
          id="auth.forgot.title"
          defaultMessage="Reset your password"
        />
      );
    case "reset":
      return (
        <FormattedMessage
          id="auth.reset.title"
          defaultMessage="Choose a new password"
        />
      );
    case "magic":
      return (
        <FormattedMessage
          id="auth.magic.title"
          defaultMessage="Sign in with a link"
        />
      );
    default:
      return (
        <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
      );
  }
}

// The official multicolour Google mark, drawn inline so it is always crisp
// and never fetched from a CDN.
function GoogleMark(): ReactNode {
  return (
    <svg className={styles.oauthMark} viewBox="0 0 48 48" aria-hidden={true}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// The Microsoft four-square logo, drawn inline.
function MicrosoftMark(): ReactNode {
  return (
    <svg className={styles.oauthMark} viewBox="0 0 21 21" aria-hidden={true}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

// A person with a key — the mark platforms use for passkey sign-in, so it is
// recognisable rather than merely decorative.
function PasskeyMark(): ReactNode {
  return (
    <svg
      className={styles.passkeyMark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <circle cx="9" cy="7.5" r="3.6" />
      <path d="M2.5 20.5c0-3.6 2.9-6 6.5-6 .9 0 1.7.1 2.5.4" />
      <circle cx="17.2" cy="14.6" r="2.6" />
      <path d="M17.2 17.2v4.1m0-1.5h1.9m-1.9-1.4h1.9" />
    </svg>
  );
}

// The Facebook "f" mark, drawn inline.
function FacebookMark(): ReactNode {
  return (
    <svg className={styles.oauthMark} viewBox="0 0 24 24" aria-hidden={true}>
      <path
        fill="#1877f2"
        d="M24 12a12 12 0 1 0-13.875 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.469h-2.796v8.385A12.003 12.003 0 0 0 24 12z"
      />
    </svg>
  );
}

function OAuthButton({
  mark,
  label,
  provider,
  intent,
}: {
  readonly mark: ReactNode;
  readonly label: string;
  readonly provider: string;
  readonly intent: "login" | "register";
}) {
  return (
    <button
      type="button"
      className={styles.oauthBtn}
      onClick={() => {
        document.location = `/auth/oauth-init/${provider}?intent=${intent}`;
      }}
    >
      {mark}
      {label}
    </button>
  );
}

// Provider metadata: logo mark + button wording. Keys match the OAuth adapter
// names (/auth/oauth-init/{provider}).
const PROVIDERS: Record<
  string,
  {
    readonly mark: ReactNode;
    readonly login: MessageDescriptor;
    readonly register: MessageDescriptor;
  }
> = {
  google: {
    mark: <GoogleMark />,
    login: defineMessage({
      id: "auth.continueWithGoogle",
      defaultMessage: "Continue with Google",
    }),
    register: defineMessage({
      id: "auth.registerWithGoogle",
      defaultMessage: "Sign up with Google",
    }),
  },
  microsoft: {
    mark: <MicrosoftMark />,
    login: defineMessage({
      id: "auth.continueWithMicrosoft",
      defaultMessage: "Continue with Microsoft",
    }),
    register: defineMessage({
      id: "auth.registerWithMicrosoft",
      defaultMessage: "Sign up with Microsoft",
    }),
  },
  facebook: {
    mark: <FacebookMark />,
    login: defineMessage({
      id: "auth.continueWithFacebook",
      defaultMessage: "Continue with Facebook",
    }),
    register: defineMessage({
      id: "auth.registerWithFacebook",
      defaultMessage: "Sign up with Facebook",
    }),
  },
};

// The stack of one-tap sign-in providers, shared by the log-in and register
// forms. Only providers configured on this deployment (from page data) are
// shown; `register` only changes the button wording. Renders nothing (and no
// divider) when no provider is configured.
function SocialButtons({ register }: { readonly register: boolean }) {
  const { formatMessage } = useIntl();
  const configured = usePageData().oauthProviders ?? ["google"];
  const list = ["google", "microsoft", "facebook"].filter(
    (p) => configured.includes(p) && PROVIDERS[p] != null,
  );
  if (list.length === 0) {
    return null;
  }
  return (
    <>
      <div className={styles.social}>
        {list.map((p) => (
          <OAuthButton
            key={p}
            provider={p}
            intent={register ? "register" : "login"}
            mark={PROVIDERS[p].mark}
            label={formatMessage(
              register ? PROVIDERS[p].register : PROVIDERS[p].login,
            )}
          />
        ))}
      </div>
    </>
  );
}

function LinkButton({
  onClick,
  children,
}: {
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      {children}
    </button>
  );
}

function EyeIcon({ off }: { readonly off: boolean }): ReactNode {
  return (
    <svg
      className={styles.eye}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
          <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3 3.6M6.1 6.1A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

// A password input with a reveal toggle and a live Caps-Lock warning — small
// touches that matter most for learners still hunting for keys.
export function PasswordField({
  value,
  placeholder,
  autoComplete,
  onChange,
}: {
  readonly value: string;
  readonly placeholder: string;
  readonly autoComplete: string;
  readonly onChange: (value: string) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const track = (ev: KeyboardEvent<Element>) => {
    setCaps(ev.getModifierState?.("CapsLock") ?? false);
  };
  return (
    <>
      <div className={styles.pwWrap}>
        <TextField
          size="full"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          onKeyUp={track}
          onKeyDown={track}
          style={{ paddingInlineEnd: "2.6rem" }}
        />
        <button
          type="button"
          className={styles.pwToggle}
          tabIndex={-1}
          aria-label={formatMessage(
            show
              ? defineMessage({
                  id: "auth.hidePassword",
                  defaultMessage: "Hide password",
                })
              : defineMessage({
                  id: "auth.showPassword",
                  defaultMessage: "Show password",
                }),
          )}
          onClick={() => {
            setShow((v) => !v);
          }}
        >
          <EyeIcon off={show} />
        </button>
      </div>
      {caps && (
        <p className={styles.caps}>
          <FormattedMessage
            id="auth.capsLock"
            defaultMessage="Caps Lock is on"
          />
        </p>
      )}
    </>
  );
}

function LoginForm({
  toRegisterWith,
  toForgot,
  toMagic,
}: {
  readonly toRegisterWith: (email: string) => void;
  readonly toForgot: () => void;
  readonly toMagic: () => void;
}) {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(
    ssoParam() === "verify" ? ssoEmail() : null,
  );
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [remember, setRemember] = useState(true);
  const captcha = useCaptcha();
  const sso = ssoParam();
  // Email first: ask who they are, then ask only for what that address needs.
  const [step, setStep] = useState<"email" | "password">("email");
  const [known, setKnown] = useState<AccountService.Lookup | null>(null);

  const identify = () => {
    if (email.trim() === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.lookup({
      email: email.trim(),
      turnstileToken: captcha.token,
    })
      .then((result) => {
        setBusy(false);
        setKnown(result);
        if (!result.exists) {
          // No account. Carry the address across so they do not type it twice.
          toRegisterWith(email.trim());
          return;
        }
        if (!result.hasPassword) {
          // An SSO-only account has no password to ask for; point them back at
          // the method they actually signed up with.
          return;
        }
        setStep("password");
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
        setBusy(false);
      });
  };

  const submit = () => {
    if (email === "" || password === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.loginPassword({
      email: email.trim(),
      password,
      turnstileToken: captcha.token,
      remember,
    })
      .then((result) => {
        if ("verify" in result) {
          setVerifyEmail(result.email);
        } else if ("twoFactor" in result) {
          // The password was right, but the account also needs a current
          // code — the session stays pending server-side until one is
          // supplied, so reloading now would land on the home page signed
          // out. VerifyCodeStep can't be reused here: that step confirms an
          // emailed code and finishes by signing in as a NEW account; this
          // one confirms an authenticator code against an ALREADY-existing,
          // already-password-checked account.
          setBusy(false);
          setNeedsTwoFactor(true);
        } else {
          reload(loginReturnTo());
        }
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
        setBusy(false);
      });
  };

  if (verifyEmail != null) {
    return (
      <VerifyCodeStep
        email={verifyEmail}
        onBack={() => setVerifyEmail(null)}
        destination={loginReturnTo()}
      />
    );
  }

  if (needsTwoFactor) {
    return (
      <TwoFactorLoginStep
        onBack={() => setNeedsTwoFactor(false)}
        destination={loginReturnTo()}
      />
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        if (step === "password") {
          submit();
        } else {
          identify();
        }
      }}
    >
      {sso === "linkrequired" && (
        <p className={styles.notice}>
          <FormattedMessage
            id="auth.login.ssoLinkRequired"
            defaultMessage="An account already uses that email address. Sign in the way you first registered, then connect this sign-in method from your account settings."
          />
        </p>
      )}
      {sso === "cancelled" && (
        <p className={styles.notice}>
          <FormattedMessage
            id="auth.login.ssoCancelled"
            defaultMessage="That sign-in was cancelled. Nothing has changed — try again or use your email and password."
          />
        </p>
      )}
      <h1 className={styles.headline}>
        {step === "password" ? (
          <FormattedMessage
            id="auth.login.welcomeBack"
            defaultMessage="Welcome back"
          />
        ) : (
          <FormattedMessage
            id="auth.login.headline"
            defaultMessage="Log in or sign up"
          />
        )}
      </h1>
      {step === "email" && (
        <p className={clsx(styles.intro, styles.introCentred)}>
          <FormattedMessage
            id="auth.login.intro"
            defaultMessage="Keep your progress on every device, and give each person in your household their own learner."
          />
        </p>
      )}
      {step === "email" && <SocialButtons register={false} />}
      {step === "email" && AccountService.passkeysSupported() && (
        <button
          type="button"
          className={styles.passkeyBtn}
          onClick={() => {
            AccountService.loginPasskey()
              .then(() => reload(loginReturnTo()))
              .catch(() => {});
          }}
        >
          <PasskeyMark />
          <FormattedMessage
            id="auth.signInWithPasskey"
            defaultMessage="Sign in with Passkey"
          />
        </button>
      )}
      {step === "email" && (
        <div className={styles.orRule}>
          <FormattedMessage id="auth.or" defaultMessage="OR" />
        </div>
      )}
      <TextField
        size="full"
        type="email"
        autoComplete="email"
        autoFocus={true}
        readOnly={step === "password"}
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={(v) => {
          setEmail(v);
          // Changing the address invalidates what we learned about it.
          if (step === "password" || known != null) {
            setStep("email");
            setKnown(null);
            setPassword("");
          }
        }}
      />

      {/* An account that signed up with a provider has no password to ask for.
          Say which one, rather than presenting a field that can never work. */}
      {known?.exists === true && !known.hasPassword && (
        <p className={styles.notice}>
          {known.providers.length > 0 ? (
            <FormattedMessage
              id="auth.login.useProvider"
              defaultMessage="This account signs in with {provider}. Use the button above."
              values={{ provider: known.providers.join(", ") }}
            />
          ) : (
            <FormattedMessage
              id="auth.login.noPassword"
              defaultMessage="This account has no password yet. Use a sign-in link instead."
            />
          )}
        </p>
      )}

      {step === "password" && (
        <>
          <PasswordField
            autoComplete="current-password"
            placeholder={formatMessage({
              id: "auth.password",
              defaultMessage: "Password",
            })}
            value={password}
            onChange={setPassword}
          />
          <div className={styles.rememberRow}>
            <CheckBox
              label={formatMessage({
                id: "auth.keepSignedIn",
                defaultMessage: "Keep me signed in",
              })}
              checked={remember}
              onChange={setRemember}
            />
          </div>
        </>
      )}

      {error != null && <p className={styles.error}>{error}</p>}
      {captcha.widget}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiLoginVariant} />}
          label={
            step === "password"
              ? formatMessage({
                  id: "auth.login.submit",
                  defaultMessage: "Log in",
                })
              : formatMessage({
                  id: "auth.login.continue",
                  defaultMessage: "Continue",
                })
          }
          disabled={busy || email.trim() === ""}
        />
      </div>
      {/* The sign-in link is the other thing an email address alone can do, so
          it belongs beside Continue. Forgotten passwords are only a question
          once we are actually asking for one. */}
      <div className={styles.links}>
        {step === "password" ? (
          <LinkButton onClick={toForgot}>
            <FormattedMessage
              id="auth.forgotLink"
              defaultMessage="Forgot your password?"
            />
          </LinkButton>
        ) : (
          <LinkButton onClick={toMagic}>
            <FormattedMessage
              id="auth.magicLink.link"
              defaultMessage="Email me a sign-in link"
            />
          </LinkButton>
        )}
      </div>
      <ForSchoolsSignpost />
    </form>
  );
}

// Shown after a correct password for an account with two-step verification
// on. The password alone only parks a pending sign-in server-side — this is
// what actually finishes it, with either a current authenticator code or a
// recovery code.
function TwoFactorLoginStep({
  onBack,
  destination = "/",
}: {
  readonly onBack: () => void;
  readonly destination?: string;
}) {
  const { formatMessage } = useIntl();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (code.trim().length < 6 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.twoFactorVerify(code.trim())
      .then(() => reload(destination))
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.2fa.intro"
          defaultMessage="Enter the code from your authenticator app, or one of your recovery codes."
        />
      </p>
      <TextField
        size="full"
        type="text"
        autoComplete="one-time-code"
        autoFocus={true}
        maxLength={32}
        placeholder={formatMessage({
          id: "auth.2fa.codePlaceholder",
          defaultMessage: "Authenticator or recovery code",
        })}
        value={code}
        onChange={setCode}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiCheckDecagramOutline} />}
          label={formatMessage({
            id: "auth.2fa.submit",
            defaultMessage: "Verify",
          })}
          disabled={code.trim().length < 6 || busy}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={onBack}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </form>
  );
}

// Shown after a password sign-up (or a sign-in on an unverified account): the
// account exists but is dormant until the emailed 6-digit code is entered.
// Verifying signs the account in and lands on the home page.
function VerifyCodeStep({
  email,
  onBack,
  destination = "/",
}: {
  readonly email: string;
  readonly onBack: () => void;
  readonly destination?: string;
}) {
  const { formatMessage } = useIntl();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const captcha = useCaptcha();

  const submit = () => {
    if (code.trim().length !== 6 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.verifyEmail({ email: email.trim(), code: code.trim() })
      .then(() => reload(destination))
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  const resend = () => {
    setError(null);
    AccountService.resendCode(email.trim(), captcha.token)
      .then(() => setResent(true))
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        }
      });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.verify.intro"
          defaultMessage="We’ve emailed a 6-digit code to <strong>{email}</strong>. Enter it below to finish setting up your account."
          values={{
            email,
            strong: (chunks) => <strong>{chunks}</strong>,
          }}
        />
      </p>
      <p className={styles.spamHint}>
        <FormattedMessage
          id="auth.spamHint"
          defaultMessage="Can’t find it? Check your spam or junk folder."
        />
      </p>
      <TextField
        size="full"
        type="text"
        autoComplete="one-time-code"
        autoFocus={true}
        maxLength={6}
        placeholder={formatMessage({
          id: "auth.verify.codePlaceholder",
          defaultMessage: "6-digit code",
        })}
        value={code}
        onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      {captcha.widget}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiCheckDecagramOutline} />}
          label={formatMessage({
            id: "auth.verify.submit",
            defaultMessage: "Verify email",
          })}
          disabled={code.trim().length !== 6 || busy}
        />
      </div>
      <div className={styles.links}>
        {resent ? (
          <span className={styles.linkRow}>
            <FormattedMessage
              id="auth.verify.resent"
              defaultMessage="A new code is on its way."
            />
          </span>
        ) : (
          <LinkButton onClick={resend}>
            <FormattedMessage
              id="auth.verify.resend"
              defaultMessage="Didn’t get it? Send a new code"
            />
          </LinkButton>
        )}
        <LinkButton onClick={onBack}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </form>
  );
}

function RegisterForm({
  toLogin,
  email: initialEmail = "",
}: {
  readonly toLogin: () => void;
  /** Carried over when sign-in found no account for this address. */
  readonly email?: string;
}) {
  const { formatMessage } = useIntl();
  const passwordMin = usePageData().minPasswordLength ?? 8;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [dob, setDob] = useState<DobResult>({
    dateOfBirth: null,
    tooYoung: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const captcha = useCaptcha();
  // Set when an SSO *login* found no matching account and bounced here to
  // register first.
  const ssoNoAccount = ssoParam() === "noaccount";
  // The control centre's registration mode (phase 1.4): closed shows a
  // notice instead of the form; invite-only asks for a code.
  const ssoRefused = ssoParam();
  const { registration = "open" } = usePageData();
  const [inviteCode, setInviteCode] = useState("");

  // Only flag a mismatch once they've started typing the confirmation.
  const mismatch = confirm !== "" && confirm !== password;

  const submit = () => {
    if (
      email === "" ||
      password === "" ||
      firstName.trim() === "" ||
      lastName.trim() === "" ||
      dob.dateOfBirth == null ||
      dob.tooYoung ||
      busy
    ) {
      return;
    }
    if (password !== confirm) {
      setError(
        formatMessage({
          id: "auth.passwordMismatch",
          defaultMessage: "The passwords don’t match.",
        }),
      );
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.registerPassword({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dob.dateOfBirth,
      turnstileToken: captcha.token,
      inviteCode: inviteCode.trim() === "" ? undefined : inviteCode.trim(),
    })
      .then((result) => {
        if ("verify" in result) {
          setVerifyEmail(result.email);
        } else {
          reload("/");
        }
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
        setBusy(false);
      });
  };

  if (verifyEmail != null) {
    // A fresh sign-up lands on the account page to add the first learner.
    return (
      <VerifyCodeStep
        email={verifyEmail}
        onBack={toLogin}
        destination="/account"
      />
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      {ssoNoAccount && (
        <p className={styles.notice}>
          <FormattedMessage
            id="auth.register.ssoNoAccount"
            defaultMessage="We couldn’t find a KeyLearn account for that sign-in. Create one below — it only takes a moment."
          />
        </p>
      )}
      <h1 className={styles.headline}>
        <FormattedMessage
          id="auth.register.headline"
          defaultMessage="Create your account"
        />
      </h1>
      <p className={clsx(styles.intro, styles.introCentred)}>
        <FormattedMessage
          id="auth.register.intro"
          defaultMessage="One account for the whole household — you’ll add each learner’s profile next."
        />
      </p>
      <SocialButtons register={true} />
      <div className={styles.orRule}>
        <FormattedMessage id="auth.or" defaultMessage="OR" />
      </div>
      <div className={styles.nameRow}>
        <TextField
          type="text"
          autoComplete="given-name"
          maxLength={PROFILE_NAME_MAX}
          placeholder={formatMessage({
            id: "auth.firstName",
            defaultMessage: "First name",
          })}
          value={firstName}
          onChange={setFirstName}
        />
        <TextField
          type="text"
          autoComplete="family-name"
          maxLength={PROFILE_NAME_MAX}
          placeholder={formatMessage({
            id: "auth.lastName",
            defaultMessage: "Last name",
          })}
          value={lastName}
          onChange={setLastName}
        />
      </div>
      <TextField
        size="full"
        type="email"
        autoComplete="email"
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      {registration === "closed" && (
        <p className={styles.error}>
          <FormattedMessage
            id="auth.registration.closed"
            defaultMessage="KeyLearn is not taking new accounts right now. If you already have one, log in instead."
          />
        </p>
      )}
      {(ssoRefused === "closed" || ssoRefused === "invite") && (
        <p className={styles.error}>
          <FormattedMessage
            id="auth.registration.ssoRefused"
            defaultMessage="That sign-in would have created a new account, and registration is not open right now. Existing accounts can always sign in."
          />
        </p>
      )}
      {registration === "invite" && (
        <TextField
          size="full"
          type="text"
          autoComplete="off"
          maxLength={64}
          placeholder={formatMessage({
            id: "auth.registration.inviteCode",
            defaultMessage: "Invite code",
          })}
          value={inviteCode}
          onChange={setInviteCode}
        />
      )}
      <DobEntry onResult={setDob} />
      {dob.tooYoung ? (
        <GrownUpGate />
      ) : (
        <>
          <PasswordField
            autoComplete="new-password"
            placeholder={formatMessage(
              {
                id: "auth.choosePassword",
                defaultMessage: "Choose a password ({min}+ characters)",
              },
              { min: passwordMin },
            )}
            value={password}
            onChange={setPassword}
          />
          <PasswordStrength password={password} />
          <PasswordField
            autoComplete="new-password"
            placeholder={formatMessage({
              id: "auth.confirmPassword",
              defaultMessage: "Confirm password",
            })}
            value={confirm}
            onChange={setConfirm}
          />
          {mismatch && (
            <p className={styles.error}>
              <FormattedMessage
                id="auth.passwordMismatch"
                defaultMessage="The passwords don’t match."
              />
            </p>
          )}
          {error != null && <p className={styles.error}>{error}</p>}
          {captcha.widget}
          <div className={styles.primary}>
            <Button
              size="full"
              icon={<Icon shape={mdiAccountPlus} />}
              label={formatMessage({
                id: "auth.register.submit",
                defaultMessage: "Create account",
              })}
              disabled={busy || mismatch || registration === "closed"}
            />
          </div>
        </>
      )}
      <div className={styles.links}>
        <span className={styles.linkRow}>
          <FormattedMessage
            id="auth.haveAccount"
            defaultMessage="Already have an account?"
          />{" "}
          <LinkButton onClick={toLogin}>
            <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
          </LinkButton>
        </span>
      </div>
      {/* Same block, same place as the login form — and it matters more
          here: a coordinator setting up for the first time is far likelier
          to be registering than returning. */}
      <ForSchoolsSignpost />
    </form>
  );
}

function ForgotForm({ toLogin }: { readonly toLogin: () => void }) {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  const submit = () => {
    if (email === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.forgotPassword(email.trim(), captcha.token)
      .then(() => {
        setSent(true);
        setBusy(false);
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
          setBusy(false);
        } else {
          // Any other outcome lands on the same confirmation, so the endpoint
          // can't be used to probe which emails are registered.
          setSent(true);
          setBusy(false);
        }
      });
  };

  if (sent) {
    return (
      <div className={styles.form}>
        <p className={styles.intro}>
          <FormattedMessage
            id="auth.forgot.sentText"
            defaultMessage="If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link expires in 24 hours."
            values={{
              email,
              strong: (chunks) => <strong>{chunks}</strong>,
            }}
          />
        </p>
        <p className={styles.spamHint}>
          <FormattedMessage
            id="auth.spamHint"
            defaultMessage="Can’t find it? Check your spam or junk folder."
          />
        </p>
        <div className={styles.links}>
          <LinkButton onClick={toLogin}>
            <FormattedMessage
              id="auth.backToLogin"
              defaultMessage="Back to log in"
            />
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.forgot.intro"
          defaultMessage="Enter your email and we’ll send you a link to choose a new password."
        />
      </p>
      <TextField
        size="full"
        type="email"
        autoComplete="email"
        autoFocus={true}
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      {captcha.widget}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiEmailFastOutline} />}
          label={formatMessage({
            id: "auth.forgot.submit",
            defaultMessage: "Send reset link",
          })}
          disabled={busy}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={toLogin}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </form>
  );
}

// Passwordless sign-in: we email a one-time link that logs you straight in —
// no password to remember. Works to sign in an existing account or start a new
// one.
function MagicForm({ toLogin }: { readonly toLogin: () => void }) {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  const submit = () => {
    if (email === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.registerEmail(email.trim(), captcha.token)
      .then(() => {
        setSent(true);
        setBusy(false);
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
        setBusy(false);
      });
  };

  if (sent) {
    return (
      <div className={styles.form}>
        <p className={styles.intro}>
          <FormattedMessage
            id="auth.magic.sentText"
            defaultMessage="We’ve emailed a sign-in link to <strong>{email}</strong>. It works once and expires in 24 hours."
            values={{
              email,
              strong: (chunks) => <strong>{chunks}</strong>,
            }}
          />
        </p>
        <p className={styles.spamHint}>
          <FormattedMessage
            id="auth.spamHint"
            defaultMessage="Can’t find it? Check your spam or junk folder."
          />
        </p>
        <div className={styles.links}>
          <LinkButton onClick={toLogin}>
            <FormattedMessage
              id="auth.backToLogin"
              defaultMessage="Back to log in"
            />
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.magic.intro"
          defaultMessage="Enter your email and we’ll send you a link to sign in — no password needed."
        />
      </p>
      <TextField
        size="full"
        type="email"
        autoComplete="email"
        autoFocus={true}
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      {captcha.widget}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiEmailFastOutline} />}
          label={formatMessage({
            id: "auth.magic.submit",
            defaultMessage: "Send sign-in link",
          })}
          disabled={busy}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={toLogin}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </form>
  );
}

function ResetForm({ token }: { readonly token: string }) {
  const { formatMessage } = useIntl();
  const passwordMin = usePageData().minPasswordLength ?? 8;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  const mismatch = confirm !== "" && confirm !== password;

  const submit = () => {
    if (password === "" || busy) {
      return;
    }
    if (password !== confirm) {
      setError(
        formatMessage({
          id: "auth.passwordMismatch",
          defaultMessage: "The passwords don’t match.",
        }),
      );
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.resetPassword({
      token,
      password,
      turnstileToken: captcha.token,
    })
      .then(() => reload("/"))
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
          setError(
            formatMessage({
              id: "auth.captcha.required",
              defaultMessage:
                "Please complete the verification below and try again.",
            }),
          );
        } else {
          setError(err.message);
        }
        setBusy(false);
      });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <PasswordField
        autoComplete="new-password"
        placeholder={formatMessage(
          {
            id: "auth.newPassword",
            defaultMessage: "New password ({min}+ characters)",
          },
          { min: passwordMin },
        )}
        value={password}
        onChange={setPassword}
      />
      <PasswordStrength password={password} />
      <PasswordField
        autoComplete="new-password"
        placeholder={formatMessage({
          id: "auth.confirmPassword",
          defaultMessage: "Confirm password",
        })}
        value={confirm}
        onChange={setConfirm}
      />
      {mismatch && (
        <p className={styles.error}>
          <FormattedMessage
            id="auth.passwordMismatch"
            defaultMessage="The passwords don’t match."
          />
        </p>
      )}
      {error != null && <p className={styles.error}>{error}</p>}
      {captcha.widget}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiKeyVariant} />}
          label={formatMessage({
            id: "auth.reset.submit",
            defaultMessage: "Set new password",
          })}
          disabled={busy || mismatch}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={() => reload(Pages.forgotPassword.path)}>
          <FormattedMessage
            id="auth.reset.newLink"
            defaultMessage="Link expired? Request a new one"
          />
        </LinkButton>
        <LinkButton onClick={() => reload(Pages.login.path)}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </form>
  );
}
