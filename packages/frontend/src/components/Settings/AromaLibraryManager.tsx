import { useState } from 'react';
import type { Aroma } from '@/types/settings.types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import clsx from 'clsx';

interface AromaLibraryManagerProps {
  aromas: Aroma[];
  onChange: (aromas: Aroma[]) => void;
}

export function AromaLibraryManager({ aromas, onChange }: AromaLibraryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ emoji: string; name: string }>({
    emoji: '',
    name: '',
  });

  const handleStartAdd = () => {
    setFormData({ emoji: '🌿', name: '' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (aroma: Aroma) => {
    setFormData({ emoji: aroma.emoji, name: aroma.name });
    setEditingId(aroma.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (isAdding) {
      // Add new aroma
      const newAroma: Aroma = {
        id: Date.now().toString(),
        emoji: formData.emoji || '🌿',
        name: formData.name.trim(),
      };
      onChange([...aromas, newAroma]);
    } else if (editingId) {
      // Update existing aroma
      onChange(
        aromas.map((a) =>
          a.id === editingId
            ? { ...a, emoji: formData.emoji || '🌿', name: formData.name.trim() }
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
    setFormData({ emoji: '', name: '' });
  };

  // Common emoji suggestions
  const emojiSuggestions = ['🌿', '🍋', '❄️', '🌸', '🍊', '🌲', '🥥', '🌹', '🍃', '🌺', '🌻', '🪻', '🌼', '🍀', '🌴', '🥭'];

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
              <div className="flex gap-2 mb-2">
                {emojiSuggestions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setFormData({ ...formData, emoji })}
                    className={clsx(
                      'w-10 h-10 text-2xl rounded-md border-2 transition-colors hover:bg-spa-bg-secondary',
                      formData.emoji === emoji
                        ? 'border-spa-primary bg-spa-primary/10'
                        : 'border-spa-bg-secondary'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value.slice(0, 2) })}
                className="w-24 px-3 py-2 text-2xl text-center border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="🌿"
                maxLength={2}
              />
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
        {aromas.map((aroma) => (
          <div
            key={aroma.id}
            className="flex items-center justify-between p-3 bg-white border border-spa-bg-secondary rounded-md hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{aroma.emoji}</span>
              <span className="font-medium text-spa-text-primary">{aroma.name}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleStartEdit(aroma)}
                className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
                title="Bearbeiten"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(aroma.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
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
