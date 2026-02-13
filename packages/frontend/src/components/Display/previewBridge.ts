import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';

export const PREVIEW_CONFIG_EVENT = 'htmlsignage:preview-config';
export const PREVIEW_READY_EVENT = 'htmlsignage:preview-ready';
export const PREVIEW_REQUEST_READY_EVENT = 'htmlsignage:preview-request-ready';

export interface PreviewConfigPayload {
  schedule: Schedule;
  settings: Settings;
}

