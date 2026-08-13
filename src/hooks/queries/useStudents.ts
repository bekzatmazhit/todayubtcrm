import { useQuery } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api';

export function useStudents(groupId?: number) {
  return useQuery({
    queryKey: ['students', groupId],
    queryFn: () => fetchStudents(groupId),
    staleTime: 60 * 1000, // 1 minute
  });
}
