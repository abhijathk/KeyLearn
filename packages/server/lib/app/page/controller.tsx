import { controller, http, pathParam, use } from "@fastr/controller";
import { Context } from "@fastr/core";
import { inject, injectable } from "@fastr/invert";
import { CanonicalHandler } from "@fastr/middleware-canonical";
import { type RouterState } from "@fastr/middleware-router";
import { Env } from "@keybr/config";
import { Profile } from "@keybr/database";
import { HighScoresFactory } from "@keybr/highscores";
import { defaultLocale, loadIntl, PreferredLocaleContext } from "@keybr/intl";
import { Shell, View } from "@keybr/pages-server";
import {
  type PageData,
  PageDataContext,
  PageInfo,
  Pages,
} from "@keybr/pages-shared";
import { SettingsDatabase } from "@keybr/settings-database";
import { staticTheme, ThemeContext, ThemePrefs } from "@keybr/themes";
import { type IntlShape, RawIntlProvider } from "react-intl";
import { type AuthState } from "../auth/index.ts";
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
      // Drives whether the leaderboard link appears at all.
      leaderboard: await this.#leaderboardReady(),
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
          <PageDataContext.Provider value={pageData}>
            <ThemeContext.Provider value={staticTheme(themePrefs(ctx))}>
              <Shell page={page} headers={ctx.request.headers} />
            </ThemeContext.Provider>
          </PageDataContext.Provider>
        </PreferredLocaleContext.Provider>
      </RawIntlProvider>,
    );
  }
}

function themePrefs(ctx: Context<RouterState & AuthState>): ThemePrefs {
  let cookie = ctx.cookies.get(ThemePrefs.cookieKey) || null;
  if (cookie) {
    try {
      cookie = decodeURIComponent(cookie);
    } catch {
      cookie = null;
    }
  }
  return ThemePrefs.deserialize(cookie);
}
