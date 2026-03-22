import { useState, useEffect, useCallback } from 'react';
import type { ThemeColors, ColorPaletteName } from '@/types/settings.types';
import { COLOR_PALETTES, generateDashboardColors } from '@/types/settings.types';
import { palettesApi, type CustomPalette } from '@/services/api';
import { Palette, Plus, Trash2, Save, X } from 'lucide-react';

interface PaletteSelectorProps {
  theme: ThemeColors;
  colorPalette?: ColorPaletteName;
  onApplyPalette: (paletteId: ColorPaletteName, colors: Partial<ThemeColors>) => void;
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

  useEffect(() => {
    loadCustomPalettes();
  }, [loadCustomPalettes]);

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

  const renderPaletteCard = (
    id: string,
    name: string,
    colors: Partial<ThemeColors>,
    options?: { isCustom?: boolean; customPalette?: CustomPalette }
  ) => {
    const isActive = colorPalette === id;
    const previewTheme = generateDashboardColors(colors);
    const swatches = [
      { label: 'BG', color: previewTheme.dashboardBg || previewTheme.bg || '#000000' },
      { label: 'Card', color: previewTheme.cardBg || previewTheme.cellBg || '#000000' },
      { label: 'Text', color: previewTheme.textMain || previewTheme.fg || '#000000' },
      { label: 'A1', color: previewTheme.accentGold || previewTheme.accent || '#000000' },
      { label: 'A2', color: previewTheme.accentGreen || previewTheme.timeColBg || '#000000' },
      { label: 'Live', color: previewTheme.statusLive || '#10B981' },
    ];

    return (
      <div
        key={id}
        className={`relative p-4 border-2 rounded-lg transition-all text-left group ${
          isActive
            ? 'border-spa-accent bg-spa-accent/5 shadow-md'
            : 'border-spa-secondary/20 hover:border-spa-accent hover:shadow-md'
        }`}
      >
        <button
          onClick={() => onApplyPalette(id, colors)}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-accent focus-visible:ring-offset-2 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`font-medium ${isActive ? 'text-spa-accent' : 'text-spa-text-primary group-hover:text-spa-accent'} transition-colors`}>
              {name}
            </div>
            {isActive && <div className="w-2 h-2 rounded-full bg-spa-accent" />}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {swatches.map((swatch) => (
              <div key={swatch.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded border border-black/10"
                  style={{ backgroundColor: swatch.color }}
                  title={`${swatch.label}: ${swatch.color}`}
                />
                <span className="text-[10px] text-spa-text-secondary leading-none">{swatch.label}</span>
              </div>
            ))}
          </div>
        </button>

        {options?.isCustom && options.customPalette && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-spa-secondary/20">
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdatePalette(options.customPalette!); }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-spa-accent/10 text-spa-accent hover:bg-spa-accent/20 transition-colors"
              title="Aktuelle Farben in diese Palette speichern"
            >
              <Save className="w-3 h-3" />
              Aktualisieren
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeletePalette(options.customPalette!.id); }}
              disabled={deletingId === options.customPalette!.id}
              className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Palette löschen"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-lg font-semibold text-spa-text-primary mb-3 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Farbpaletten
        </legend>
        <p className="text-sm text-spa-text-secondary mb-4">
          Wähle eine Farbpalette. Diese Farben steuern direkt die Slideshow-Darstellung.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Farbpaletten">
          {COLOR_PALETTES.map((palette) =>
            renderPaletteCard(palette.id, palette.name, palette.colors)
          )}
        </div>
      </fieldset>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
            Eigene Paletten
          </h3>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Palette
          </button>
        </div>

        {showCreateDialog && (
          <div className="mb-4 p-4 bg-spa-bg-secondary rounded-lg border border-spa-secondary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-spa-text-primary">Aktuelle Farben als neue Palette speichern:</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePalette()}
                placeholder="Name der Palette..."
                className="flex-1 px-3 py-2 text-sm border rounded-lg border-spa-secondary/30 bg-white text-spa-text-primary focus:outline-none focus:ring-2 focus:ring-spa-accent/50"
                autoFocus
              />
              <button
                onClick={handleCreatePalette}
                disabled={!newPaletteName.trim() || savingPalette}
                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
              <button
                onClick={() => { setShowCreateDialog(false); setNewPaletteName(''); }}
                className="flex items-center px-2 py-2 text-sm rounded-lg text-spa-text-secondary hover:text-spa-text-primary hover:bg-spa-secondary/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-spa-text-secondary mt-2">
              Die aktuell eingestellten Farben werden als neue Palette gespeichert.
            </p>
          </div>
        )}

        {customPalettes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {customPalettes.map((cp) =>
              renderPaletteCard(cp.id, cp.name, cp.colors as Partial<ThemeColors>, {
                isCustom: true,
                customPalette: cp,
              })
            )}
          </div>
        ) : !showCreateDialog ? (
          <p className="text-sm text-spa-text-secondary italic">
            Noch keine eigenen Paletten erstellt. Passe die Farben an und klicke "Neue Palette" um sie zu speichern.
          </p>
        ) : null}
      </div>
    </div>
  );
}
