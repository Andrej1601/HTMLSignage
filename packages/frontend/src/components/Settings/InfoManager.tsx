import { useState } from 'react';
import type { InfoItem } from '@/types/settings.types';
import { useMedia } from '@/hooks/useMedia';
import { buildUploadUrl } from '@/utils/mediaUrl';
import { Info, Plus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  const [formData, setFormData] = useState<InfoFormData>({ title: '', text: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deletingInfo = deletingId ? infos.find((i) => i.id === deletingId) ?? null : null;

  const handleStartAdd = () => {
    setFormData({ title: 'Abkühlung', text: '' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: InfoItem) => {
    setFormData({ title: item.title, text: item.text, imageId: item.imageId, imageMode: item.imageMode });
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
      onChange([...infos, { id: `info-${Date.now()}`, ...itemData }]);
      handleCancel();
      return;
    }
    if (editingId) {
      onChange(infos.map((i) => (i.id === editingId ? { ...i, ...itemData } : i)));
      handleCancel();
    }
  };

  const handleRequestDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleConfirmDelete = () => {
    if (!deletingId) return;
    onChange(infos.filter((i) => i.id !== deletingId));
    setDeletingId(null);
  };

  const getImageUrl = (imageId?: string) => {
    if (!imageId) return null;
    const item = images.find((m) => m.id === imageId);
    return item ? buildUploadUrl(item.filename) : null;
  };

  const showForm = isAdding || !!editingId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-spa-text-primary">Wellness-Infos</h3>
            <p className="text-sm text-spa-text-secondary">Tipps und Hinweise für Ihre Gäste</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 bg-spa-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Info hinzufügen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        {showForm && (
          <div className="lg:col-span-5 bg-spa-surface rounded-xl border border-spa-border shadow-xs overflow-hidden sticky top-40">
            <div className="bg-spa-primary/5 px-5 py-4 border-b border-spa-border flex items-center justify-between">
              <span className="text-spa-primary font-bold text-xs uppercase tracking-wider">
                {isAdding ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}
              </span>
              <button onClick={handleCancel} className="text-spa-text-secondary hover:text-spa-text-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-spa-text-secondary uppercase tracking-widest mb-1.5">Titel</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-spa-border rounded-lg bg-spa-surface text-spa-text-primary focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary text-sm px-3 py-2.5 outline-hidden"
                  placeholder="z.B. Saunagänge richtig nutzen…"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-spa-text-secondary uppercase tracking-widest mb-1.5">Text</label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  className="w-full border border-spa-border rounded-lg bg-spa-surface text-spa-text-primary focus:ring-2 focus:ring-spa-primary/20 focus:border-spa-primary text-sm px-3 py-2.5 resize-none outline-hidden"
                  rows={4}
                  placeholder="Tipps für Ihre Gäste beschreiben..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-spa-text-secondary uppercase tracking-widest mb-2">
                  Bild (optional)
                </label>
                {images.length === 0 ? (
                  <p className="text-sm text-spa-text-secondary">Keine Bilder verfügbar.</p>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageId: undefined, imageMode: undefined })}
                        className={`relative shrink-0 w-16 h-16 rounded-lg flex items-center justify-center border-2 transition-colors ${
                          !formData.imageId
                            ? 'border-spa-primary bg-spa-primary/5 text-spa-primary'
                            : 'bg-spa-bg-secondary border-dashed border-spa-border text-spa-text-secondary'
                        }`}
                      >
                        <span className="text-[9px] font-bold">Kein Bild</span>
                      </button>
                      {images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, imageId: img.id, imageMode: formData.imageMode || 'thumbnail' })}
                          className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                            formData.imageId === img.id ? 'border-spa-primary' : 'border-transparent hover:border-spa-primary/50'
                          }`}
                        >
                          <img src={buildUploadUrl(img.filename)} alt={img.originalName} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                    {formData.imageId && (
                      <div className="grid grid-cols-2 gap-1.5 bg-spa-bg-secondary p-1 rounded-xl mt-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageMode: 'thumbnail' })}
                          className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                            formData.imageMode !== 'background'
                              ? 'bg-spa-surface text-spa-primary shadow-xs border border-spa-border'
                              : 'text-spa-text-secondary hover:text-spa-text-primary'
                          }`}
                        >
                          Vorschaubild
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageMode: 'background' })}
                          className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                            formData.imageMode === 'background'
                              ? 'bg-spa-surface text-spa-primary shadow-xs border border-spa-border'
                              : 'text-spa-text-secondary hover:text-spa-text-primary'
                          }`}
                        >
                          Hintergrund
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!formData.title.trim() || !formData.text.trim()}
                  className="flex-1 bg-spa-primary text-white py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-spa-bg-secondary text-spa-text-secondary py-2.5 rounded-xl font-bold text-sm hover:bg-spa-bg-secondary transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cards Grid */}
        <div className={`${showForm ? 'lg:col-span-7' : 'lg:col-span-12'} grid grid-cols-2 sm:grid-cols-3 ${showForm ? 'md:grid-cols-3' : 'md:grid-cols-4 lg:grid-cols-5'} gap-2`}>
          {infos.length === 0 && !showForm ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 bg-spa-surface rounded-xl border border-dashed border-spa-bg-secondary">
              <p className="text-spa-text-secondary font-medium text-sm">Noch keine Infos vorhanden.</p>
              <p className="text-xs text-spa-text-secondary/60 mt-1">Klicken Sie auf „Info hinzufügen" um zu starten.</p>
            </div>
          ) : (
            infos.map((item) => {
              const imgUrl = getImageUrl(item.imageId);
              const isBg = item.imageMode === 'background' && imgUrl;
              const isThumbnail = item.imageMode === 'thumbnail' && imgUrl;
              const isEditing = editingId === item.id;

              const actions = (
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="w-6 h-6 rounded bg-spa-surface/90 border border-spa-bg-secondary flex items-center justify-center text-spa-text-secondary hover:text-spa-primary hover:border-spa-primary transition-colors shadow-xs"
                    aria-label="Bearbeiten"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestDelete(item.id)}
                    className="w-6 h-6 rounded bg-spa-surface/90 border border-spa-bg-secondary flex items-center justify-center text-spa-text-secondary hover:text-spa-error hover:border-spa-error/40 transition-colors shadow-xs"
                    aria-label="Löschen"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              );

              /* ── Hintergrund-Stil: Bild vollflächig, Text als Overlay ── */
              if (isBg) {
                return (
                  <div
                    key={item.id}
                    className={`group relative rounded-lg overflow-hidden aspect-[4/3] border hover:shadow-md transition-all ${
                      isEditing ? 'border-spa-primary ring-1 ring-spa-primary/20' : 'border-spa-bg-secondary'
                    }`}
                  >
                    <img src={imgUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-2">
                      <p className="text-[11px] font-semibold text-white leading-snug line-clamp-1">{item.title}</p>
                      <p className="text-[9px] text-white/70 mt-0.5 line-clamp-2 leading-snug">{item.text}</p>
                    </div>
                    {actions}
                  </div>
                );
              }

              /* ── Thumbnail-Stil: Bild links, Text rechts ── */
              if (isThumbnail) {
                return (
                  <div
                    key={item.id}
                    className={`group relative rounded-lg border overflow-hidden bg-spa-surface hover:shadow-xs transition-all flex gap-0 ${
                      isEditing ? 'border-spa-primary ring-1 ring-spa-primary/20' : 'border-spa-bg-secondary'
                    }`}
                  >
                    <img src={imgUrl!} alt="" className="w-12 h-full object-cover shrink-0 self-stretch" loading="lazy" />
                    <div className="px-2 py-2 min-w-0 flex-1">
                      <p className="text-xs font-semibold text-spa-text-primary leading-snug line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-spa-text-secondary mt-0.5 line-clamp-2 leading-snug">{item.text}</p>
                    </div>
                    {actions}
                  </div>
                );
              }

              /* ── Nur Text ── */
              return (
                <div
                  key={item.id}
                  className={`group relative rounded-lg border bg-spa-surface overflow-hidden hover:shadow-xs transition-all ${
                    isEditing ? 'border-spa-primary ring-1 ring-spa-primary/20' : 'border-spa-bg-secondary'
                  }`}
                >
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-semibold text-spa-text-primary leading-snug line-clamp-1">{item.title}</p>
                    <p className="text-[10px] text-spa-text-secondary mt-0.5 line-clamp-2 leading-snug">{item.text}</p>
                  </div>
                  {actions}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Info löschen?"
        message={
          deletingInfo
            ? `„${deletingInfo.title}" wirklich löschen? Slides, die diese Info anzeigen, werden nach dem Speichern leer.`
            : ''
        }
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
