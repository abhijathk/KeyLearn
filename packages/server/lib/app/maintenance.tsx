import { type Context, type HandlerObject, type Next } from "@fastr/core";
import { injectable } from "@fastr/invert";
import { isAdminEmail } from "@keylearn/config";
import { ErrorPage, View } from "@keylearn/pages-server";
import { Pages } from "@keylearn/pages-shared";
import { type AuthState } from "./auth/types.ts";
import {
  maintenanceEnabled,
  maintenanceMessage,
} from "./site-config/readers.ts";

/**
 * Maintenance mode (control centre, `maintenance.enabled`).
 *
 * Website only. A visitor asking for an HTML page gets a 503 with the
 * admin's message; everything else keeps running: the API under `/_/`, so
 * a learner mid-lesson finishes and saves; the desk bridge, so QDesk can
 * switch this back off; sign-in and the auth routes, so an admin can get
 * in; and the legal pages and the rights links, which are reachable
 * always (spec §9). An admin sees the site as normal.
 *
 * Sits after `loadUser` (it needs to know who is asking) and before the
 * router. Read live on every request, so a flip lands within the cache
 * window and needs no restart.
 */
const OPEN_PREFIXES = [
  "/_/",
  "/auth/",
  "/assets/",
  Pages.login.path,
  Pages.forgotPassword.path,
  Pages.resetPassword.path,
  Pages.privacyPolicy.path,
  Pages.termsOfService.path,
  Pages.accessibility.path,
  Pages.deletionCancel.path,
  Pages.supportThread.path,
];

/** Strips a locale prefix ("/de/kids" → "/kids") so the exemptions match twins too. */
function unlocalised(path: string): string {
  const match = /^\/[a-z]{2,3}(?:-[A-Za-z]{2,8})?(\/.*)?$/.exec(path);
  return match != null && match[1] != null ? match[1] : path;
}

export function maintenanceApplies(
  path: string,
  method: string,
  accepts: (...types: string[]) => string | null | undefined,
): boolean {
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  const bare = unlocalised(path);
  for (const prefix of OPEN_PREFIXES) {
    if (path.startsWith(prefix) || bare.startsWith(prefix)) {
      return false;
    }
  }
  if (/\.[a-z0-9]{2,5}$/i.test(path)) {
    // A file: static handling answered already if it existed.
    return false;
  }
  return accepts("text/html", "application/json") === "text/html";
}

@injectable()
export class MaintenanceGate implements HandlerObject {
  constructor(readonly view: View) {}

  async handle(ctx: Context, next: Next): Promise<void> {
    if (!maintenanceEnabled()) {
      return next();
    }
    const { path, method } = ctx.request;
    if (
      !maintenanceApplies(path, method, (...types) =>
        ctx.request.negotiateType(...types),
      )
    ) {
      return next();
    }
    const user = (ctx.state as unknown as AuthState).user;
    if (user?.email != null && isAdminEmail(user.email)) {
      return next();
    }
    ctx.response.status = 503;
    ctx.response.headers.set("Retry-After", "600");
    ctx.response.headers.set("Cache-Control", "no-store");
    ctx.response.type = "text/html";
    ctx.response.body = this.view.renderPage(
      <ErrorPage
        error={{
          status: 503,
          message: "Down for maintenance",
          expose: true,
          description: maintenanceMessage(),
        }}
      />,
    );
  }
}
