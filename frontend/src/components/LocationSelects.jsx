import useCountries from "../hooks/useCountries";
import useStates from "../hooks/useStates";

const sameText = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Country → State / Province → City fields backed by the same
 * /api/locations endpoints as the rest of the app.
 *
 * Country and State are always dropdowns, never free text — a country with
 * no subdivisions in the dataset (e.g. Guam, Gibraltar) shows State disabled
 * with "No states available" instead, and that country's State is optional.
 * City is always a plain, optional text field.
 *
 * Stored values can be names, legacy ISO codes ("IN") or state free text from
 * before this was a dropdown-only field, so any current value that isn't in
 * a list is added as an extra option instead of being silently blanked on
 * save (it still shows, just inside a disabled control if its country turns
 * out to have no states).
 *
 * Props
 *   country / state / city   current values (strings)
 *   onChange(next)           called with the full { country, state, city }
 *   fieldComponent           wrapper component ({ label, icon, children }) so the
 *                            host page controls label / spacing styling
 *   inputStyle, selectStyle, onFocus, onBlur   host styling for the controls
 *   layout                   omit for the default two-row block (Country+State,
 *                             then City). "countryState" renders only the
 *                             Country+State row. "cityOnly" renders just the
 *                             City field with no wrapping row div, so a host
 *                             page can place it inside its own row (e.g. next
 *                             to a phone field).
 */
export default function LocationSelects({
  country,
  state,
  city,
  onChange,
  fieldComponent,
  inputStyle,
  selectStyle,
  onFocus,
  onBlur,
  layout,
}) {
  const Field = fieldComponent;
  const {
    data: countries = [],
    isLoading: loadingCountries,
    error: countriesError,
  } = useCountries();

  const resolvedCountry =
    countries.find((c) => sameText(c.name, country) || sameText(c.isoCode, country)) || null;

  // Only ask the API about values it can actually resolve — an unresolvable
  // country would 404 and retry.
  const listCountry = resolvedCountry?.name || "";
  const {
    data: states = [],
    isLoading: loadingStates,
    error: statesError,
    refetch: refetchStates,
  } = useStates(listCountry);
  const matchedState = states.find((s) => sameText(s.name, state)) || null;
  const noStatesForCountry = Boolean(listCountry) && !loadingStates && !statesError && states.length === 0;

  const set = (patch) => onChange({ country, state, city, ...patch });

  const countryValue = resolvedCountry?.name || country || "";
  const stateValue = matchedState?.name || state || "";

  const countryStateRow = (
      <div className="ps-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
        <Field label="Country" icon="🌍">
          <select
            style={selectStyle}
            id="country"
            name="country"
            value={countryValue}
            onChange={(e) => set({ country: e.target.value, state: "", city: "" })}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={loadingCountries}
          >
            <option value="">
              {loadingCountries
                ? "Loading countries..."
                : countriesError
                  ? "Failed to load countries"
                  : "Select country"}
            </option>
            {/* keep an unrecognised stored value selectable so saving doesn't wipe it */}
            {countryValue && !resolvedCountry && <option value={countryValue}>{countryValue}</option>}
            {countries.map((c) => (
              <option key={c.isoCode} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="State / Province" icon="📍">
          <select
            style={selectStyle}
            id="state"
            name="state"
            value={stateValue}
            onChange={(e) => set({ state: e.target.value, city: "" })}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={!listCountry || loadingStates || Boolean(statesError) || noStatesForCountry}
          >
            <option value="">
              {!listCountry
                ? "Select country first"
                : loadingStates
                  ? "Loading..."
                  : statesError
                    ? "Failed to load states"
                    : noStatesForCountry
                      ? "No states available"
                      : "Select state / province"}
            </option>
            {stateValue && !matchedState && <option value={stateValue}>{stateValue}</option>}
            {states.map((s) => (
              <option key={s.isoCode} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          {statesError && (
            <button
              type="button"
              onClick={() => refetchStates()}
              style={{
                background: "none",
                border: "none",
                padding: "4px 0 0",
                margin: 0,
                color: "#2563eb",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Retry
            </button>
          )}
        </Field>
      </div>
  );

  const cityField = (
    <Field label="City" icon="🏙️">
      <input
        style={inputStyle}
        type="text"
        id="city"
        name="city"
        value={city || ""}
        maxLength={100}
        onChange={(e) => set({ city: e.target.value })}
        placeholder="City"
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={!listCountry}
      />
    </Field>
  );

  if (layout === "countryState") return countryStateRow;
  if (layout === "cityOnly") return cityField;

  return (
    <>
      {countryStateRow}
      <div className="ps-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
        {cityField}
      </div>
    </>
  );
}
