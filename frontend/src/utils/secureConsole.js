// Wraps console.error/console.warn in production builds so an Axios error
// object passed straight to console.error(err) — a pattern used all over
// this codebase — never prints the live bearer token
// (err.config.headers.Authorization) or a full API response body to
// devtools. Dev builds are left untouched so local debugging keeps full
// detail. Call installSecureConsole() once, as early as possible.
const isProd = Boolean(import.meta.env?.PROD);

function looksLikeAxiosError(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value.isAxiosError || value.config || value.response),
  );
}

function redactAxiosError(err) {
  return {
    axiosError: true,
    message: err.message,
    status: err.response?.status,
    method: err.config?.method,
    url: err.config?.url,
    // The response body can carry PHI or other sensitive fields — only
    // surface it when it's a short string (typical for plain-text error
    // responses); object/array bodies are omitted rather than printed.
    data:
      typeof err.response?.data === "string"
        ? err.response.data.slice(0, 300)
        : "[response body omitted]",
  };
}

function sanitizeArg(arg) {
  return looksLikeAxiosError(arg) ? redactAxiosError(arg) : arg;
}

export function installSecureConsole() {
  if (!isProd) return;
  if (console.error?.__secured) return;

  const rawError = console.error.bind(console);
  const rawWarn = console.warn.bind(console);

  const securedError = (...args) => rawError(...args.map(sanitizeArg));
  const securedWarn = (...args) => rawWarn(...args.map(sanitizeArg));
  securedError.__secured = true;
  securedWarn.__secured = true;

  console.error = securedError;
  console.warn = securedWarn;
}
