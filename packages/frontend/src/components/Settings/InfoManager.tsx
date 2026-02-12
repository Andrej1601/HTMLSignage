import { useState } from 'react';
import type { InfoItem } from '@/types/settings.types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

interface InfoManagerProps {
  infos: InfoItem[];
  onChange: (infos: InfoItem[]) => void;
}

export function InfoManager({ infos, onChange }: InfoManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ title: string; text: string }>({
    title: '',
    text: '',
  });

  const handleStartAdd = () => {
    setFormData({ title: 'Abkühlung', text: '' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: InfoItem) => {
    setFormData({ title: item.title, text: item.text });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ title: '', text: '' });
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.text.trim()) return;

    if (isAdding) {
      const newItem: InfoItem = {
        id: `info-${Date.now()}`,
        title: formData.title.trim(),
        text: formData.text.trim(),
      };
      onChange([...infos, newItem]);
      handleCancel();
      return;
    }

    if (editingId) {
      onChange(
        infos.map((i) =>
          i.id === editingId
            ? { ...i, title: formData.title.trim(), text: formData.text.trim() }
            : i
        )
      );
      handleCancel();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie diese Info wirklich löschen?')) {
      onChange(infos.filter((i) => i.id !== id));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">Infos</h3>
          <p className="text-sm text-spa-text-secondary">
            Hinweise und Wellness-Tipps für die Anzeige
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Info
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="mb-4 p-4 bg-spa-bg-primary border border-spa-bg-secondary rounded-lg">
          <h4 className="text-sm font-semibold text-spa-text-primary mb-3">
            {isAdding ? 'Neue Info hinzufügen' : 'Info bearbeiten'}
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="z.B. Abkühlung, Wellness-Knigge..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Text *
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                rows={3}
                placeholder="Hinweistext..."
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!formData.title.trim() || !formData.text.trim()}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {infos.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-white border border-spa-bg-secondary rounded-md hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-spa-text-primary truncate">{item.title}</div>
                <div className="text-sm text-spa-text-secondary mt-1 line-clamp-3">
                  {item.text}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleStartEdit(item)}
                  className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
                  title="Bearbeiten"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {infos.length === 0 && !isAdding && !editingId && (
        <div className="text-center py-8 text-spa-text-secondary">
          <p>Keine Infos vorhanden.</p>
          <p className="text-sm mt-1">Klicken Sie auf "Neue Info", um eine hinzuzufügen.</p>
        </div>
      )}
    </div>
  );
}

