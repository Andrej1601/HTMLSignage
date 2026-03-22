import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { MediaFilter } from '@/types/media.types';

interface MediaQueryOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
}

// Get all media
export function useMedia(filter?: MediaFilter, options?: MediaQueryOptions) {
  return useQuery({
    queryKey: ['media', filter],
    queryFn: () => mediaApi.getMedia(filter),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
    staleTime: options?.staleTime,
  });
}

// Get all distinct media tags
export function useMediaTags() {
  return useQuery({
    queryKey: ['media-tags'],
    queryFn: () => mediaApi.getTags(),
    staleTime: 60_000,
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
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
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

// Update media tags
export function useUpdateMediaTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => mediaApi.updateMediaTags(id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
      toast.success('Tags gespeichert.');
    },
    onError: () => {
      toast.error('Tags konnten nicht gespeichert werden.');
    },
  });
}
