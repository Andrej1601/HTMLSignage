import { useState } from 'react';
import { Save } from 'lucide-react';
import { getDayLabel } from '@/types/schedule.types';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, SelectField } from '@/components/FormField';

interface RowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sauna: string, dayOffset: number) => void;
}

export function RowEditor({ isOpen, onClose, onSave }: RowEditorProps) {
  const [sauna, setSauna] = useState('');
  const [dayOffset, setDayOffset] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sauna.trim()) {
      alert('Sauna-Name ist erforderlich');
      return;
    }

    onSave(sauna.trim(), dayOffset);
    setSauna('');
    setDayOffset(0);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Neue Zeile hinzufügen"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="row-editor-form" icon={Save}>
            Hinzufügen
          </Button>
        </>
      }
    >
      <form id="row-editor-form" onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Sauna"
          required
          value={sauna}
          onChange={(e) => setSauna(e.target.value)}
          placeholder="z.B. Finnische Sauna"
        />

        <SelectField
          label="Tag"
          value={dayOffset}
          onChange={(e) => setDayOffset(parseInt(e.target.value))}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
            <option key={offset} value={offset}>
              {getDayLabel(offset)}
            </option>
          ))}
        </SelectField>
      </form>
    </Dialog>
  );
}
