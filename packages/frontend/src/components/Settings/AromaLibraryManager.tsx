import { useState } from 'react';
import type { Aroma } from '@/types/settings.types';
import { AROMA_COLOR_PALETTE, getAromaDisplayColor } from '@/types/settings.types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import clsx from 'clsx';

interface AromaLibraryManagerProps {
  aromas: Aroma[];
  onChange: (aromas: Aroma[]) => void;
}

const EMOJI_CATEGORIES = [
  { label: '🌿 Pflanzen',  emojis: ['🌿', '🍃', '🌱', '🌾', '🍀', '☘️', '🌵', '🎋', '🎍'] },
  { label: '🌸 Blumen',    emojis: ['🌸', '🌺', '🌻', '🌼', '🌷', '🏵️', '🥀', '🌹', '🪻'] },
  { label: '🍋 Früchte',   emojis: ['🍋', '🍊', '🍎', '🍏', '🍑', '🍓', '🍇', '🫐', '🥭', '🍍', '🥥'] },
  { label: '🌲 Bäume',     emojis: ['🌲', '🌳', '🌴', '🎄', '🪵'] },
  { label: '❄️ Winter',    emojis: ['❄️', '⛄', '🧊', '💧', '💨', '🌬️'] },
  { label: '✨ Sonstiges', emojis: ['✨', '⭐', '🌟', '💫', '🔥', '🕯️', '🪔', '🧴', '🫧'] },
];

export function AromaLibraryManager({ aromas, onChange }: AromaLibraryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ emoji: string; name: string; color: string }>({
    emoji: '🌿',
    name: '',
    color: '',
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const showForm = isAdding || !!editingId;

  const handleStartAdd = () => {
    setFormData({ emoji: '🌿', name: '', color: '' });
    setActiveCategory(null);
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (aroma: Aroma) => {
    setFormData({ emoji: aroma.emoji, name: aroma.name, color: aroma.color || '' });
    setActiveCategory(null);
    setEditingId(aroma.id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ emoji: '🌿', name: '', color: '' });
    setActiveCategory(null);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (isAdding) {
      onChange([...aromas, {
        id: Date.now().toString(),
        emoji: formData.emoji || '🌿',
        name: formData.name.trim(),
        ...(formData.color ? { color: formData.color } : {}),
      }]);
    } else if (editingId) {
      onChange(aromas.map((a) =>
        a.id === editingId
          ? { ...a, emoji: formData.emoji || '🌿', name: formData.name.trim(), ...(formData.color ? { color: formData.color } : { color: undefined }) }
          : a
      ));
    }
    handleCancel();
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie dieses Aroma wirklich löschen?')) {
      onChange(aromas.filter((a) => a.id !== id));
    }
  };

  const activeCategoryEmojis = EMOJI_CATEGORIES.find(c => c.label === activeCategory)?.emojis ?? [];
  const previewColor = formData.color ? getAromaDisplayColor(formData.color) : null;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">Aroma-Bibliothek</h3>
          <p className="mt-0.5 text-sm text-spa-text-secondary">Verwalten Sie die verfügbaren Aromen für Aufgüsse</p>
        </div>
        {!showForm && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 rounded-lg bg-spa-primary px-4 py-2 text-sm font-semibold text-white hover:bg-spa-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Aroma
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-5 space-y-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-spa-text-primary">
              {isAdding ? 'Neues Aroma hinzufügen' : 'Aroma bearbeiten'}
            </h4>
            <button onClick={handleCancel} className="text-spa-text-secondary hover:text-spa-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Emoji-Auswahl (full width, oben) ── */}
          <div className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
              Emoji auswählen
            </label>
            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    activeCategory === cat.label
                      ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                      : 'border-spa-bg-secondary bg-white text-spa-text-secondary hover:border-spa-primary/50'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            {activeCategory && (
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-spa-bg-secondary bg-white p-3">
                {activeCategoryEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, emoji })}
                    className={clsx(
                      'h-9 w-9 rounded-md border-2 text-xl transition-all hover:scale-110',
                      formData.emoji === emoji
                        ? 'border-spa-primary bg-spa-primary/10'
                        : 'border-spa-bg-secondary hover:border-spa-primary/40'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {/* Current emoji preview + custom input */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-spa-bg-secondary bg-white text-3xl shadow-sm">
                {formData.emoji || '🌿'}
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-spa-text-secondary">Oder eigenes Emoji eingeben</label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value.slice(0, 2) })}
                  className="w-full rounded-lg border border-spa-bg-secondary bg-white px-3 py-2 text-center text-2xl focus:border-spa-primary focus:outline-none focus:ring-2 focus:ring-spa-primary/20"
                  placeholder="🌿"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* ── Bezeichnung ── */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
              Bezeichnung *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-spa-bg-secondary bg-white px-3 py-2.5 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-none focus:ring-2 focus:ring-spa-primary/20"
              placeholder="z.B. Eukalyptus, Minze, Lavendel…"
              autoFocus
            />
          </div>

          {/* ── Themenfarbe ── */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
              Badge-Farbe
            </label>
            <div className="flex flex-wrap gap-2">
              {AROMA_COLOR_PALETTE.map((hex) => {
                const isSelected = formData.color === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: isSelected ? '' : hex })}
                    className={clsx(
                      'h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                      isSelected ? 'border-spa-text-primary ring-2 ring-offset-1 ring-spa-primary' : 'border-white shadow-sm'
                    )}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Vorschau ── */}
          {(formData.name || formData.color) && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                Vorschau
              </label>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                style={
                  previewColor
                    ? { backgroundColor: previewColor.bg, color: previewColor.text, borderColor: previewColor.border }
                    : {}
                }
              >
                {formData.emoji} {formData.name || 'Vorschau'}
              </span>
            </div>
          )}

          {/* ── Buttons ── */}
          <div className="flex gap-2 border-t border-spa-bg-secondary pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!formData.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-spa-primary px-4 py-2 text-sm font-semibold text-white hover:bg-spa-primary-dark transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 rounded-lg border border-spa-bg-secondary px-4 py-2 text-sm font-medium text-spa-text-secondary hover:bg-spa-bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* ── Aromen-Grid (3 Spalten) ── */}
      {aromas.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed border-spa-bg-secondary py-10 text-center text-sm text-spa-text-secondary">
          <p>Keine Aromen vorhanden.</p>
          <p className="mt-1 text-xs">Klicken Sie auf „Neues Aroma", um eines hinzuzufügen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aromas.map((aroma, aromaIdx) => {
            const hex = aroma.color || AROMA_COLOR_PALETTE[aromaIdx % AROMA_COLOR_PALETTE.length];
            const dc = getAromaDisplayColor(hex);
            const isEditing = editingId === aroma.id;
            return (
              <div
                key={aroma.id}
                className={clsx(
                  'flex items-center justify-between rounded-lg border p-3 transition-all',
                  isEditing
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-bg-secondary bg-white hover:shadow-sm'
                )}
                style={{ borderColor: isEditing ? undefined : dc.border }}
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: dc.bg, color: dc.text, borderColor: dc.border }}
                >
                  {aroma.emoji} {aroma.name}
                </span>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(aroma)}
                    className="rounded-md p-1.5 text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary transition-colors"
                    title="Bearbeiten"
                    aria-label="Aroma bearbeiten"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(aroma.id)}
                    className="rounded-md p-1.5 text-spa-text-secondary hover:bg-spa-error-light hover:text-spa-error transition-colors"
                    title="Löschen"
                    aria-label="Aroma löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
