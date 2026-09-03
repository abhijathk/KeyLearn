import cluster, { type ClusterSettings } from "node:cluster";
import { Application } from "@fastr/core";
import { Container } from "@fastr/invert";
import { Manifest } from "@keylearn/assets";
import { ConfigModule, Env } from "@keylearn/config";
import { Logger } from "@keylearn/logger";
import { Game } from "@keylearn/multiplayer-server";
import { AdSweep } from "./app/ads/index.ts";
import { serveRateLimits } from "./app/auth/ratelimit.ts";
import { startStaffCache } from "./app/auth/staff-cache.ts";
import { checkProductionConfig } from "./app/config-check.ts";
import { ApplicationModule, kGame, kMain } from "./app/index.ts";
import { ReminderSweep } from "./app/mail/index.ts";
import { startSiteConfigCache } from "./app/site-config/cache.ts";
import { SiteConfigSweep } from "./app/site-config/sweep.ts";
import {
  AccountDeletionSweep,
  DigestSweep,
  HoldingQueueSweep,
  IdleTicketCloseSweep,
  QdeskRetrySweep,
  StaffAuditSweep,
} from "./app/support/index.ts";
import { LearnerResponseSweep } from "./app/support/learner-response-sweep.ts";
import { DataSnapshot } from "./app/sync/index.ts";
import { ServerModule } from "./server/module.ts";
import { Service } from "./server/service.ts";

// Allow Node to bind to port 80 and 443 without sudo:
// sudo setcap cap_net_bind_service=+ep $(which node)

initErrorHandlers();
if (cluster.isPrimary) {
  Env.probeFilesSync();
  const container = makeContainer();
  Logger.info("Configuration", {
    dataDir: container.get("dataDir"),
    publicDir: container.get("publicDir"),
    canonicalUrl: container.get("canonicalUrl"),
  });
  // Before anything forks: refuse to run a production deployment that is
  // configured to fail quietly.
  const { fatal, warnings } = checkProductionConfig();
  for (const warning of warnings) {
    Logger.warn("Configuration warning: %s", warning);
  }
  if (fatal.length > 0) {
    for (const problem of fatal) {
      Logger.error("Configuration error: %s", problem);
    }
    process.exit(1);
  }
  process.title = "keylearn master process";
  // The primary process does nothing but supervise workers, which makes it the
  // right home for the reminder sweep: once per deployment rather than once per
  // worker, and never competing with a request.
  container.get(ReminderSweep).start();
  // Unconfirmed holding-queue tickets carry an unverified email address —
  // drop them once their confirmation window has lapsed.
  container.get(HoldingQueueSweep).start();
  // One staff-facing status email a day — no LLM involved, see DigestSweep.
  container.get(DigestSweep).start();
  // Staff-initiated account deletions, carried out once their 48-hour
  // cooling-off window closes.
  container.get(AccountDeletionSweep).start();
  // Off (0 days) unless a staff member turns on auto-close-idle in Settings.
  container.get(IdleTicketCloseSweep).start();
  // Forwarding to the desk is fire-and-forget so an outage can't fail a
  // customer's send; this is what makes that safe rather than lossy.
  container.get(QdeskRetrySweep).start();
  // The sweeps read site settings (audit retention, for one), so the
  // primary keeps a view of site_config too. See site-config/cache.ts.
  startSiteConfigCache();
  // Staff audit rows age out past STAFF_AUDIT_RETENTION_DAYS; 0 keeps them.
  container.get(StaffAuditSweep).start();
  // Maintenance auto-revert and the leaderboard override expiry.
  container.get(SiteConfigSweep).start();
  // Feedback comments are reduced to their star after twelve months.
  container.get(LearnerResponseSweep).start();
  // The sponsor slot: closes finished campaigns, credits the minutes a
  // site notice took from them, sends each advertiser's weekly report in
  // their own zone, and expires the day's view hashes.
  container.get(AdSweep).start();
  // Learner data lives in files on this machine's disk; the database is what
  // gets backed up. Copy one into the other at intervals.
  container.get(DataSnapshot).start();
  // The primary owns the rate-limit counters, which is what makes a limit a
  // cluster-wide number instead of one each worker enforces alone.
  serveRateLimits();
  const httpWorkers = Env.getNumber("SERVER_HTTP_WORKERS", 4);
  for (let i = 0; i < httpWorkers; i++) {
    fork({ args: ["http"] });
  }
  fork({ args: ["ws"] });
} else {
  const container = makeContainer();
  const service = container.get(Service);
  // Per worker, not in the primary: the staff roster is cached in this
  // process's memory so `isStaffEmail` can stay synchronous, and it is this
  // process that answers requests with it. See staff-cache.ts.
  startStaffCache();
  // Likewise the site configuration: per worker, refreshed on a timer, so
  // a control-centre change reaches every process inside the window.
  startSiteConfigCache();
  switch (process.argv[2]) {
    case "http":
      process.title = "keylearn server worker process";
      service.start({
        app: container.get(Application, kMain),
        port: Env.getPort("SERVER_PORT", 3000),
      });
      break;
    case "ws":
      process.title = "keylearn game server worker process";
      service.start({
        app: container.get(Application, kGame),
        port: Env.getPort("SERVER_PORT_WS", 3001),
      });
      container.get(Game).start();
      break;
  }
}

function makeContainer() {
  const container = new Container();
  container.load(new ConfigModule());
  container.load(new ApplicationModule());
  container.load(new ServerModule());
  container.get(Manifest); // Sanity check.
  return container;
}

function fork(settings: ClusterSettings) {
  cluster.setupPrimary(settings);
  const worker = cluster.fork({});
  worker.on("online", () => {
    Logger.info("Worker started", { pid: worker.process.pid });
  });
  worker.on("exit", (code, signal) => {
    Logger.info("Worker died, starting a new worker", {
      pid: worker.process.pid,
      code,
      signal,
    });
    fork(settings); // Restart failed worker.
  });
}

function initErrorHandlers() {
  process.on("warning", (warning) => {
    Logger.warn("Warning", warning);
  });
  // No handler for "multipleResolves" — deliberately. The event is
  // deprecated (Node DEP0160) because it fires on legitimate library
  // internals: nodemailer's SMTP transport rejects the same promise twice
  // on a connection failure, and Promise.race leaves its losers "multiply
  // resolved" by design. Exiting on it meant an SMTP auth failure inside
  // the daily digest sweep — an error the sweep itself catches and logs —
  // still killed every worker at digest hour, which is how the server kept
  // "dying overnight". A doubly-resolved promise in a dependency is not a
  // corrupt process; the two handlers below cover the states that are.
  process.on("uncaughtException", (error) => {
    Logger.error("Uncaught exception", error);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    Logger.error("Unhandled rejection", reason);
    process.exit(1);
  });
}
