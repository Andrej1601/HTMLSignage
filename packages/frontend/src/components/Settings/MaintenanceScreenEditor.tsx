import { useMemo } from 'react';
import { useMedia } from '@/hooks/useMedia';
import type { MaintenanceScreenSettings } from '@/types/settings.types';
import { buildUploadUrl, getMediaUploadUrl } from '@/utils/mediaUrl';
import { normalizeMaintenanceScreenSettings } from '@/config/maintenanceScreen';
import { Monitor, RotateCcw, Image } from 'lucide-react';

interface MaintenanceScreenEditorProps {
  value?: MaintenanceScreenSettings;
  onChange: (value: MaintenanceScreenSettings) => void;
}

export function MaintenanceScreenEditor({ value, onChange }: MaintenanceScreenEditorProps) {
  const { data: media } = useMedia({ type: 'image' });
  const images = useMemo(() => media || [], [media]);
  const normalized = useMemo(() => normalizeMaintenanceScreenSettings(value), [value]);

  const backgroundPreviewUrl = useMemo(
    () => getMediaUploadUrl(images, normalized.backgroundImageId),
    [images, normalized.backgroundImageId],
  );

  const update = (patch: Partial<MaintenanceScreenSettings>) => {
    onChange({ ...normalized, ...patch });
  };

  const isGlass = normalized.displayStyle === 'glass';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">

        {/* Left: Config */}
        <div className="space-y-5 rounded-2xl border border-spa-bg-secondary/80 bg-spa-bg-primary/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary">Wartungsscreen</h3>
              <p className="mt-1 text-sm text-spa-text-secondary">
                Text und Hintergrund für Displays im Wartungsmodus festlegen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(normalizeMaintenanceScreenSettings(undefined))}
              className="flex items-center gap-1.5 rounded-lg border border-spa-bg-secondary px-3 py-1.5 text-xs font-medium text-spa-text-secondary hover:bg-spa-bg-secondary transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Zurücksetzen
            </button>
          </div>

          {/* Display style toggle */}
          <div className="rounded-xl border border-spa-bg-secondary bg-white p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-spa-text-primary">Anzeigestil</p>
              <p className="text-xs text-spa-text-secondary mt-0.5">
                Wählen Sie die visuelle Erscheinung des Wartungsscreens auf den Geräten.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => update({ displayStyle: 'glass' })}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                  isGlass
                    ? 'border-spa-primary bg-spa-primary/5 text-spa-primary'
                    : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/40'
                }`}
              >
                {/* Glass mini-preview */}
                <div className="relative h-14 w-full overflow-hidden rounded-lg bg-linear-to-br from-stone-700 to-stone-900">
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur-xs">
                      <div className="text-[7px] font-semibold uppercase tracking-wider text-white/60">Wartung</div>
                      <div className="text-[8px] font-bold text-white leading-tight mt-0.5">Gleich zurück</div>
                    </div>
                  </div>
                </div>
                <span>Glassmorphismus</span>
              </button>
              <button
                type="button"
                onClick={() => update({ displayStyle: 'overlay' })}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                  !isGlass
                    ? 'border-spa-primary bg-spa-primary/5 text-spa-primary'
                    : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/40'
                }`}
              >
                {/* Overlay mini-preview */}
                <div className="relative h-14 w-full overflow-hidden rounded-lg bg-linear-to-br from-stone-700 to-stone-900">
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <div className="mb-1 rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[6px] font-bold uppercase tracking-widest text-amber-300">Wartung</div>
                    <div className="text-[8px] font-bold text-white">Gleich zurück</div>
                  </div>
                </div>
                <span>Overlay</span>
              </button>
            </div>
          </div>

          {/* Text fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                Label
              </label>
              <input
                type="text"
                value={normalized.label}
                onChange={(e) => update({ label: e.target.value })}
                className="w-full rounded-xl border border-spa-bg-secondary bg-white px-3 py-2.5 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20"
                placeholder="Wartungsmodus"
              />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-spa-bg-secondary bg-white px-4 py-3">
              <div>
                <div className="text-sm font-medium text-spa-text-primary">Gerätename anzeigen</div>
                <div className="text-xs text-spa-text-secondary">
                  Blendet den Namen des betroffenen Displays ein.
                </div>
              </div>
              <input
                type="checkbox"
                checked={normalized.showDeviceName}
                onChange={(e) => update({ showDeviceName: e.target.checked })}
                className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
              />
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
              Überschrift
            </label>
            <input
              type="text"
              value={normalized.headline}
              onChange={(e) => update({ headline: e.target.value })}
              className="w-full rounded-xl border border-spa-bg-secondary bg-white px-3 py-2.5 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20"
              placeholder="Display vorübergehend pausiert"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
              Hinweistext
            </label>
            <textarea
              value={normalized.message}
              onChange={(e) => update({ message: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-spa-bg-secondary bg-white px-3 py-3 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-2 focus:ring-spa-primary/20"
              placeholder="Dieses Gerät ist aktuell für Wartung reserviert."
            />
          </div>

          {/* Image picker */}
          <div className="space-y-3">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">Hintergrundbild</h4>
              <p className="mt-0.5 text-xs text-spa-text-secondary">
                Optional. Ohne Auswahl nutzt der Screen den Standardverlauf.
              </p>
            </div>
            {images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-spa-bg-secondary bg-white/70 px-4 py-6 text-sm text-spa-text-secondary text-center">
                Keine Bilder verfügbar. Lade zuerst in der Mediathek ein Bild hoch.
              </div>
            ) : (
              <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-spa-bg-secondary bg-white p-2 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => update({ backgroundImageId: undefined })}
                  className={`flex aspect-[4/3] items-center justify-center rounded-lg border-2 px-2 text-center text-xs font-medium transition-colors ${
                    !normalized.backgroundImageId
                      ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                      : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/40'
                  }`}
                >
                  Standard
                </button>
                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => update({ backgroundImageId: image.id })}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-colors ${
                      normalized.backgroundImageId === image.id
                        ? 'border-spa-primary ring-2 ring-spa-primary/20'
                        : 'border-spa-bg-secondary hover:border-spa-primary/40'
                    }`}
                    title={image.originalName}
                  >
                    <img
                      src={buildUploadUrl(image.filename)}
                      alt={image.originalName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-2 py-1.5 text-left text-[10px] text-white">
                      <div className="line-clamp-1">{image.originalName}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-spa-text-primary">
            <Monitor className="h-4 w-4" />
            Live-Vorschau
          </div>

          <div
            className="relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-spa-bg-secondary/80 shadow-xs"
            style={
              backgroundPreviewUrl
                ? {
                    backgroundImage: `linear-gradient(135deg, rgba(16, 10, 6, 0.56), rgba(30, 20, 12, 0.8)), url(${backgroundPreviewUrl})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                  }
                : {
                    backgroundImage: 'radial-gradient(circle at top, #f2ebdf 0%, #d6b998 45%, #7f674d 100%)',
                  }
            }
          >
            <div className="absolute inset-0 bg-black/5" />

            {isGlass ? (
              /* ── Glassmorphismus-Stil ── */
              <div className="relative flex w-full items-center justify-center p-6">
                <div className="max-w-xl rounded-[1.75rem] border border-white/20 bg-black/20 px-8 py-10 text-center text-white shadow-2xl backdrop-blur-xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/75">
                    {normalized.label}
                  </div>
                  <h4 className="mt-5 text-3xl font-semibold tracking-tight">
                    {normalized.headline}
                  </h4>
                  <p className="mt-5 text-base leading-relaxed text-white/85">
                    {normalized.message}
                  </p>
                  {normalized.showDeviceName && (
                    <div className="mt-6 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/85">
                      Display Sauna-Lounge
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Overlay-Stil ── */
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-10"
                style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
              >
                <div className="mb-5 rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                  {normalized.label}
                </div>
                <h4 className="text-4xl font-bold text-white tracking-tight leading-tight mb-4">
                  {normalized.headline}
                </h4>
                <p className="text-white/80 max-w-sm text-sm leading-relaxed">
                  {normalized.message}
                </p>
                {normalized.showDeviceName && (
                  <div className="absolute bottom-4 right-5 text-white/40 text-[10px] font-mono">
                    Device: SAUNA-RECEPT-01
                  </div>
                )}
              </div>
            )}
          </div>

          {normalized.backgroundImageId && (
            <div className="flex items-center gap-2 rounded-xl border border-spa-bg-secondary bg-white/80 px-3 py-2 text-xs text-spa-text-secondary">
              <Image className="h-4 w-4 text-spa-primary" />
              Das ausgewählte Bild wird mit einem dunklen Overlay hinterlegt, damit der Text lesbar bleibt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
