import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slideshowsApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { CreateSlideshowRequest, UpdateSlideshowRequest } from '@/services/api';

function invalidateSlideshows(queryClient: ReturnType<typeof useQueryClient>, id?: string): void {
  queryClient.invalidateQueries({ queryKey: ['slideshows'] });
  if (id) {
    queryClient.invalidateQueries({ queryKey: ['slideshows', id] });
  }
}

// List all slideshow definitions
export function useSlideshows() {
  return useQuery({
    queryKey: ['slideshows'],
    queryFn: slideshowsApi.list,
  });
}

// Get a single slideshow definition by id
export function useSlideshow(id: string) {
  return useQuery({
    queryKey: ['slideshows', id],
    queryFn: () => slideshowsApi.get(id),
    enabled: !!id,
  });
}

// Create a new slideshow definition
export function useCreateSlideshow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSlideshowRequest) => slideshowsApi.create(payload),
    onSuccess: () => {
      invalidateSlideshows(queryClient);
      toast.success('Slideshow erstellt.');
    },
    onError: () => {
      toast.error('Slideshow konnte nicht erstellt werden.');
    },
  });
}

// Update an existing slideshow definition
export function useUpdateSlideshow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateSlideshowRequest }) =>
      slideshowsApi.update(id, updates),
    onSuccess: (_, variables) => {
      invalidateSlideshows(queryClient, variables.id);
      toast.success('Slideshow aktualisiert.');
    },
    onError: () => {
      toast.error('Slideshow konnte nicht aktualisiert werden.');
    },
  });
}

// Delete a slideshow definition
export function useDeleteSlideshow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => slideshowsApi.remove(id),
    onSuccess: () => {
      invalidateSlideshows(queryClient);
      toast.success('Slideshow gelöscht.');
    },
    onError: () => {
      toast.error('Slideshow konnte nicht gelöscht werden.');
    },
  });
}
