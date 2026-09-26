import useCountries from "../hooks/useCountries";
import useStates from "../hooks/useStates";
import useCities from "../hooks/useCities";

const sameText = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Country → State / Province → City fields backed by the same
 * /api/locations endpoints as the rest of the app.
 *
 * Stored values can be names, legacy ISO codes ("IN") or free text (older
 * accounts, or a city detected from the IP that isn't in the list), so any
 * current value that isn't in a list is added as an extra option instead of
 * being silently blanked on save.
 *
 * Props
 *   country / state / city   current values (strings)
 *   onChange(next)           called with the full { country, state, city }
 *   fieldComponent           wrapper component ({ label, icon, children }) so the
 *                            host page controls label / spacing styling
 *   inputStyle, selectStyle, onFocus, onBlur   host styling for the controls
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
  // country/state would 404 and retry.
  const listCountry = resolvedCountry?.name || "";
  const { data: states = [], isLoading: loadingStates } = useStates(listCountry);
  const matchedState = states.find((s) => sameText(s.name, state)) || null;
  const { data: cities = [], isLoading: loadingCityList } = useCities(
    listCountry,
    matchedState?.name || "",
  );

  const set = (patch) => onChange({ country, state, city, ...patch });

  const countryValue = resolvedCountry?.name || country || "";
  const showFreeTextState = Boolean(listCountry) && !loadingStates && states.length === 0;
  const stateValue = matchedState?.name || state || "";
  const cityNeedsInput = !loadingStates && !loadingCityList && cities.length === 0;

  return (
    <>
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
          {showFreeTextState ? (
            // Country with no subdivisions in the dataset (e.g. Monaco) — free text.
            <input
              style={inputStyle}
              type="text"
              id="state"
              name="state"
              value={state || ""}
              maxLength={100}
              onChange={(e) => set({ state: e.target.value, city: "" })}
              placeholder="State / Province"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          ) : (
            <select
              style={selectStyle}
              id="state"
              name="state"
              value={stateValue}
              onChange={(e) => set({ state: e.target.value, city: "" })}
              onFocus={onFocus}
              onBlur={onBlur}
              disabled={!listCountry || loadingStates}
            >
              <option value="">
                {loadingStates
                  ? "Loading..."
                  : listCountry
                    ? "Select state / province"
                    : "Select country first"}
              </option>
              {stateValue && !matchedState && <option value={stateValue}>{stateValue}</option>}
              {states.map((s) => (
                <option key={s.isoCode} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="ps-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
        <Field label="City" icon="🏙️">
          {cityNeedsInput ? (
            // No city list for this state (or a detected city with no state) — free text.
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
          ) : (
            <select
              style={selectStyle}
              id="city"
              name="city"
              value={city || ""}
              onChange={(e) => set({ city: e.target.value })}
              onFocus={onFocus}
              onBlur={onBlur}
              disabled={!matchedState || loadingCityList}
            >
              <option value="">
                {loadingCityList ? "Loading..." : matchedState ? "Select city" : "Select state first"}
              </option>
              {city && !cities.includes(city) && <option value={city}>{city}</option>}
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </>
  );
}
