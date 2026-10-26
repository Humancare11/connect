// Wraps socket.on() for one socket so that a handler which throws - or whose
// returned promise rejects - is logged and answered with a "signaling-error"
// event instead of taking the whole process down.
//
// Without this, any handler that throws synchronously (e.g. destructuring a
// `null` payload from a malformed or hostile client) is an uncaught exception
// in the websocket message path, and an async handler that rejects (e.g. a DB
// error during `await doc.save()`) is an unhandled rejection - both of which
// terminate Node and drop every call on the server.
function installSocketErrorGuard(socket, { logger = console } = {}) {
  const originalOn = socket.on.bind(socket);

  socket.on = (event, handler) => {
    if (typeof handler !== "function") return originalOn(event, handler);

    const report = (err) => {
      logger.error(`[socket] handler for "${String(event)}" failed:`, err && err.stack ? err.stack : err);
      try {
        socket.emit("signaling-error", {
          event: String(event),
          code: "server_error",
          msg: "The server could not process that request.",
        });
      } catch {
        // The socket may already be gone; nothing more to do.
      }
    };

    return originalOn(event, (...args) => {
      try {
        const result = handler(...args);
        if (result && typeof result.then === "function") return result.then(undefined, report);
        return result;
      } catch (err) {
        report(err);
        return undefined;
      }
    });
  };
}

module.exports = { installSocketErrorGuard };
