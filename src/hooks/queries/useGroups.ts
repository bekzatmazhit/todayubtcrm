import { useQuery } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: fetchGroups,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
