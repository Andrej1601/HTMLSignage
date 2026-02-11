import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/services/api';
import type { Settings } from '@/types/settings.types';
import { migrateSettings } from '@/utils/slideshowMigration';

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const settings = await settingsApi.getSettings();
      // Migrate old settings to new format
      return migrateSettings(settings);
    },
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
