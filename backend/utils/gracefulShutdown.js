// Graceful shutdown for the HTTP + Socket.IO server.
//
// Socket.IO's io.close() closes the HTTP server it is attached to, so closing
// that server again afterwards throws ERR_SERVER_NOT_RUNNING (logged on every
// restart as "[shutdown] Error during graceful shutdown"). The HTTP server is
// therefore only closed here if it is somehow still listening, and a
// "not running" error is never treated as a failure.

const isNotRunning = (err) => err && err.code === "ERR_SERVER_NOT_RUNNING";

function createGracefulShutdown({
  io,
  server,
  closeDatabase,
  exit = (code) => process.exit(code),
  logger = console,
  timeoutMs = 10000,
}) {
  let shuttingDown = false;

  return async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`\n[shutdown] ${signal} received — closing server...`);

    // Orchestrators SIGKILL shortly after SIGTERM anyway; this makes that
    // deterministic and logged instead of hanging silently on a stuck close.
    const forceExitTimer = setTimeout(() => {
      logger.error("[shutdown] Graceful shutdown timed out — forcing exit.");
      exit(1);
    }, timeoutMs);
    if (typeof forceExitTimer.unref === "function") forceExitTimer.unref();

    try {
      // Disconnects all Socket.IO clients first (long-lived websockets would
      // otherwise keep the HTTP close waiting) and closes the attached HTTP
      // server exactly once.
      await new Promise((resolve, reject) => {
        io.close((err) => (err && !isNotRunning(err) ? reject(err) : resolve()));
      });
      logger.log("[shutdown] Socket.IO and HTTP server closed.");

      // Defensive: only if the HTTP server is still accepting connections.
      if (server && server.listening) {
        await new Promise((resolve, reject) => {
          server.close((err) => (err && !isNotRunning(err) ? reject(err) : resolve()));
        });
        logger.log("[shutdown] HTTP server closed.");
      }

      await closeDatabase();
      logger.log("[shutdown] MongoDB connection closed.");

      clearTimeout(forceExitTimer);
      logger.log("[shutdown] Graceful shutdown complete.");
      exit(0);
    } catch (err) {
      logger.error("[shutdown] Error during graceful shutdown:", err);
      clearTimeout(forceExitTimer);
      exit(1);
    }
  };
}

// Registers the handler for SIGINT/SIGTERM at most once per process, however
// many times this is called (e.g. a module loaded twice by a test runner).
const REGISTERED = Symbol.for("humancare.gracefulShutdown.registered");

function registerShutdownSignals(proc, handler) {
  if (proc[REGISTERED]) return false;
  proc[REGISTERED] = true;
  proc.on("SIGTERM", () => handler("SIGTERM"));
  proc.on("SIGINT", () => handler("SIGINT"));
  return true;
}

module.exports = { createGracefulShutdown, registerShutdownSignals };
