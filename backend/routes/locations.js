const express = require("express");
const router = express.Router();
const csc = require("country-state-city");

const { Country, State, City } = csc;

const allCountries = Country.getAllCountries();

function findCountry(query) {
  const q = query.trim().toLowerCase();
  return allCountries.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.isoCode.toLowerCase() === q ||
      c.phonecode === q
  );
}

// GET /api/locations/states/:country
// :country can be ISO code (US, IN) or full name (United States)
router.get("/states/:country", (req, res) => {
  try {
    const country = findCountry(req.params.country);
    if (!country) return res.status(404).json({ msg: "Country not found" });
    const states = State.getStatesOfCountry(country.isoCode);
    const result = states.map((s) => ({
      isoCode: s.isoCode,
      name: s.name,
    }));
    res.json({ country: country.name, isoCode: country.isoCode, states: result });
  } catch (err) {
    console.error("Error fetching states:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/locations/cities/:country/:state
// :country can be ISO code or full name
// :state can be ISO code or full name
router.get("/cities/:country/:state", (req, res) => {
  try {
    const country = findCountry(req.params.country);
    if (!country) return res.status(404).json({ msg: "Country not found" });

    const states = State.getStatesOfCountry(country.isoCode);
    const q = req.params.state.trim().toLowerCase();
    const state = states.find(
      (s) => s.name.toLowerCase() === q || s.isoCode.toLowerCase() === q
    );
    if (!state) return res.status(404).json({ msg: "State not found" });

    const cities = City.getCitiesOfState(country.isoCode, state.isoCode);
    const result = cities.map((c) => c.name).sort();
    res.json({
      country: country.name,
      state: state.name,
      cities: result,
    });
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


// GET /api/locations/countries
router.get("/countries", (req, res) => {
  try {
    const result = allCountries.map((c) => ({
      isoCode: c.isoCode,
      name: c.name,
      phonecode: c.phonecode,
    }));
    res.json({ countries: result });
  } catch (err) {
    console.error("Error fetching countries:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;