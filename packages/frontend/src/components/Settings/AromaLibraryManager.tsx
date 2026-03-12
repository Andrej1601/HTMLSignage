import { useState } from 'react';
import type { Aroma } from '@/types/settings.types';
import { AROMA_COLOR_PALETTE, getAromaDisplayColor } from '@/types/settings.types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import clsx from 'clsx';

interface AromaLibraryManagerProps {
  aromas: Aroma[];
  onChange: (aromas: Aroma[]) => void;
}

export function AromaLibraryManager({ aromas, onChange }: AromaLibraryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ emoji: string; name: string; color: string }>({
    emoji: '',
    name: '',
    color: '',
  });

  const handleStartAdd = () => {
    setFormData({ emoji: '🌿', name: '', color: '' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (aroma: Aroma) => {
    setFormData({ emoji: aroma.emoji, name: aroma.name, color: aroma.color || '' });
    setEditingId(aroma.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (isAdding) {
      const newAroma: Aroma = {
        id: Date.now().toString(),
        emoji: formData.emoji || '🌿',
        name: formData.name.trim(),
        ...(formData.color ? { color: formData.color } : {}),
      };
      onChange([...aromas, newAroma]);
    } else if (editingId) {
      onChange(
        aromas.map((a) =>
          a.id === editingId
            ? {
                ...a,
                emoji: formData.emoji || '🌿',
                name: formData.name.trim(),
                ...(formData.color ? { color: formData.color } : { color: undefined }),
              }
            : a
        )
      );
    }

    handleCancel();
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie dieses Aroma wirklich löschen?')) {
      onChange(aromas.filter((a) => a.id !== id));
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ emoji: '', name: '', color: '' });
  };

  // Emoji categories for better organization
  const emojiCategories = {
    'Pflanzen & Kräuter': ['🌿', '🍃', '🌱', '🌾', '🍀', '☘️', '🌵', '🎋', '🎍'],
    'Blumen': ['🌸', '🌺', '🌻', '🌼', '🌷', '🏵️', '🥀', '🌹', '🪻'],
    'Früchte': ['🍋', '🍊', '🍎', '🍏', '🍑', '🍓', '🍇', '🫐', '🥭', '🍍', '🥥'],
    'Bäume': ['🌲', '🌳', '🌴', '🎄', '🪵'],
    'Winter & Frische': ['❄️', '⛄', '🧊', '💧', '💨', '🌬️'],
    'Sonstige': ['✨', '⭐', '🌟', '💫', '🔥', '🕯️', '🪔'],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">Aroma-Bibliothek</h3>
          <p className="text-sm text-spa-text-secondary">
            Verwalten Sie die verfügbaren Aromen für Aufgüsse
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Aroma
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="mb-4 p-4 bg-spa-bg-primary border border-spa-bg-secondary rounded-lg">
          <h4 className="text-sm font-semibold text-spa-text-primary mb-3">
            {isAdding ? 'Neues Aroma hinzufügen' : 'Aroma bearbeiten'}
          </h4>

          <div className="space-y-3">
            {/* Emoji Selector */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Emoji
              </label>
              <div className="space-y-3 mb-3 max-h-96 overflow-y-auto border border-spa-bg-secondary rounded-md p-3 bg-white">
                {Object.entries(emojiCategories).map(([category, emojis]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-spa-text-secondary mb-2">
                      {category}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setFormData({ ...formData, emoji })}
                          className={clsx(
                            'w-10 h-10 text-2xl rounded-md border-2 transition-all hover:scale-110',
                            formData.emoji === emoji
                              ? 'border-spa-primary bg-spa-primary/10 shadow-sm'
                              : 'border-spa-bg-secondary hover:border-spa-primary/50'
                          )}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-spa-text-secondary">Oder eigenes Emoji:</label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value.slice(0, 2) })}
                  className="w-20 px-3 py-2 text-2xl text-center border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  placeholder="🌿"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="z.B. Eukalyptus, Minze, Lavendel..."
                autoFocus
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Badge-Farbe
              </label>
              <div className="flex flex-wrap gap-2">
                {AROMA_COLOR_PALETTE.map((hex) => {
                  const isSelected = formData.color === hex;
                  return (
                    <button
                      key={hex}
                      onClick={() => setFormData({ ...formData, color: isSelected ? '' : hex })}
                      className={clsx(
                        'w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
                        isSelected ? 'border-spa-text-primary ring-2 ring-offset-1 ring-spa-primary' : 'border-transparent'
                      )}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  );
                })}
              </div>
              {formData.color && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border"
                    style={{
                      ...(() => {
                        const c = getAromaDisplayColor(formData.color);
                        return { backgroundColor: c.bg, color: c.text, borderColor: c.border };
                      })(),
                    }}
                  >
                    {formData.emoji} {formData.name || 'Vorschau'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Aroma List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {aromas.map((aroma, aromaIdx) => {
          const hex = aroma.color || AROMA_COLOR_PALETTE[aromaIdx % AROMA_COLOR_PALETTE.length];
          const dc = getAromaDisplayColor(hex);
          return (
          <div
            key={aroma.id}
            className="flex items-center justify-between p-3 bg-white border rounded-md hover:shadow-sm transition-shadow"
            style={{ borderColor: dc.border }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border"
                style={{ backgroundColor: dc.bg, color: dc.text, borderColor: dc.border }}
              >
                {aroma.emoji} {aroma.name}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleStartEdit(aroma)}
                className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
                title="Bearbeiten"
                aria-label="Aroma bearbeiten"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(aroma.id)}
                className="p-2 text-spa-error hover:bg-spa-error-light rounded-md transition-colors"
                title="Löschen"
                aria-label="Aroma löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {aromas.length === 0 && !isAdding && (
        <div className="text-center py-8 text-spa-text-secondary">
          <p>Keine Aromen vorhanden.</p>
          <p className="text-sm mt-1">Klicken Sie auf "Neues Aroma", um eines hinzuzufügen.</p>
        </div>
      )}
    </div>
  );
}
