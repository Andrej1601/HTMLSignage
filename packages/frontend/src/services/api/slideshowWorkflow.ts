import { fetchApi } from './core';
import type {
  ApiOkResponse,
  SlideshowWorkflowSnapshot,
  SlideshowWorkflowStateResponse,
  SlideshowWorkflowTargetType,
} from './types';

export const slideshowWorkflowApi = {
  getState: async (targetType: SlideshowWorkflowTargetType, targetId?: string): Promise<SlideshowWorkflowStateResponse> => {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    if (targetType === 'device' && targetId) {
      params.set('targetId', targetId);
    }

    return await fetchApi<SlideshowWorkflowStateResponse>(`/slideshow/workflow?${params.toString()}`);
  },

  saveDraft: async (
    targetType: SlideshowWorkflowTargetType,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/draft', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        ...snapshot,
      },
    });
  },

  discardDraft: async (targetType: SlideshowWorkflowTargetType, targetId?: string): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/discard', {
      method: 'POST',
      data: {
        targetType,
        targetId,
      },
    });
  },

  publish: async (
    targetType: SlideshowWorkflowTargetType,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/publish', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        ...snapshot,
      },
    });
  },

  rollback: async (
    targetType: SlideshowWorkflowTargetType,
    sourceHistoryId: string,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/rollback', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        sourceHistoryId,
        snapshot,
      },
    });
  },

  deleteHistoryEntry: async (
    targetType: SlideshowWorkflowTargetType,
    historyId: string,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    if (targetType === 'device' && targetId) {
      params.set('targetId', targetId);
    }

    return await fetchApi<ApiOkResponse>(`/slideshow/workflow/history/${historyId}?${params.toString()}`, {
      method: 'DELETE',
    });
  },
};
