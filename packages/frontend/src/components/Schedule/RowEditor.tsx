import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { getDayLabel } from '@/types/schedule.types';

interface RowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sauna: string, dayOffset: number) => void;
}

export function RowEditor({ isOpen, onClose, onSave }: RowEditorProps) {
  const [sauna, setSauna] = useState('');
  const [dayOffset, setDayOffset] = useState(0);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-spa-text-primary">Neue Zeile hinzufügen</h2>
          <button
            onClick={onClose}
            className="text-spa-text-secondary hover:text-spa-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sauna Name */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Sauna *
            </label>
            <input
              type="text"
              value={sauna}
              onChange={(e) => setSauna(e.target.value)}
              placeholder="z.B. Finnische Sauna"
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              required
            />
          </div>

          {/* Day Offset */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Tag
            </label>
            <select
              value={dayOffset}
              onChange={(e) => setDayOffset(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
                <option key={offset} value={offset}>
                  {getDayLabel(offset)}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
            >
              <Save className="w-4 h-4" />
              Hinzufügen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
