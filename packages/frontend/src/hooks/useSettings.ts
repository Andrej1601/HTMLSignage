import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { settingsApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { Settings } from '@/types/settings.types';
import { migrateSettings } from '@/utils/slideshowMigration';

interface SettingsQueryOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
}

export function useSettings(options?: SettingsQueryOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const settings = await settingsApi.getSettings();
      // Migrate old settings to new format
      return migrateSettings(settings);
    },
    enabled: options?.enabled,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
    staleTime: options?.staleTime,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: Settings) => settingsApi.saveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Einstellungen gespeichert.');
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      if (axiosError.response?.status === 409) {
        toast.error(
          axiosError.response.data?.message ??
          'Konflikt: Bitte Seite neu laden und erneut speichern.',
        );
      } else {
        toast.error('Einstellungen konnten nicht gespeichert werden.');
      }
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
