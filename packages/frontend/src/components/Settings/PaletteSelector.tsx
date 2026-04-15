import { useState, useEffect, useCallback } from 'react';
import type { ThemeColors, ColorPaletteName } from '@/types/settings.types';
import { COLOR_PALETTES, generateDashboardColors } from '@/types/settings.types';
import { palettesApi, type CustomPalette } from '@/services/api';
import { Plus, Trash2, Save, X, Check } from 'lucide-react';

interface PaletteSelectorProps {
  theme: ThemeColors;
  colorPalette?: ColorPaletteName;
  onApplyPalette: (paletteId: ColorPaletteName, colors: Partial<ThemeColors>) => void;
}

function getPaletteBands(colors: Partial<ThemeColors>): [string, string, string] {
  const t = generateDashboardColors(colors);
  return [
    t.dashboardBg || t.bg || '#F9F7F4',
    t.accentGold || t.accent || '#D4A574',
    t.accentGreen || t.timeColBg || '#7FA99B',
  ];
}

function PaletteCard({
  id: _id,
  name,
  colors,
  isActive,
  onSelect,
  customOptions,
}: {
  id: string;
  name: string;
  colors: Partial<ThemeColors>;
  isActive: boolean;
  onSelect: () => void;
  customOptions?: {
    onUpdate: () => void;
    onDelete: () => void;
    isDeleting: boolean;
  };
}) {
  const bands = getPaletteBands(colors);

  return (
    <div
      className={`bg-spa-surface rounded-xl overflow-hidden transition-all cursor-pointer ${
        isActive
          ? 'border-2 border-spa-primary shadow-lg ring-2 ring-spa-primary/10'
          : 'border border-spa-border shadow-xs hover:shadow-md hover:border-spa-primary/40'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2"
      >
        {/* Color strip preview */}
        <div className="h-8 relative overflow-hidden">
          <div className="absolute inset-0 flex">
            {bands.map((color, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: color }} />
            ))}
          </div>
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Check className="w-3 h-3 text-white drop-shadow" strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Name row */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className={`text-xs font-semibold ${isActive ? 'text-spa-primary' : 'text-spa-text-primary'}`}>
            {name}
          </span>
          {isActive && (
            <span className="text-[8px] font-bold tracking-wider bg-spa-primary/10 text-spa-primary px-1 py-0.5 rounded uppercase">
              Aktiv
            </span>
          )}
        </div>
      </button>

      {/* Custom palette actions */}
      {customOptions && (
        <div className="flex gap-1 px-3 pb-3 border-t border-spa-border pt-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); customOptions.onUpdate(); }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-lg bg-spa-accent/10 text-spa-accent hover:bg-spa-accent/20 transition-colors font-medium"
            title="Aktuelle Farben in diese Palette speichern"
          >
            <Save className="w-3 h-3" />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); customOptions.onDelete(); }}
            disabled={customOptions.isDeleting}
            className="flex items-center justify-center px-2 py-1 text-xs rounded-lg bg-spa-error-light text-spa-error hover:bg-spa-error-light transition-colors disabled:opacity-50"
            title="Palette löschen"
            aria-label="Palette löschen"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function PaletteSelector({
  theme,
  colorPalette,
  onApplyPalette,
}: PaletteSelectorProps) {
  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [savingPalette, setSavingPalette] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustomPalettes = useCallback(async () => {
    try {
      const palettes = await palettesApi.getAll();
      setCustomPalettes(palettes);
    } catch (err) {
      console.error('[PaletteSelector] Failed to load custom palettes:', err);
    }
  }, []);

  useEffect(() => { loadCustomPalettes(); }, [loadCustomPalettes]);

  const handleCreatePalette = async () => {
    if (!newPaletteName.trim()) return;
    setSavingPalette(true);
    try {
      await palettesApi.create(newPaletteName.trim(), theme);
      setNewPaletteName('');
      setShowCreateDialog(false);
      await loadCustomPalettes();
    } catch (err) {
      console.error('[PaletteSelector] Failed to create palette:', err);
    } finally {
      setSavingPalette(false);
    }
  };

  const handleUpdatePalette = async (palette: CustomPalette) => {
    try {
      await palettesApi.update(palette.id, palette.name, theme);
      await loadCustomPalettes();
    } catch (err) {
      console.error('[PaletteSelector] Failed to update palette:', err);
    }
  };

  const handleDeletePalette = async (id: string) => {
    setDeletingId(id);
    try {
      await palettesApi.delete(id);
      if (colorPalette === id) {
        onApplyPalette(COLOR_PALETTES[0].id, COLOR_PALETTES[0].colors);
      }
      await loadCustomPalettes();
    } catch (err) {
      console.error('[PaletteSelector] Failed to delete palette:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Built-in palettes */}
      <fieldset>
        <legend className="text-lg font-semibold text-spa-text-primary mb-1">Farbschemata</legend>
        <p className="text-sm text-spa-text-secondary mb-4">Globale Farbpalette für das gesamte System</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Farbpaletten">
          {COLOR_PALETTES.map((palette) => (
            <PaletteCard
              key={palette.id}
              id={palette.id}
              name={palette.name}
              colors={palette.colors}
              isActive={colorPalette === palette.id}
              onSelect={() => onApplyPalette(palette.id, palette.colors)}
            />
          ))}

          {/* Add custom palette tile */}
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="bg-spa-bg-secondary rounded-xl border-2 border-dashed border-spa-border flex flex-col items-center justify-center gap-1 py-3 group hover:bg-spa-surface hover:border-spa-primary/60 transition-all"
          >
            <Plus className="w-4 h-4 text-spa-text-secondary group-hover:text-spa-primary transition-colors" />
            <span className="text-xs font-semibold text-spa-text-secondary group-hover:text-spa-primary transition-colors">
              Eigenes Schema
            </span>
          </button>
        </div>
      </fieldset>

      {/* Custom palette creation form */}
      {showCreateDialog && (
        <div className="p-4 bg-spa-bg-secondary rounded-xl border border-spa-border">
          <p className="text-sm font-semibold text-spa-text-primary mb-2">
            Aktuelle Farben als neue Palette speichern:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPaletteName}
              onChange={(e) => setNewPaletteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePalette()}
              placeholder="Name der Palette..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm border rounded-lg border-spa-border bg-spa-surface text-spa-text-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/40"
            />
            <button
              type="button"
              onClick={handleCreatePalette}
              disabled={!newPaletteName.trim() || savingPalette}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateDialog(false); setNewPaletteName(''); }}
              className="px-2 py-2 rounded-lg text-spa-text-secondary hover:text-spa-text-secondary hover:bg-spa-bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Custom palettes grid */}
      {customPalettes.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-spa-text-secondary mb-3">Eigene Paletten</p>
          <div className="grid grid-cols-3 gap-2">
            {customPalettes.map((cp) => (
              <PaletteCard
                key={cp.id}
                id={cp.id}
                name={cp.name}
                colors={cp.colors as Partial<ThemeColors>}
                isActive={colorPalette === cp.id}
                onSelect={() => onApplyPalette(cp.id, cp.colors as Partial<ThemeColors>)}
                customOptions={{
                  onUpdate: () => handleUpdatePalette(cp),
                  onDelete: () => handleDeletePalette(cp.id),
                  isDeleting: deletingId === cp.id,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
