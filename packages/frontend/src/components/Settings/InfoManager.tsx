import { useState } from 'react';
import type { InfoItem } from '@/types/settings.types';
import { useMedia } from '@/hooks/useMedia';
import { buildUploadUrl } from '@/utils/mediaUrl';
import { Plus, Edit2, Trash2, X, Save, Image } from 'lucide-react';

interface InfoManagerProps {
  infos: InfoItem[];
  onChange: (infos: InfoItem[]) => void;
}

interface InfoFormData {
  title: string;
  text: string;
  imageId?: string;
  imageMode?: 'thumbnail' | 'background';
}

export function InfoManager({ infos, onChange }: InfoManagerProps) {
  const { data: media } = useMedia();
  const images = (media || []).filter((m) => m.type === 'image');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InfoFormData>({
    title: '',
    text: '',
  });

  const handleStartAdd = () => {
    setFormData({ title: 'Abkühlung', text: '' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: InfoItem) => {
    setFormData({
      title: item.title,
      text: item.text,
      imageId: item.imageId,
      imageMode: item.imageMode,
    });
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

    const itemData = {
      title: formData.title.trim(),
      text: formData.text.trim(),
      imageId: formData.imageId,
      imageMode: formData.imageId ? (formData.imageMode || 'thumbnail') : undefined,
    };

    if (isAdding) {
      const newItem: InfoItem = {
        id: `info-${Date.now()}`,
        ...itemData,
      };
      onChange([...infos, newItem]);
      handleCancel();
      return;
    }

    if (editingId) {
      onChange(
        infos.map((i) =>
          i.id === editingId ? { ...i, ...itemData } : i
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

  const getImageUrl = (imageId?: string) => {
    if (!imageId) return null;
    const item = images.find((m) => m.id === imageId);
    return item ? buildUploadUrl(item.filename) : null;
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

            {/* Image picker */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Bild (optional)
              </label>
              {images.length === 0 ? (
                <p className="text-sm text-spa-text-secondary">Keine Bilder verfügbar. Laden Sie zuerst Bilder hoch.</p>
              ) : (
                <>
                  <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageId: undefined, imageMode: undefined })}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs text-spa-text-secondary transition-colors ${
                        !formData.imageId
                          ? 'border-spa-primary bg-spa-primary/5'
                          : 'border-spa-bg-secondary hover:border-spa-primary/50'
                      }`}
                    >
                      Kein Bild
                    </button>
                    {images.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageId: img.id, imageMode: formData.imageMode || 'thumbnail' })}
                        className={`aspect-square rounded-lg border-2 overflow-hidden transition-colors ${
                          formData.imageId === img.id
                            ? 'border-spa-primary ring-2 ring-spa-primary/30'
                            : 'border-spa-bg-secondary hover:border-spa-primary/50'
                        }`}
                      >
                        <img
                          src={buildUploadUrl(img.filename)}
                          alt={img.originalName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                  {formData.imageId && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-spa-text-secondary mb-1">
                        Anzeigemodus
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageMode: 'thumbnail' })}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            formData.imageMode !== 'background'
                              ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                              : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/50'
                          }`}
                        >
                          Neben Text
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageMode: 'background' })}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            formData.imageMode === 'background'
                              ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                              : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/50'
                          }`}
                        >
                          Hintergrund
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
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
        {infos.map((item) => {
          const imgUrl = getImageUrl(item.imageId);
          return (
            <div
              key={item.id}
              className="p-3 bg-white border border-spa-bg-secondary rounded-md hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0 flex-1">
                  {imgUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-spa-bg-secondary">
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-spa-text-primary truncate">{item.title}</div>
                    <div className="text-sm text-spa-text-secondary mt-1 line-clamp-3">
                      {item.text}
                    </div>
                    {item.imageId && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-spa-text-secondary">
                        <Image className="w-3 h-3" />
                        {item.imageMode === 'background' ? 'Hintergrund' : 'Neben Text'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
                    title="Bearbeiten"
                    aria-label="Info bearbeiten"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-spa-error hover:bg-spa-error-light rounded-md transition-colors"
                    title="Löschen"
                    aria-label="Info löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
