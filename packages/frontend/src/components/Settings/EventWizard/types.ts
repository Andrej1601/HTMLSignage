import type { EventSettingsOverrides } from '@/types/settings.types';
import type { EventDraft } from '../eventManager.utils';

export interface StepProps {
  formData: EventDraft;
  normalizedFormData: EventDraft;
  setFormData: React.Dispatch<React.SetStateAction<EventDraft>>;
  updateOverrides: (patch: Partial<EventSettingsOverrides>) => void;
}
