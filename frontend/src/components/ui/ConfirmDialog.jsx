import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

const ConfirmContext = createContext(null);

// const ok = await confirm({ title, message, confirmText, cancelText, tone: "danger" | "default", className })
// `className` is added to the dialog frame so a page can theme it (the admin Appointments page uses it).
// Resolves true on Confirm, false on Cancel / Escape / backdrop. Outside a provider it resolves false
// (so a destructive action is never run by accident).
export function useConfirm() {
  return useContext(ConfirmContext) || (() => Promise.resolve(false));
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setState({ tone: "default", confirmText: "Confirm", cancelText: "Cancel", ...options });
      }),
    [],
  );

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  const danger = state?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        role="alertdialog"
        className={state?.className}
        title={state?.title}
        description={state?.message}
        onClose={() => settle(false)}
        // Danger: start on Cancel so Enter/Space cannot confirm by reflex.
        initialFocus={danger ? ".hc-confirm__cancel" : ".hc-confirm__ok"}
        actions={
          <>
            <Button variant="secondary" className="hc-confirm__cancel" onClick={() => settle(false)}>
              {state?.cancelText}
            </Button>
            <Button variant={danger ? "danger" : "primary"} className="hc-confirm__ok" onClick={() => settle(true)}>
              {state?.confirmText}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}
