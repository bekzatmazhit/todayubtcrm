import { useQuery } from "@tanstack/react-query";
import { fetchGroups } from "@/lib/api";

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
