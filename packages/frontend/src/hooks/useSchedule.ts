import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { Schedule } from '@/types/schedule.types';

export function useSchedule() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['schedule'],
    queryFn: scheduleApi.getSchedule,
  });

  const saveMutation = useMutation({
    mutationFn: (schedule: Schedule) => scheduleApi.saveSchedule(schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Aufgussplan gespeichert.');
    },
    onError: () => {
      toast.error('Aufgussplan konnte nicht gespeichert werden.');
    },
  });

  return {
    schedule: query.data,
    isLoading: query.isLoading,
    error: query.error,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    refetch: query.refetch,
  };
}

export function useScheduleHistory(limit = 10) {
  return useQuery({
    queryKey: ['schedule-history', limit],
    queryFn: () => scheduleApi.getHistory(limit),
  });
}
