import { useState } from 'react';
import { Copy, Monitor, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SlideshowDefinition } from '@/types/slideshow.types';
import { DropdownMenu } from '@/components/ui/DropdownMenu';

interface SlideshowSelectorProps {
  slideshows: SlideshowDefinition[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string, copyFromId?: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (slideshow: SlideshowDefinition) => void;
}

export function SlideshowSelector({
  slideshows,
  selectedId,
  disabled,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SlideshowSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  const handleRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRename(id, trimmed);
    setRenamingId(null);
    setRenameValue('');
  };

  const startRename = (slideshow: SlideshowDefinition) => {
    setRenamingId(slideshow.id);
    setRenameValue(slideshow.name);
  };

  // Sort: default first, then by name
  const sorted = [...slideshows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-spa-bg-secondary bg-spa-bg-primary p-1 overflow-x-auto">
        {sorted.map((slideshow) => {
          const isSelected = slideshow.id === selectedId;
          const isRenaming = renamingId === slideshow.id;

          return (
            <div key={slideshow.id} className="flex items-center gap-0.5 shrink-0">
              {isRenaming ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRename(slideshow.id); }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(slideshow.id)}
                    className="rounded-lg border border-spa-primary bg-spa-surface px-3 py-1.5 text-sm font-medium text-spa-text-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20 w-32"
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(slideshow.id)}
                  disabled={disabled}
                  className={`group relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-spa-surface text-spa-text-primary shadow-xs'
                      : 'text-spa-text-secondary hover:text-spa-text-primary'
                  } disabled:opacity-60`}
                >
                  <span>{slideshow.name}</span>
                  {(slideshow.deviceCount ?? 0) > 0 && (
                    <span className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-5 text-[10px] font-bold ${
                      isSelected
                        ? 'bg-spa-primary/10 text-spa-primary'
                        : 'bg-spa-bg-secondary text-spa-text-secondary'
                    }`}>
                      {slideshow.deviceCount}
                    </span>
                  )}
                </button>
              )}

              {/* Context menu for non-default slideshows */}
              {isSelected && !slideshow.isDefault && !isRenaming && (
                <DropdownMenu
                  ariaLabel={`Aktionen für ${slideshow.name}`}
                  width="w-44"
                  sections={[
                    [
                      { label: 'Umbenennen', icon: Pencil, onClick: () => startRename(slideshow) },
                      { label: 'Duplizieren', icon: Copy, onClick: () => onCreate(`${slideshow.name} (Kopie)`, slideshow.id) },
                    ],
                    [
                      { label: 'Löschen', icon: Trash2, onClick: () => onDelete(slideshow), variant: 'danger' },
                    ],
                  ]}
                  trigger={(open) => (
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-md p-1 transition-colors ${
                        open
                          ? 'bg-spa-primary/10 text-spa-primary'
                          : 'text-spa-text-secondary hover:text-spa-text-primary hover:bg-spa-surface/60'
                      }`}
                      aria-label="Slideshow-Aktionen"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  )}
                />
              )}
            </div>
          );
        })}

        {/* Create button / input */}
        {isCreating ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            className="flex items-center gap-1 shrink-0"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setIsCreating(false); }}
              className="rounded-lg border border-spa-primary bg-spa-surface px-3 py-1.5 text-sm font-medium text-spa-text-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20 w-36"
              placeholder="Name..."
              autoFocus
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-lg bg-spa-primary px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setIsCreating(false); setNewName(''); }}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-spa-text-secondary hover:text-spa-text-primary"
            >
              &times;
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-spa-text-secondary hover:text-spa-primary transition-colors disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Neue Slideshow</span>
          </button>
        )}
      </div>

      {/* Assigned devices info */}
      {selectedId && (() => {
        const selected = slideshows.find((s) => s.id === selectedId);
        if (!selected) return null;

        const assignedDevices = selected.assignedDevices || [];

        return (
          <div className="flex items-center gap-2 text-xs text-spa-text-secondary">
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            {selected.isDefault ? (
              <span>
                Standard-Slideshow — wird von allen Geräten ohne individuelle Zuweisung verwendet
                {assignedDevices.length > 0 && (
                  <span className="text-spa-text-primary font-medium">
                    {' '}({assignedDevices.length} direkt zugewiesen)
                  </span>
                )}
              </span>
            ) : assignedDevices.length === 0 ? (
              <span>Noch keinem Gerät zugewiesen. Weisen Sie Geräte unter „Geräte" zu.</span>
            ) : (
              <span>
                Zugewiesen an:{' '}
                <span className="text-spa-text-primary font-medium">
                  {assignedDevices.map((d) => d.name).join(', ')}
                </span>
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
