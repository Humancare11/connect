import api from "../api";

/**
 * Get all countries
 */
export const getCountries = async () => {
  const response = await api.get("/api/locations/countries");
  return response.data.countries;
};

/**
 * Get states by country
 */
export const getStates = async (country) => {
  const response = await api.get(
    `/api/locations/states/${encodeURIComponent(country)}`
  );

  return response.data.states;
};

/**
 * Get cities by country & state
 */
export const getCities = async (country, state) => {
  const response = await api.get(
    `/api/locations/cities/${encodeURIComponent(
      country
    )}/${encodeURIComponent(state)}`
  );

  return response.data.cities;
};