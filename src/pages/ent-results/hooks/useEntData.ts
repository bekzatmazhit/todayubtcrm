import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEntResults, saveEntResultsBatch, deleteEntResults } from '@/lib/api';

export function useEntResults(month: string | undefined, groupId: string, statusFilter: string) {
  return useQuery({
    queryKey: ['entResults', month, groupId, statusFilter],
    queryFn: () => fetchEntResults(month, groupId === 'all' ? undefined : groupId, statusFilter),
  });
}

export function useAllEntResults(groupId: string, statusFilter: string) {
  return useQuery({
    queryKey: ['entResults', 'all', groupId, statusFilter],
    queryFn: () => fetchEntResults(undefined, groupId === 'all' ? undefined : groupId, statusFilter),
  });
}

export function useEntMutations() {
  const queryClient = useQueryClient();

  const saveResults = useMutation({
    mutationFn: (scores: any[]) => saveEntResultsBatch(scores),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entResults'] });
    },
  });

  const deleteResult = useMutation({
    mutationFn: (id: number) => deleteEntResults(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entResults'] });
    },
  });

  return { saveResults, deleteResult };
}
