import { controller, http, pathParam, use } from "@fastr/controller";
import { Context } from "@fastr/core";
import { inject, injectable } from "@fastr/invert";
import { CanonicalHandler } from "@fastr/middleware-canonical";
import { type RouterState } from "@fastr/middleware-router";
import { Env } from "@keylearn/config";
import { Profile } from "@keylearn/database";
import { HighScoresFactory } from "@keylearn/highscores";
import {
  defaultLocale,
  loadIntl,
  PreferredLocaleContext,
} from "@keylearn/intl";
import { Shell, View } from "@keylearn/pages-server";
import {
  NonceContext,
  type PageData,
  PageDataContext,
  PageInfo,
  Pages,
} from "@keylearn/pages-shared";
import { SettingsDatabase } from "@keylearn/settings-database";
import { staticTheme, ThemeContext, ThemePrefs } from "@keylearn/themes";
import { type IntlShape, RawIntlProvider } from "react-intl";
import { type AuthState } from "../auth/index.ts";
import { cspNonce } from "../headers.ts";
import { leaderboardReady } from "../highscores/readiness.ts";
import { localePattern, pIntl, preferredLocale } from "./intl.ts";

@injectable()
@controller()
@use(CanonicalHandler)
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly view: View,
    readonly database: SettingsDatabase,
    readonly highScores: HighScoresFactory,
  ) {}

  @http.GET("/")
  async ["index"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.practice);
  }

  @http.GET(`/{locale:${localePattern}}`)
  async ["index-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.practice, intl);
  }

  @http.GET("/index")
  async ["legacy-index"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.practice);
  }

  @http.GET(`/{locale:${localePattern}}/index`)
  async ["legacy-index-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.practice, intl);
  }

  @http.GET(`${Pages.account.path}`)
  async ["account"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.account);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.account.path}`)
  async ["account-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.account, intl);
  }

  @http.GET(`${Pages.profiles.path}`)
  async ["profiles-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.profiles);
  }

  @http.GET(`${Pages.verify.path}`)
  async ["verify-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.verify);
  }

  @http.GET(`${Pages.verify.path}/{number:[A-Za-z0-9]+}`)
  async ["verify-page-number"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.verify);
  }

  @http.GET(`${Pages.assessment.path}`)
  async ["assessment-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.assessment);
  }

  @http.GET(`${Pages.design.path}`)
  async ["design-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.design);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.design.path}`)
  async ["design-page-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.design, intl);
  }

  @http.GET(`${Pages.login.path}`)
  async ["login-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.login);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.login.path}`)
  async ["login-page-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.login, intl);
  }

  @http.GET(`${Pages.register.path}`)
  async ["register-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.register);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.register.path}`)
  async ["register-page-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.register, intl);
  }

  @http.GET(`${Pages.forgotPassword.path}`)
  async ["forgot-password-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.forgotPassword);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.forgotPassword.path}`)
  async ["forgot-password-page-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.forgotPassword, intl);
  }

  @http.GET(`${Pages.resetPassword.path}/{token:[a-zA-Z0-9]+}`)
  async ["reset-password-page"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.resetPassword);
  }

  @http.GET(
    `/{locale:${localePattern}}${Pages.resetPassword.path}/{token:[a-zA-Z0-9]+}`,
  )
  async ["reset-password-page-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.resetPassword, intl);
  }

  @http.GET(`${Pages.kids.path}`)
  async ["kids"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.kids);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.kids.path}`)
  async ["kids-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.kids, intl);
  }

  @http.GET(`${Pages.profile.path}`)
  async ["profile"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.profile);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.profile.path}`)
  async ["profile-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.profile, intl);
  }

  @http.GET(`${Pages.profile.path}/{id:[a-zA-Z0-9]+}`)
  async ["public-profile"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.profile);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.profile.path}/{id:[a-zA-Z0-9]+}`)
  async ["public-profile-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.profile, intl);
  }

  @http.GET(`${Pages.help.path}`)
  async ["help"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.help);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.help.path}`)
  async ["help-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.help, intl);
  }

  @http.GET(`${Pages.support.path}`)
  async ["support"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.support);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.support.path}`)
  async ["support-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.support, intl);
  }

  @http.GET(`${Pages.desk.path}`)
  async ["desk"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.desk);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.desk.path}`)
  async ["desk-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.desk, intl);
  }

  @http.GET(`${Pages.deskInbox.path}`)
  async ["desk-inbox"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskInbox);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskInbox.path}`)
  async ["desk-inbox-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskInbox, intl);
  }

  @http.GET(`${Pages.helpCentre.path}`)
  async ["help-centre"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.helpCentre);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.helpCentre.path}`)
  async ["help-centre-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.helpCentre, intl);
  }

  // The token is an opaque url-safe string, not a number — the pattern
  // has to admit letters or every emailed thread link 404s.
  @http.GET(`${Pages.supportThread.path}/{token:[A-Za-z0-9_-]+}`)
  async ["support-thread"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.supportThread);
  }

  @http.GET(
    `/{locale:${localePattern}}${Pages.supportThread.path}/{token:[A-Za-z0-9_-]+}`,
  )
  async ["support-thread-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.supportThread, intl);
  }

  @http.GET(`${Pages.deskThread.path}/{id:[0-9]+}`)
  async ["desk-thread"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskThread);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskThread.path}/{id:[0-9]+}`)
  async ["desk-thread-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskThread, intl);
  }

  @http.GET(`${Pages.deskAccounts.path}`)
  async ["desk-accounts"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskAccounts);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskAccounts.path}`)
  async ["desk-accounts-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskAccounts, intl);
  }

  @http.GET(`${Pages.deskAccountDetail.path}/{id:[0-9]+}`)
  async ["desk-account-detail"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskAccountDetail);
  }

  @http.GET(
    `/{locale:${localePattern}}${Pages.deskAccountDetail.path}/{id:[0-9]+}`,
  )
  async ["desk-account-detail-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskAccountDetail, intl);
  }

  @http.GET(`${Pages.deletionCancel.path}/{token:[a-zA-Z0-9]+}`)
  async ["deletion-cancel"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deletionCancel);
  }

  @http.GET(
    `/{locale:${localePattern}}${Pages.deletionCancel.path}/{token:[a-zA-Z0-9]+}`,
  )
  async ["deletion-cancel-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deletionCancel, intl);
  }

  @http.GET(`${Pages.deskAnswers.path}`)
  async ["desk-answers"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskAnswers);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskAnswers.path}`)
  async ["desk-answers-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskAnswers, intl);
  }

  @http.GET(`${Pages.deskNotices.path}`)
  async ["desk-notices"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskNotices);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskNotices.path}`)
  async ["desk-notices-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskNotices, intl);
  }

  @http.GET(`${Pages.deskSettings.path}`)
  async ["desk-settings"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskSettings);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskSettings.path}`)
  async ["desk-settings-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskSettings, intl);
  }

  @http.GET(`${Pages.deskAudit.path}`)
  async ["desk-audit"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskAudit);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskAudit.path}`)
  async ["desk-audit-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskAudit, intl);
  }

  @http.GET(`${Pages.deskAbout.path}`)
  async ["desk-about"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskAbout);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskAbout.path}`)
  async ["desk-about-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskAbout, intl);
  }

  @http.GET(`${Pages.deskSignin.path}`)
  async ["desk-signin"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.deskSignin);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.deskSignin.path}`)
  async ["desk-signin-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.deskSignin, intl);
  }

  @http.GET(`${Pages.highScores.path}`)
  async ["high-scores"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.highScores);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.highScores.path}`)
  async ["high-scores-18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.highScores, intl);
  }

  @http.GET(`${Pages.braille.path}`)
  async ["braille"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.braille);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.braille.path}`)
  async ["braille-18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.braille, intl);
  }

  @http.GET(`${Pages.layouts.path}`)
  async ["layouts"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.layouts);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.layouts.path}`)
  async ["layouts-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.layouts, intl);
  }

  @http.GET(`${Pages.texts.path}`)
  async ["texts"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.texts);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.texts.path}`)
  async ["texts-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.texts, intl);
  }

  @http.GET(`${Pages.typingTest.path}`)
  async ["typing-test"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.typingTest);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.typingTest.path}`)
  async ["typing-test-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.typingTest, intl);
  }

  @http.GET(`${Pages.multiplayer.path}`)
  async ["multiplayer"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.multiplayer);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.multiplayer.path}`)
  async ["multiplayer-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.multiplayer, intl);
  }

  @http.GET(`${Pages.termsOfService.path}`)
  async ["terms-of-service"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.termsOfService);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.termsOfService.path}`)
  async ["terms-of-service-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.termsOfService, intl);
  }

  @http.GET(`${Pages.privacyPolicy.path}`)
  async ["privacy-policy"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.privacyPolicy);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.privacyPolicy.path}`)
  async ["privacy-policy-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.privacyPolicy, intl);
  }

  @http.GET(`${Pages.accessibility.path}`)
  async ["accessibility"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.accessibility);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.accessibility.path}`)
  async ["accessibility-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.accessibility, intl);
  }

  @http.GET(`${Pages.about.path}`)
  async ["about"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.about);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.about.path}`)
  async ["about-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.about, intl);
  }

  @http.GET(`${Pages.guide.path}`)
  async ["guide"](ctx: Context<RouterState & AuthState>) {
    return this.renderPage(ctx, Pages.guide);
  }

  @http.GET(`/{locale:${localePattern}}${Pages.guide.path}`)
  async ["guide-i18n"](
    ctx: Context<RouterState & AuthState>,
    @pathParam("locale", pIntl) intl: IntlShape,
  ) {
    return this.renderPage(ctx, Pages.guide, intl);
  }

  async pageData(
    ctx: Context<RouterState & AuthState>,
    { locale }: IntlShape,
  ): Promise<PageData> {
    const { user, publicUser } = ctx.state;
    const settings = user != null ? await this.database.get(user.id!) : null;
    // Every signed-in account always has at least one (grown-up) profile.
    if (user != null) {
      await Profile.ensureDefault(user);
    }
    const profiles =
      user != null
        ? (await Profile.listForUser(user.id!)).map((p) => p.toDetails())
        : [];
    // Only advertise OAuth providers that actually have credentials configured,
    // so the sign-in UI never shows a button that would fail on click.
    const oauthProviders = (
      [
        ["google", "AUTH_GOOGLE_CLIENT_ID"],
        ["microsoft", "AUTH_MICROSOFT_CLIENT_ID"],
        ["facebook", "AUTH_FACEBOOK_CLIENT_ID"],
      ] as const
    ).flatMap(([name, key]) => (Env.getString(key, "") ? [name] : []));
    return {
      base: this.canonicalUrl,
      // Empty in production, where nginx forwards `/_/game/` to the game
      // worker and the page can simply talk to its own origin. Set it in
      // development, where there is no proxy and the game worker is on its own
      // port — without it the socket dials the HTTP worker, which has no game
      // routes, and dies with a 1006 before it ever opens.
      gameUrl: Env.getString("GAME_URL", ""),
      // Drives whether the leaderboard link appears at all.
      leaderboard: await this.#leaderboardReady(),
      // Off until live practice is finished — see PageData.multiplayer.
      multiplayer: Env.getBoolean("MULTIPLAYER_ENABLED", false),
      locale,
      user: user?.toDetails() ?? null,
      publicUser,
      settings: settings?.toJSON() ?? null,
      oauthProviders,
      profiles,
      // Public Turnstile site key, present only when the CAPTCHA is configured;
      // the browser needs it to render a challenge if the server asks for one.
      turnstileSiteKey: Env.getString("TURNSTILE_SITE_KEY", "") || undefined,
    };
  }

  // Cheap enough to call per render: the row count comes from an already-cached
  // table and the account count is cached behind a TTL.
  async #leaderboardReady(): Promise<boolean> {
    try {
      // The nav link follows the week, since that is the board a visitor lands
      // on.
      const table = await this.highScores.load();
      return await leaderboardReady(table.size("week"));
    } catch {
      return false;
    }
  }

  async renderPage(
    ctx: Context<RouterState & AuthState>,
    page: PageInfo,
    intl: IntlShape | null = null,
  ): Promise<string> {
    if (intl == null) {
      intl = await loadIntl(defaultLocale);
    }

    const pageData = await this.pageData(ctx, intl);

    ctx.response.type = "text/html";

    // Rendered pages embed __PAGE_DATA__, which for a signed-in visitor carries
    // their email, date of birth and every household profile — including each
    // child's name and birth year. A CDN, a school proxy or a shared-device
    // back/forward cache holding that would cross-serve one family's data to
    // another, so it must never be stored. `Vary: Cookie` keeps a signed-out
    // response from being reused for a signed-in one.
    ctx.response.headers.set(
      "Cache-Control",
      ctx.state.user != null
        ? "private, no-store, max-age=0, must-revalidate"
        : "private, no-cache",
    );
    ctx.response.headers.append("Vary", "Cookie");

    ctx.response.headers.append("Link", this.view.preloadHeaders);

    return this.view.renderPage(
      <RawIntlProvider value={intl}>
        <PreferredLocaleContext.Provider value={preferredLocale(ctx)}>
          {/* The nonce the CSP for this very response names, so the page-data
              script is allowed by name rather than by allowing every inline
              script on the page. */}
          <NonceContext.Provider value={cspNonce(ctx)}>
            <PageDataContext.Provider value={pageData}>
              <ThemeContext.Provider value={staticTheme(themePrefs(ctx))}>
                <Shell page={page} headers={ctx.request.headers} />
              </ThemeContext.Provider>
            </PageDataContext.Provider>
          </NonceContext.Provider>
        </PreferredLocaleContext.Provider>
      </RawIntlProvider>,
    );
  }
}

function themePrefs(ctx: Context<RouterState & AuthState>): ThemePrefs {
  let cookie =
    ctx.cookies.get(ThemePrefs.cookieKeyFor(ctx.request.path)) || null;
  if (cookie) {
    try {
      cookie = decodeURIComponent(cookie);
    } catch {
      cookie = null;
    }
  }
  return ThemePrefs.deserialize(cookie);
}
