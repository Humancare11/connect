import { useQuery } from "@tanstack/react-query";
import { getCities } from "../api/locationApi";

export default function useCities(country, state) {
  return useQuery({
    queryKey: ["cities", country, state],
    queryFn: () => getCities(country, state),

    // Only fetch when both country and state are selected
    enabled: !!country && !!state,

    // Cache for 24 hours
    staleTime: 1000 * 60 * 60 * 24,
  });
}