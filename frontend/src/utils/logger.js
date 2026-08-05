// Centralized console wrapper: debug/info/warn are dropped in production
// builds (import.meta.env.PROD) so routine diagnostics don't run on every
// user's machine, while errors always surface since they're needed for
// support/debugging regardless of environment.
const isProd = Boolean(import.meta.env?.PROD);

function createLogger(namespace) {
  const prefix = namespace ? `[${namespace}]` : "";

  return {
    debug(...args) {
      if (isProd) return;
      console.log(prefix, ...args);
    },
    info(...args) {
      if (isProd) return;
      console.info(prefix, ...args);
    },
    warn(...args) {
      if (isProd) return;
      console.warn(prefix, ...args);
    },
    error(...args) {
      // Errors are kept in production — they're the signal support/monitoring needs.
      console.error(prefix, ...args);
    },
  };
}

export default createLogger;
