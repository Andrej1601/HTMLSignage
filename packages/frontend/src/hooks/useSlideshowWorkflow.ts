import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  slideshowWorkflowApi,
  type SlideshowWorkflowSnapshot,
  type SlideshowWorkflowTargetType,
} from '@/services/api';
import { toast } from '@/stores/toastStore';

function getWorkflowQueryKey(targetType: SlideshowWorkflowTargetType, targetId?: string) {
  return ['slideshow-workflow', targetType, targetId || 'global'] as const;
}

function invalidateWorkflow(queryClient: ReturnType<typeof useQueryClient>, targetType: SlideshowWorkflowTargetType, targetId?: string) {
  queryClient.invalidateQueries({ queryKey: getWorkflowQueryKey(targetType, targetId) });
  queryClient.invalidateQueries({ queryKey: ['settings'] });
  queryClient.invalidateQueries({ queryKey: ['devices'] });
}

export function useSlideshowWorkflow(targetType: SlideshowWorkflowTargetType, targetId?: string) {
  return useQuery({
    queryKey: getWorkflowQueryKey(targetType, targetId),
    queryFn: () => slideshowWorkflowApi.getState(targetType, targetId),
  });
}

export function useSaveSlideshowDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      snapshot,
    }: {
      targetType: SlideshowWorkflowTargetType;
      targetId?: string;
      snapshot: SlideshowWorkflowSnapshot;
    }) => slideshowWorkflowApi.saveDraft(targetType, snapshot, targetId),
    onSuccess: (_, variables) => {
      invalidateWorkflow(queryClient, variables.targetType, variables.targetId);
      toast.success('Entwurf gespeichert.');
    },
    onError: () => {
      toast.error('Entwurf konnte nicht gespeichert werden.');
    },
  });
}

export function useDiscardSlideshowDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: SlideshowWorkflowTargetType; targetId?: string }) =>
      slideshowWorkflowApi.discardDraft(targetType, targetId),
    onSuccess: (_, variables) => {
      invalidateWorkflow(queryClient, variables.targetType, variables.targetId);
      toast.success('Entwurf verworfen.');
    },
    onError: () => {
      toast.error('Entwurf konnte nicht verworfen werden.');
    },
  });
}

export function usePublishSlideshow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      snapshot,
    }: {
      targetType: SlideshowWorkflowTargetType;
      targetId?: string;
      snapshot: SlideshowWorkflowSnapshot;
    }) => slideshowWorkflowApi.publish(targetType, snapshot, targetId),
    onSuccess: (_, variables) => {
      invalidateWorkflow(queryClient, variables.targetType, variables.targetId);
      toast.success('Live-Stand veröffentlicht.');
    },
    onError: () => {
      toast.error('Veröffentlichung fehlgeschlagen.');
    },
  });
}

export function useRollbackSlideshow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      sourceHistoryId,
      snapshot,
    }: {
      targetType: SlideshowWorkflowTargetType;
      targetId?: string;
      sourceHistoryId: string;
      snapshot: SlideshowWorkflowSnapshot;
    }) => slideshowWorkflowApi.rollback(targetType, sourceHistoryId, snapshot, targetId),
    onSuccess: (_, variables) => {
      invalidateWorkflow(queryClient, variables.targetType, variables.targetId);
      toast.success('Vorheriger Stand wiederhergestellt.');
    },
    onError: () => {
      toast.error('Wiederherstellung fehlgeschlagen.');
    },
  });
}

export function useDeleteSlideshowHistoryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      historyId,
    }: {
      targetType: SlideshowWorkflowTargetType;
      targetId?: string;
      historyId: string;
    }) => slideshowWorkflowApi.deleteHistoryEntry(targetType, historyId, targetId),
    onSuccess: (_, variables) => {
      invalidateWorkflow(queryClient, variables.targetType, variables.targetId);
      toast.success('Stand aus der Verlaufsliste entfernt.');
    },
    onError: () => {
      toast.error('Stand konnte nicht gelöscht werden.');
    },
  });
}
