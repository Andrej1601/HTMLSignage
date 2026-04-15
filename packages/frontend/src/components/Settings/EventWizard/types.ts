import type { EventDraft } from '../eventManager.utils';

export interface StepProps {
  formData: EventDraft;
  normalizedFormData: EventDraft;
  setFormData: React.Dispatch<React.SetStateAction<EventDraft>>;
}
