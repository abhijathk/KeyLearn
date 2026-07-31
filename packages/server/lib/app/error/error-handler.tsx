import { type Context, type HandlerObject, type Next } from "@fastr/core";
import { ApplicationError, type ErrorBody } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import {
  isClientError,
  isServerError,
  statusMessage as statusMessageOf,
} from "@fastr/status";
import { Logger } from "@keybr/logger";
import {
  type ErrorDetails,
  ErrorPage,
  inspectError,
  View,
} from "@keybr/pages-server";

// Headers that must never reach the log. `cookie` carries the session id, so
// logging it turns any 500 into a stash of live credentials for whoever can read
// the logs; `authorization` likewise.
const REDACTED_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "paddle-signature",
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
        this.handleError(ctx, err);
      }
      return;
    }

    if (ctx.response.body == null) {
      const { statusCode, statusMessage = statusMessageOf(statusCode) } =
        ctx.response.res;
      if (isClientError(statusCode) || isServerError(statusCode)) {
        this.report(ctx, {
          expose: true,
          status: statusCode,
          message: statusMessage,
        });
      }
    }
  }

  handleError(ctx: Context, err: Error) {
    const req = describeRequest(ctx);
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
          this.report(ctx, details);
        } else {
          this.report(ctx, {
            expose: true,
            status: 500,
            message: "Internal Server Error",
          });
        }
      }
    }
  }

  report(ctx: Context, details: ErrorDetails) {
    const { status, message } = details;
    ctx.response.status = status;
    ctx.response.statusText = message;
    switch (ctx.request.negotiateType("text/html", "application/json")) {
      case "text/html":
        ctx.response.body = this.view.renderPage(<ErrorPage error={details} />);
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
