import { useMemo } from 'react';
import { useMedia } from '@/hooks/useMedia';
import type { MaintenanceScreenSettings } from '@/types/settings.types';
import { buildUploadUrl, getMediaUploadUrl } from '@/utils/mediaUrl';
import { normalizeMaintenanceScreenSettings } from '@/config/maintenanceScreen';
import { Image, Monitor } from 'lucide-react';

interface MaintenanceScreenEditorProps {
  value?: MaintenanceScreenSettings;
  onChange: (value: MaintenanceScreenSettings) => void;
}

export function MaintenanceScreenEditor({ value, onChange }: MaintenanceScreenEditorProps) {
  const { data: media } = useMedia({ type: 'image' });
  const images = useMemo(() => media || [], [media]);
  const normalized = useMemo(
    () => normalizeMaintenanceScreenSettings(value),
    [value],
  );

  const backgroundPreviewUrl = useMemo(
    () => getMediaUploadUrl(images, normalized.backgroundImageId),
    [images, normalized.backgroundImageId],
  );

  const update = (patch: Partial<MaintenanceScreenSettings>) => {
    onChange({
      ...normalized,
      ...patch,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5 rounded-2xl border border-spa-bg-secondary/80 bg-spa-bg-primary/40 p-5">
          <div>
            <h3 className="text-lg font-semibold text-spa-text-primary">Wartungsscreen</h3>
            <p className="mt-1 text-sm text-spa-text-secondary">
              Text und Hintergrund fuer Displays im Wartungsmodus festlegen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-spa-text-primary">
                Label
              </label>
              <input
                type="text"
                value={normalized.label}
                onChange={(event) => update({ label: event.target.value })}
                className="w-full rounded-xl border border-spa-bg-secondary bg-white px-4 py-2.5 text-sm text-spa-text-primary focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="Wartungsmodus"
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-spa-bg-secondary bg-white px-4 py-3">
              <div>
                <div className="text-sm font-medium text-spa-text-primary">Geraetename anzeigen</div>
                <div className="text-xs text-spa-text-secondary">
                  Blendet den Namen des betroffenen Displays im Screen ein.
                </div>
              </div>
              <input
                type="checkbox"
                checked={normalized.showDeviceName}
                onChange={(event) => update({ showDeviceName: event.target.checked })}
                className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
              />
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-spa-text-primary">
              Ueberschrift
            </label>
            <input
              type="text"
              value={normalized.headline}
              onChange={(event) => update({ headline: event.target.value })}
              className="w-full rounded-xl border border-spa-bg-secondary bg-white px-4 py-2.5 text-sm text-spa-text-primary focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Display voruebergehend pausiert"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-spa-text-primary">
              Hinweistex
            </label>
            <textarea
              value={normalized.message}
              onChange={(event) => update({ message: event.target.value })}
              rows={4}
              className="w-full rounded-xl border border-spa-bg-secondary bg-white px-4 py-3 text-sm text-spa-text-primary focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Dieses Geraet ist aktuell fuer Wartung reserviert."
            />
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-spa-text-primary">Hintergrundbild</h4>
              <p className="mt-1 text-xs text-spa-text-secondary">
                Optional. Ohne Auswahl nutzt der Screen den Standardverlauf.
              </p>
            </div>

            {images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-spa-bg-secondary bg-white/70 px-4 py-6 text-sm text-spa-text-secondary">
                Keine Bilder verfuegbar. Lade zuerst in der Mediathek ein Bild hoch.
              </div>
            ) : (
              <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto rounded-xl border border-spa-bg-secondary bg-white p-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => update({ backgroundImageId: undefined })}
                  className={`flex aspect-[4/3] items-center justify-center rounded-xl border-2 px-3 text-center text-xs font-medium transition-colors ${
                    !normalized.backgroundImageId
                      ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                      : 'border-spa-bg-secondary text-spa-text-secondary hover:border-spa-primary/50'
                  }`}
                >
                  Standard
                </button>

                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => update({ backgroundImageId: image.id })}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-colors ${
                      normalized.backgroundImageId === image.id
                        ? 'border-spa-primary ring-2 ring-spa-primary/20'
                        : 'border-spa-bg-secondary hover:border-spa-primary/50'
                    }`}
                    title={image.originalName}
                  >
                    <img
                      src={buildUploadUrl(image.filename)}
                      alt={image.originalName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2 text-left text-[11px] text-white">
                      <div className="line-clamp-2">{image.originalName}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-spa-text-primary">
            <Monitor className="h-4 w-4" />
            Live-Vorschau
          </div>

          <div
            className="relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-spa-bg-secondary/80 shadow-sm"
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
          </div>

          {normalized.backgroundImageId && (
            <div className="flex items-center gap-2 rounded-xl border border-spa-bg-secondary bg-white/80 px-3 py-2 text-xs text-spa-text-secondary">
              <Image className="h-4 w-4 text-spa-primary" />
              Das ausgewaehlte Bild wird mit einem dunklen Overlay hinterlegt, damit der Text lesbar bleibt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
