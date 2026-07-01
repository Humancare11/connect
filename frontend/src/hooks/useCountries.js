import { useQuery } from "@tanstack/react-query";
import { getCountries } from "../api/locationApi";

export default function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,

    // Cache countries for 24 hours
    staleTime: 1000 * 60 * 60 * 24,
  });
}