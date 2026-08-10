import cluster, { type ClusterSettings } from "node:cluster";
import { Application } from "@fastr/core";
import { Container } from "@fastr/invert";
import { Manifest } from "@keylearn/assets";
import { ConfigModule, Env } from "@keylearn/config";
import { Logger } from "@keylearn/logger";
import { Game } from "@keylearn/multiplayer-server";
import { serveRateLimits } from "./app/auth/ratelimit.ts";
import { checkProductionConfig } from "./app/config-check.ts";
import { ApplicationModule, kGame, kMain } from "./app/index.ts";
import { ReminderSweep } from "./app/mail/index.ts";
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
  process.on("multipleResolves", (type, promise, reason) => {
    Logger.error("Multiple resolvers", { type, promise, reason });
    process.exit(1);
  });
  process.on("uncaughtException", (error) => {
    Logger.error("Uncaught exception", error);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    Logger.error("Unhandled rejection", reason);
    process.exit(1);
  });
}
