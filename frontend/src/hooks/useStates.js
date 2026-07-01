import { useQuery } from "@tanstack/react-query";
import { getStates } from "../api/locationApi";

export default function useStates(country) {
  return useQuery({
    queryKey: ["states", country],
    queryFn: () => getStates(country),

    // Don't call API until a country is selected
    enabled: !!country,

    // Cache for 24 hours
    staleTime: 1000 * 60 * 60 * 24,
  });
}