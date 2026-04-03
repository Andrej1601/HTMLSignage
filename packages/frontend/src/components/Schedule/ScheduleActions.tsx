import { Button } from '@/components/Button';
import { AutosaveIndicator } from '@/components/AutosaveIndicator';
import { Play, RefreshCw, Save } from 'lucide-react';
import type { UseScheduleEditorReturn } from '@/hooks/useScheduleEditor';

interface ScheduleActionsProps {
  editor: Pick<
    UseScheduleEditorReturn,
    | 'localSchedule'
    | 'isDirty'
    | 'isSaving'
    | 'isLoading'
    | 'draftState'
    | 'handleAutoPlayToggle'
    | 'handleSave'
    | 'refetch'
  >;
}

export function ScheduleActions({ editor }: ScheduleActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AutosaveIndicator isDirty={editor.isDirty} lastAutoSavedAt={editor.draftState.lastAutoSavedAt} />
      <Button
        variant={editor.localSchedule?.autoPlay ? 'active' : 'ghost'}
        icon={Play}
        onClick={editor.handleAutoPlayToggle}
      >
        Auto-Play
      </Button>

      <Button variant="ghost" icon={RefreshCw} onClick={() => { editor.draftState.clearDraft(); editor.refetch(); }} disabled={editor.isLoading}>
        Neu laden
      </Button>

      <Button icon={Save} onClick={editor.handleSave} disabled={!editor.isDirty} loading={editor.isSaving} loadingText="Speichert...">
        Speichern
      </Button>
    </div>
  );
}
