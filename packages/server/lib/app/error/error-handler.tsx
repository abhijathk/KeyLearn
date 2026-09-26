import { type Context, type HandlerObject, type Next } from "@fastr/core";
import { ApplicationError, type ErrorBody } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import {
  isClientError,
  isServerError,
  statusMessage as statusMessageOf,
} from "@fastr/status";
import { Logger } from "@keylearn/logger";
import {
  type ErrorDetails,
  ErrorPage,
  inspectError,
  View,
} from "@keylearn/pages-server";
import { RawIntlProvider } from "react-intl";
import { pathIntl } from "../page/intl.ts";

// Headers that must never reach the log. `cookie` carries the session id, so
// logging it turns any 500 into a stash of live credentials for whoever can read
// the logs; `authorization` likewise.
const REDACTED_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "paddle-signature",
  // The machine keys. `authorization` above covers the standard header
  // and nothing else, and every service-to-service credential this app
  // accepts travels in a header of its own — so each was written to the
  // log in full on any 5xx. `x-ops-api-key` is the widest of them: it
  // opens every `/_/internal/*` route, which is to say every account on
  // the system, and a single stack trace put it in a log file in
  // plaintext beside the URL it had just been used on.
  //
  // Found 19 Sep 2026 while reading a 500 from the account-export route.
  // Anything added to `requireOpsApi`-style gates belongs here the same
  // day it is added.
  "x-ops-api-key",
  "x-qdesk-agent-key",
  "x-qdesk-app-key",
]);

// URL path segments that ARE credentials: magic-login and password-reset links
// carry their token in the path, so the raw URL cannot be logged verbatim.
const TOKEN_PATHS = [
  /^\/login\/[^/]+/,
  /^(\/[a-z-]{2,10})?\/reset-password\/[^/]+/,
];

function scrubUrl(url: string): string {
  let path = url;
  for (const re of TOKEN_PATHS) {
    path = path.replace(re, (m) => m.slice(0, m.lastIndexOf("/")) + "/<token>");
  }
  return path;
}

function describeRequest(ctx: Context) {
  const { method, url, headers } = ctx.request.req;
  const safe: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    safe[name] = REDACTED_HEADERS.has(name.toLowerCase())
      ? "<redacted>"
      : value;
  }
  return { method, url: scrubUrl(url ?? ""), headers: safe };
}

@injectable()
export class ErrorHandler implements HandlerObject {
  constructor(readonly view: View) {}

  async handle(ctx: Context, next: Next): Promise<void> {
    try {
      await next();
    } catch (err: any) {
      if (
        "code" in err &&
        (err.code === "ECONNRESET" || err.code === "EPIPE")
      ) {
        ctx.request.req.destroy();
        ctx.response.res.destroy();
      } else {
        await this.handleError(ctx, err);
      }
      return;
    }

    if (ctx.response.body == null) {
      // No route matched and nothing wrote a response: without this, the
      // framework core stamps a bare text/plain "Not found" after all the
      // middleware has run, and the branded error page never renders.
      if (!ctx.response.hasStatus) {
        await this.report(ctx, {
          expose: true,
          status: 404,
          message: "Not Found",
        });
        return;
      }
      const { statusCode, statusMessage = statusMessageOf(statusCode) } =
        ctx.response.res;
      if (isClientError(statusCode) || isServerError(statusCode)) {
        await this.report(ctx, {
          expose: true,
          status: statusCode,
          message: statusMessage,
        });
      }
    }
  }

  async handleError(ctx: Context, err: Error): Promise<void> {
    const req = describeRequest(ctx);
    if (clientWentAway(ctx, err)) {
      // The browser closed the connection before its body could be read —
      // a tab closed or a page navigated away mid-save. Nobody is left to
      // answer, and nothing on our side failed.
      Logger.debug(err, "Client went away", req);
      ctx.response.status = 400;
      return;
    }
    if (err instanceof ApplicationError) {
      Logger.debug(err, "Application error", req);
      const { status, body } = err;
      ctx.response.status = status;
      ctx.response.body = body;
      ctx.response.type = ApplicationError.MIME_TYPE;
    } else {
      const details = inspectError(err);
      if (details == null) {
        Logger.error(err, "Unknown error", req);
      } else {
        if (isServerError(details.status)) {
          Logger.error(err, "Server error", req);
        }
        if (isClientError(details.status)) {
          Logger.debug(err, "Client error", req);
        }
        if (details.expose) {
          await this.report(ctx, details);
        } else {
          await this.report(ctx, {
            expose: true,
            status: 500,
            message: "Internal Server Error",
          });
        }
      }
    }
  }

  async report(ctx: Context, details: ErrorDetails): Promise<void> {
    const { status, message } = details;
    ctx.response.status = status;
    ctx.response.statusText = message;
    switch (ctx.request.negotiateType("text/html", "application/json")) {
      case "text/html":
        // In the language of the URL, like the page that was asked for.
        ctx.response.body = this.view.renderPage(
          <RawIntlProvider value={await pathIntl(ctx.request.path)}>
            <ErrorPage error={details} />
          </RawIntlProvider>,
        );
        ctx.response.type = "text/html";
        break;
      case "application/json":
        ctx.response.body = { error: { message } } satisfies ErrorBody;
        ctx.response.type = ApplicationError.MIME_TYPE;
        break;
      default:
        ctx.response.body = message;
        ctx.response.type = "text/plain";
        break;
    }
  }
}

/**
 * Whether this error is only the request's own connection having closed.
 * Narrow on purpose: the request stream must actually be destroyed AND the
 * error must be one a closed connection produces, so a real fault that
 * happens to coincide with a disconnect is still reported as one.
 */
function clientWentAway(ctx: Context, err: Error): boolean {
  const raw = (ctx.request as unknown as { req?: { destroyed?: boolean } }).req;
  if (raw?.destroyed !== true) {
    return false;
  }
  const code = (err as { code?: unknown }).code;
  return (
    err.message === "Destroyed stream" ||
    err.message === "aborted" ||
    code === "ECONNRESET" ||
    code === "ECONNABORTED"
  );
}
