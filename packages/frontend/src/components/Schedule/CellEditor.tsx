import { useState, useEffect } from 'react';
import type { Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import { Save, Trash2, Flame, X } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, TextareaField, SelectField } from '@/components/FormField';

function normalizeBadgeLabel(value: string): string {
  const s = String(value ?? '').trim();
  if (!s) return s;
  const parts = s.split(/\s+/);
  // Migrate legacy format like "🌿 Eukalyptus" to "Eukalyptus".
  if (parts.length >= 2 && /^[^A-Za-z0-9ÄÖÜäöüß]+$/.test(parts[0] || '')) {
    return parts.slice(1).join(' ').trim();
  }
  return s;
}

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
      const cleanedBadges = (entry.badges || []).map(normalizeBadgeLabel).filter(Boolean);
      setLocalEntry({
        ...entry,
        badges: cleanedBadges,
      });
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

  const handleSave = () => {
    // Only save if title is not empty
    if (localEntry.title.trim()) {
      const cleanedBadges = (localEntry.badges || []).map(normalizeBadgeLabel).filter(Boolean);
      onSave({
        ...localEntry,
        title: localEntry.title.trim(),
        subtitle: localEntry.subtitle?.trim() || undefined,
        badges: cleanedBadges.length > 0 ? cleanedBadges : undefined,
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

    // Store as plain name, emojis are resolved at render-time from settings.aromas
    const aromaText = normalizeBadgeLabel(aroma.name);
    if (!aromaText) return;

    // Don't add if already exists
    if ((localEntry.badges || []).some((b) => normalizeBadgeLabel(b).toLowerCase() === aromaText.toLowerCase())) {
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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? 'Aufguss bearbeiten' : 'Neuer Aufguss'}
      size="lg"
      footerLeft={
        onDelete ? (
          <Button variant="danger" icon={Trash2} onClick={onDelete}>
            Löschen
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button icon={Save} onClick={handleSave}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputField
          label="Titel"
          required
          value={localEntry.title}
          onChange={(e) => setLocalEntry({ ...localEntry, title: e.target.value })}
          placeholder="z.B. Eis-Aufguss"
          autoFocus
        />

        <InputField
          label="Untertitel"
          value={localEntry.subtitle || ''}
          onChange={(e) => setLocalEntry({ ...localEntry, subtitle: e.target.value })}
          placeholder="z.B. Mint & Eukalyptus"
        />

        {/* Flames (Intensity) */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
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
                  'flex items-center gap-1 px-4 py-2 rounded-lg border-2 transition-colors',
                  localEntry.flames === flameCount
                    ? 'border-spa-warning bg-spa-warning-light text-spa-warning-dark'
                    : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-warning/50'
                )}
              >
                {Array.from({ length: flameCount }).map((_, i) => (
                  <Flame
                    key={i}
                    className={clsx(
                      'w-4 h-4',
                      localEntry.flames === flameCount
                        ? 'text-spa-warning fill-spa-warning'
                        : 'text-spa-text-secondary'
                    )}
                  />
                ))}
              </button>
            ))}
          </div>
        </div>

        <InputField
          label="Dauer (Minuten)"
          type="number"
          value={localEntry.duration || ''}
          onChange={(e) =>
            setLocalEntry({ ...localEntry, duration: parseInt(e.target.value) || undefined })
          }
          placeholder="15"
          min={1}
          max={180}
        />

        {/* Aromas */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
            Aromas
          </label>
          {aromas.length > 0 ? (
            <>
              <div className="flex gap-2 mb-2">
                <SelectField
                  value={selectedAromaId}
                  onChange={(e) => setSelectedAromaId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Aroma auswählen...</option>
                  {aromas.map((aroma) => (
                    <option key={aroma.id} value={aroma.id}>
                      {aroma.emoji} {aroma.name}
                    </option>
                  ))}
                </SelectField>
                <Button
                  variant="secondary"
                  onClick={handleAddAroma}
                  disabled={!selectedAromaId}
                  className="self-end"
                >
                  Hinzufügen
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localEntry.badges?.map((badge, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-spa-secondary/20 text-spa-secondary-dark rounded-full text-sm"
                  >
                    {(() => {
                      const cleaned = normalizeBadgeLabel(badge);
                      const lib = aromas.find((a) => a.name.toLowerCase() === cleaned.toLowerCase());
                      return lib ? `${lib.emoji} ${cleaned}` : cleaned;
                    })()}
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
            <div className="text-sm text-spa-text-secondary bg-spa-bg-primary p-3 rounded-lg">
              Keine Aromas konfiguriert. Bitte erstellen Sie zuerst Aromas in den Einstellungen.
            </div>
          )}
        </div>

        <TextareaField
          label="Notizen"
          value={localEntry.notes || ''}
          onChange={(e) => setLocalEntry({ ...localEntry, notes: e.target.value })}
          placeholder="Interne Notizen..."
          rows={3}
        />

        <TextareaField
          label="Beschreibung"
          value={localEntry.description || ''}
          onChange={(e) => setLocalEntry({ ...localEntry, description: e.target.value })}
          placeholder="Öffentliche Beschreibung..."
          rows={3}
        />
      </div>
    </Dialog>
  );
}
