import useStates from "./useStates";
import useCities from "./useCities";

export default function useLocationData(country, state) {
  const {
    data: states = [],
    isLoading: loadingStates,
    error: statesError,
  } = useStates(country);

  const {
    data: cities = [],
    isLoading: loadingCities,
    error: citiesError,
  } = useCities(country, state);

  return {
    states,
    cities,
    loadingStates,
    loadingCities,
    statesError,
    citiesError,
  };
}