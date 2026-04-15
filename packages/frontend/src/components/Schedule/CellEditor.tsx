import { useState } from 'react';
import type { Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import { Save, Trash2, Flame, X, Check } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, TextareaField } from '@/components/FormField';

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
  aromas?: Aroma[];
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

  const [prevEntry, setPrevEntry] = useState<Entry | null | undefined>(entry);
  if (prevEntry !== entry) {
    setPrevEntry(entry);
    if (entry) {
      setLocalEntry({
        ...entry,
        badges: (entry.badges || []).map(normalizeBadgeLabel).filter(Boolean),
      });
    } else {
      setLocalEntry({ title: '', subtitle: '', flames: undefined, badges: [], duration: 15, notes: '', description: '' });
    }
  }

  const handleSave = () => {
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
      onSave(null);
    }
  };

  const toggleAroma = (aroma: Aroma) => {
    const label = normalizeBadgeLabel(aroma.name);
    if (!label) return;
    const current = localEntry.badges || [];
    const exists = current.some((b) => normalizeBadgeLabel(b).toLowerCase() === label.toLowerCase());
    setLocalEntry({
      ...localEntry,
      badges: exists
        ? current.filter((b) => normalizeBadgeLabel(b).toLowerCase() !== label.toLowerCase())
        : [...current, label],
    });
  };

  const removeAroma = (index: number) => {
    setLocalEntry({
      ...localEntry,
      badges: (localEntry.badges || []).filter((_, i) => i !== index),
    });
  };

  const isBadgeSelected = (aroma: Aroma) => {
    const label = normalizeBadgeLabel(aroma.name);
    return (localEntry.badges || []).some(
      (b) => normalizeBadgeLabel(b).toLowerCase() === label.toLowerCase()
    );
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
      <div className="space-y-5">
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

        {/* Intensity (Flames) */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-2">
            Intensität
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((flameCount) => {
              const isSelected = localEntry.flames === flameCount;
              return (
                <button
                  key={flameCount}
                  type="button"
                  onClick={() =>
                    setLocalEntry({
                      ...localEntry,
                      flames: isSelected ? undefined : flameCount,
                    })
                  }
                  className={clsx(
                    'flex items-center gap-0.5 px-3 py-2 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-spa-warning bg-spa-warning-light shadow-sm scale-105'
                      : 'border-spa-bg-secondary bg-spa-surface text-spa-text-secondary hover:border-spa-warning-light hover:bg-spa-warning-light/50'
                  )}
                  title={`${flameCount} Flamme${flameCount > 1 ? 'n' : ''}`}
                >
                  {Array.from({ length: flameCount }).map((_, i) => (
                    <Flame
                      key={i}
                      className={clsx(
                        'w-4 h-4',
                        isSelected ? 'text-spa-warning fill-spa-warning' : 'text-spa-text-secondary/50'
                      )}
                    />
                  ))}
                </button>
              );
            })}
            {localEntry.flames && (
              <button
                type="button"
                onClick={() => setLocalEntry({ ...localEntry, flames: undefined })}
                className="ml-auto text-xs text-spa-text-secondary/60 hover:text-spa-text-primary transition-colors px-2"
              >
                Zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Duration */}
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

        {/* Aromas — chip grid */}
        {aromas.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Aromas
            </label>

            {/* Selected badges */}
            {(localEntry.badges || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(localEntry.badges || []).map((badge, index) => {
                  const cleaned = normalizeBadgeLabel(badge);
                  const lib = aromas.find((a) => a.name.toLowerCase() === cleaned.toLowerCase());
                  return (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-spa-secondary/15 text-spa-secondary-dark rounded-full text-xs font-medium border border-spa-secondary/20"
                    >
                      {lib ? `${lib.emoji} ${cleaned}` : cleaned}
                      <button
                        type="button"
                        onClick={() => removeAroma(index)}
                        aria-label="Aroma entfernen"
                        className="ml-0.5 hover:bg-spa-secondary/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Clickable aroma chips */}
            <div className="flex flex-wrap gap-1.5 p-3 bg-spa-bg-primary rounded-xl border border-spa-bg-secondary">
              {aromas.map((aroma) => {
                const selected = isBadgeSelected(aroma);
                return (
                  <button
                    key={aroma.id}
                    type="button"
                    onClick={() => toggleAroma(aroma)}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      selected
                        ? 'bg-spa-secondary/20 text-spa-secondary-dark border-spa-secondary/40 shadow-sm'
                        : 'bg-spa-surface text-spa-text-secondary border-spa-bg-secondary hover:border-spa-secondary/40 hover:bg-spa-secondary/5'
                    )}
                  >
                    {aroma.emoji && <span>{aroma.emoji}</span>}
                    {aroma.name}
                    {selected && <Check className="w-3 h-3 ml-0.5 text-spa-secondary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {aromas.length === 0 && (
          <div className="text-sm text-spa-text-secondary bg-spa-bg-primary p-3 rounded-lg">
            Keine Aromas konfiguriert. Bitte Aromas zuerst in den Einstellungen anlegen.
          </div>
        )}

        <TextareaField
          label="Notizen"
          value={localEntry.notes || ''}
          onChange={(e) => setLocalEntry({ ...localEntry, notes: e.target.value })}
          placeholder="Interne Notizen…"
          rows={2}
        />

        <TextareaField
          label="Beschreibung"
          value={localEntry.description || ''}
          onChange={(e) => setLocalEntry({ ...localEntry, description: e.target.value })}
          placeholder="Öffentliche Beschreibung…"
          rows={2}
        />
      </div>
    </Dialog>
  );
}
