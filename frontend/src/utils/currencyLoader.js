// Loads the visitor's currency from the server and reloads it when the login state changes. Pure (no React): the provider
// in context/CurrencyContext.jsx wires it to the page, and the tests drive it with a fake fetch.
//
// While a load is in flight `loading` is true, and consumers show a skeleton instead of a price, so a visitor never sees the
// old currency (or "$") for a moment before the right one. A failed request means USD. An answer that arrives after a newer
// load was started (login, then logout, quickly) is ignored.
import { DEFAULT_CURRENCY, normalizeCurrency } from "./currencyDisplay.js";

export function createCurrencyLoader({ fetchCurrency, onChange }) {
  let sequence = 0;
  let disposed = false;
  let state = { currency: DEFAULT_CURRENCY, loading: true, source: "" };

  const set = (next) => {
    state = next;
    if (!disposed) onChange(state);
  };

  function load() {
    const mine = ++sequence;
    set({ ...state, loading: true });
    let request;
    try {
      request = Promise.resolve(fetchCurrency());
    } catch (err) {
      request = Promise.reject(err);
    }
    return request
      .then((data) => {
        if (mine !== sequence) return;
        set({ currency: normalizeCurrency(data?.currency), loading: false, source: String(data?.source || "") });
      })
      .catch(() => {
        if (mine !== sequence) return;
        set({ currency: DEFAULT_CURRENCY, loading: false, source: "error" });
      });
  }

  return {
    load,
    getState: () => state,
    dispose() {
      disposed = true;
      sequence += 1;
    },
  };
}
