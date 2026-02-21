import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { MediaFilter } from '@/types/media.types';

// Get all media
export function useMedia(filter?: MediaFilter) {
  return useQuery({
    queryKey: ['media', filter],
    queryFn: () => mediaApi.getMedia(filter),
  });
}

// Get single media item
export function useMediaItem(id: string) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaApi.getMediaItem(id),
    enabled: !!id,
  });
}

// Upload media mutation
export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => mediaApi.uploadMedia(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Datei hochgeladen.');
    },
    onError: () => {
      toast.error('Datei konnte nicht hochgeladen werden.');
    },
  });
}

// Delete media mutation
export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mediaApi.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Datei gelöscht.');
    },
    onError: () => {
      toast.error('Datei konnte nicht gelöscht werden.');
    },
  });
}
