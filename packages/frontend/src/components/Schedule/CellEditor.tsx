import { useState, useEffect } from 'react';
import type { Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import { X, Save, Trash2, Flame } from 'lucide-react';
import clsx from 'clsx';

interface CellEditorProps {
  entry: Entry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Entry | null) => void;
  onDelete?: () => void;
  aromas?: Aroma[]; // Available aromas from settings
}

export function CellEditor({ entry, isOpen, onClose, onSave, onDelete, aromas = [] }: CellEditorProps) {
  const [localEntry, setLocalEntry] = useState<Entry>({
    title: '',
    subtitle: '',
    flames: undefined,
    badges: [],
    duration: 15,
    notes: '',
    description: '',
  });

  const [selectedAromaId, setSelectedAromaId] = useState<string>('');

  // Initialize local entry when entry changes
  useEffect(() => {
    if (entry) {
      setLocalEntry(entry);
    } else {
      setLocalEntry({
        title: '',
        subtitle: '',
        flames: undefined,
        badges: [],
        duration: 15,
        notes: '',
        description: '',
      });
    }
    setSelectedAromaId('');
  }, [entry]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Only save if title is not empty
    if (localEntry.title.trim()) {
      onSave({
        ...localEntry,
        title: localEntry.title.trim(),
        subtitle: localEntry.subtitle?.trim() || undefined,
        notes: localEntry.notes?.trim() || undefined,
        description: localEntry.description?.trim() || undefined,
      });
    } else {
      // If title is empty, treat as delete
      onSave(null);
    }
  };

  const handleAddAroma = () => {
    if (!selectedAromaId) return;

    const aroma = aromas.find((a) => a.id === selectedAromaId);
    if (!aroma) return;

    // Store as "emoji name" for display
    const aromaText = `${aroma.emoji} ${aroma.name}`;

    // Don't add if already exists
    if (localEntry.badges?.includes(aromaText)) {
      setSelectedAromaId('');
      return;
    }

    setLocalEntry({
      ...localEntry,
      badges: [...(localEntry.badges || []), aromaText],
    });
    setSelectedAromaId('');
  };

  const handleRemoveAroma = (index: number) => {
    setLocalEntry({
      ...localEntry,
      badges: localEntry.badges?.filter((_, i) => i !== index) || [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-spa-bg-secondary">
          <h3 className="text-xl font-semibold text-spa-text-primary">
            {entry ? 'Aufguss bearbeiten' : 'Neuer Aufguss'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={localEntry.title}
              onChange={(e) => setLocalEntry({ ...localEntry, title: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="z.B. Eis-Aufguss"
              autoFocus
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Untertitel
            </label>
            <input
              type="text"
              value={localEntry.subtitle || ''}
              onChange={(e) => setLocalEntry({ ...localEntry, subtitle: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="z.B. Mint & Eukalyptus"
            />
          </div>

          {/* Flames (Intensity) */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Intensität
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((flameCount) => (
                <button
                  key={flameCount}
                  onClick={() =>
                    setLocalEntry({
                      ...localEntry,
                      flames: localEntry.flames === flameCount ? undefined : flameCount,
                    })
                  }
                  className={clsx(
                    'flex items-center gap-1 px-4 py-2 rounded-md border-2 transition-colors',
                    localEntry.flames === flameCount
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-spa-bg-secondary text-spa-text-secondary hover:border-orange-300'
                  )}
                >
                  {Array.from({ length: flameCount }).map((_, i) => (
                    <Flame
                      key={i}
                      className={clsx(
                        'w-4 h-4',
                        localEntry.flames === flameCount
                          ? 'text-orange-500 fill-orange-500'
                          : 'text-spa-text-secondary'
                      )}
                    />
                  ))}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Dauer (Minuten)
            </label>
            <input
              type="number"
              value={localEntry.duration || ''}
              onChange={(e) =>
                setLocalEntry({ ...localEntry, duration: parseInt(e.target.value) || undefined })
              }
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="15"
              min="1"
              max="180"
            />
          </div>

          {/* Aromas */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Aromas
            </label>
            {aromas.length > 0 ? (
              <>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedAromaId}
                    onChange={(e) => setSelectedAromaId(e.target.value)}
                    className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  >
                    <option value="">Aroma auswählen...</option>
                    {aromas.map((aroma) => (
                      <option key={aroma.id} value={aroma.id}>
                        {aroma.emoji} {aroma.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddAroma}
                    disabled={!selectedAromaId}
                    className="px-4 py-2 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Hinzufügen
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {localEntry.badges?.map((badge, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-spa-secondary/20 text-spa-secondary-dark rounded-full text-sm"
                    >
                      {badge}
                      <button
                        onClick={() => handleRemoveAroma(index)}
                        className="p-0.5 hover:bg-spa-secondary/30 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-spa-text-secondary bg-spa-bg-primary p-3 rounded-md">
                Keine Aromas konfiguriert. Bitte erstellen Sie zuerst Aromas in den Einstellungen.
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Notizen
            </label>
            <textarea
              value={localEntry.notes || ''}
              onChange={(e) => setLocalEntry({ ...localEntry, notes: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Interne Notizen..."
              rows={3}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Beschreibung
            </label>
            <textarea
              value={localEntry.description || ''}
              onChange={(e) => setLocalEntry({ ...localEntry, description: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Öffentliche Beschreibung..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-spa-bg-secondary">
          <div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Löschen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
