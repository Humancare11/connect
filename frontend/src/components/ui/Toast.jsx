import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import "./Toast.css";

const MAX_TOASTS = 3;
const DURATION = { success: 4000, info: 4000, error: 6000 };

const ToastContext = createContext(null);
const noop = () => {};
const FALLBACK = { success: noop, error: noop, info: noop };

// toast.success(msg) / toast.error(msg) / toast.info(msg). Outside a provider the calls do nothing.
// An optional second argument adds a button: toast.success(msg, { action: { label: "Undo", onClick }, duration: 8000 }).
// Clicking it runs onClick and dismisses the toast.
export function useToast() {
  return useContext(ToastContext) || FALLBACK;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      if (!message) return;
      const id = nextId.current++;
      const action = options.action?.label && options.action?.onClick ? options.action : null;
      setToasts((list) => [...list, { id, type, message: String(message), action }].slice(-MAX_TOASTS));
      timers.current.set(id, setTimeout(() => dismiss(id), options.duration || DURATION[type]));
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="hc-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`hc-toast hc-toast--${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <span className="hc-toast__msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="hc-toast__action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="hc-toast__close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
