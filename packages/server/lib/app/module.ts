import { Application } from "@fastr/core";
import {
  type Binder,
  Container,
  inject,
  type Module,
  provides,
} from "@fastr/invert";
import { compress } from "@fastr/middleware-compress";
import { conditional } from "@fastr/middleware-conditional";
import { SessionHandler } from "@fastr/middleware-session";
import { staticFiles } from "@fastr/middleware-static-files";
import { Env } from "@keylearn/config";
import { ManifestModule } from "./assets.ts";
import { AuthModule, loadUser } from "./auth/index.ts";
import { cacheControl } from "./cachecontrol.ts";
import { csrfGuard } from "./csrf.ts";
import { ErrorHandler } from "./error/index.ts";
import { securityHeaders } from "./headers.ts";
import { MailModule } from "./mail/index.ts";
import { gameRoutes, mainRoutes } from "./routes.ts";
import { SessionModule } from "./session.ts";
import { trailingSlashRedirect } from "./trailing-slash.ts";

export const kMain = Symbol();
export const kGame = Symbol();

/**
 * Whether to derive the request's origin from `X-Forwarded-Proto`/`-Host`.
 *
 * Those headers are client-supplied, so this must be on only when a proxy in
 * front of us overwrites them. It follows `TRUSTED_PROXIES` (see `clientIp`) so
 * the two cannot drift apart: no trusted proxy configured means no forwarded
 * header is believed anywhere.
 */
function behindProxy(): boolean {
  return Env.getString("TRUSTED_PROXIES", "") !== "";
}

export class ApplicationModule implements Module {
  configure({ load }: Binder) {
    load(new AuthModule());
    load(new MailModule());
    load(new ManifestModule());
    load(new SessionModule());
  }

  @provides({ id: Application, name: kMain, singleton: true })
  provideMain(
    container: Container,
    @inject("publicDir") publicDir: string,
  ): Application {
    return (
      new Application(container, { behindProxy: behindProxy() })
        .use(ErrorHandler)
        // Ahead of the handlers so error pages carry the headers too.
        .use(securityHeaders())
        .use(trailingSlashRedirect())
        .use(conditional())
        .use(compress())
        .use(staticFiles(publicDir, { cacheControl }))
        .use(SessionHandler)
        .use(loadUser())
        // After the session loads, so a rejection is logged with the real path,
        // and before any route can act on the request.
        .use(csrfGuard())
        .use(mainRoutes())
    );
  }

  @provides({ id: Application, name: kGame, singleton: true })
  provideGame(container: Container): Application {
    return new Application(container, { behindProxy: behindProxy() })
      .use(ErrorHandler)
      .use(SessionHandler)
      .use(loadUser())
      .use(gameRoutes());
  }
}
