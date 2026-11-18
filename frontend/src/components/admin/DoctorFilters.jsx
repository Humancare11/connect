export default function DoctorFilters({ filters, setFilter, reset, options, active }) {
  return (
    <div className="adp-filters" role="search" aria-label="Doctor filters">
      <input
        className="adp-filter-input"
        aria-label="Filter by doctor name"
        placeholder="Name"
        value={filters.name}
        onChange={(e) => setFilter("name", e.target.value)}
      />
      <select
        className="adp-filter-input"
        aria-label="Country"
        value={filters.country}
        onChange={(e) => setFilter("country", e.target.value)}
      >
        <option value="">All countries</option>
        {options.countries.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className="adp-filter-input"
        aria-label="Language"
        value={filters.language}
        onChange={(e) => setFilter("language", e.target.value)}
      >
        <option value="">All languages</option>
        {options.languages.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className="adp-filter-input"
        aria-label="State"
        value={filters.state}
        disabled={!filters.country}
        onChange={(e) => setFilter("state", e.target.value)}
      >
        <option value="">{filters.country ? "All states" : "State (pick country)"}</option>
        {options.states.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className="adp-filter-input"
        aria-label="City"
        value={filters.city}
        disabled={!filters.state}
        onChange={(e) => setFilter("city", e.target.value)}
      >
        <option value="">{filters.state ? "All cities" : "City (pick state)"}</option>
        {options.cities.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="adp-filter-range">
        <input
          className="adp-filter-input"
          type="number"
          min="0"
          inputMode="decimal"
          aria-label="Minimum fee"
          placeholder="Min fee"
          value={filters.minPrice}
          onChange={(e) => setFilter("minPrice", e.target.value)}
        />
        <span aria-hidden="true">-</span>
        <input
          className="adp-filter-input"
          type="number"
          min="0"
          inputMode="decimal"
          aria-label="Maximum fee"
          placeholder="Max fee"
          value={filters.maxPrice}
          onChange={(e) => setFilter("maxPrice", e.target.value)}
        />
      </div>
      <button type="button" className="adp-btn adp-btn--view" onClick={reset} disabled={!active}>
        Clear filters
      </button>
    </div>
  );
}
