import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';
import type { Settings } from '@/types/settings.types';

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: Settings) => settingsApi.saveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    refetch: query.refetch,
  };
}
