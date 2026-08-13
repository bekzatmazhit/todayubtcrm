import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGroups,
  fetchCuratorGroups,
  fetchCuratorStudents,
  fetchCuratorMetrics,
  fetchCallTasksSummary,
  fetchTeacherFeedbackSummary,
  fetchCallTasks,
  fetchTeacherFeedback,
  generateCallTasks,
  generateTeacherFeedback,
} from "@/lib/api";

export function useAdminGroups() {
  return useQuery({
    queryKey: ["adminGroups"],
    queryFn: () => fetchGroups(),
  });
}

export function useCuratorGroups(curatorId: number) {
  return useQuery({
    queryKey: ["curatorGroups", curatorId],
    queryFn: () => fetchCuratorGroups(curatorId),
    enabled: !!curatorId,
  });
}

export function useCuratorStudents(curatorId: number) {
  return useQuery({
    queryKey: ["curatorStudents", curatorId],
    queryFn: () => fetchCuratorStudents(curatorId),
    enabled: !!curatorId,
  });
}

export function useCuratorMetrics(curatorId: number) {
  return useQuery({
    queryKey: ["curatorMetrics", curatorId],
    queryFn: () => fetchCuratorMetrics(curatorId),
    enabled: !!curatorId,
  });
}

export function useAdminCallSummary(month: string) {
  return useQuery({
    queryKey: ["adminCallSummary", month],
    queryFn: () => fetchCallTasksSummary(month),
    enabled: !!month,
  });
}

export function useAdminTeacherFeedbackSummary(month: string) {
  return useQuery({
    queryKey: ["adminTeacherFeedbackSummary", month],
    queryFn: () => fetchTeacherFeedbackSummary(month),
    enabled: !!month,
  });
}

export function useCallTasks(curatorId: number, month?: string) {
  return useQuery({
    queryKey: ["callTasks", curatorId, month],
    queryFn: async () => {
      // If no month is provided, we assume it's for the current curator's active tasks
      // and we want to generate them first (as was done in the original code)
      if (!month) {
        await generateCallTasks(curatorId);
      }
      return fetchCallTasks(curatorId, month);
    },
    enabled: !!curatorId,
  });
}

export function useTeacherFeedback(teacherId: number, month?: string) {
  return useQuery({
    queryKey: ["teacherFeedback", teacherId, month],
    queryFn: async () => {
      // If no month is provided, we assume it's for the current teacher's active tasks
      // and we want to generate them first (as was done in the original code)
      if (!month) {
        await generateTeacherFeedback(teacherId);
      }
      return fetchTeacherFeedback(teacherId, month);
    },
    enabled: !!teacherId,
  });
}
