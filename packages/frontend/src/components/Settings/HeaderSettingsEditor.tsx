import { useMemo } from 'react';
import { PanelTop, Image as ImageIcon } from 'lucide-react';
import type { HeaderSettings } from '@/types/settings.types';
import { useMedia } from '@/hooks/useMedia';
import { buildUploadUrl } from '@/utils/mediaUrl';

interface HeaderSettingsEditorProps {
  /** Currently-effective header settings (already merged + defaulted). */
  value: HeaderSettings;
  /**
   * Emits the new merged value. The caller decides whether to persist
   * globally (`settings.header`) or into a slideshow's `header`
   * override — the editor itself is scope-agnostic.
   */
  onChange: (next: HeaderSettings) => void;
  /** Optional — shown above the editor to indicate scope. */
  scopeLabel?: string;
  disabled?: boolean;
}

/**
 * Editor for the display's branding header (logo text, subtitle,
 * clock/date toggles, height). Works both globally and inside a
 * slideshow override — the parent decides where the value lives.
 */
export function HeaderSettingsEditor({
  value,
  onChange,
  scopeLabel,
  disabled = false,
}: HeaderSettingsEditorProps) {
  const set = <K extends keyof HeaderSettings>(key: K, next: HeaderSettings[K]) => {
    onChange({ ...value, [key]: next });
  };

  // Image picker pulls image-type media only. Keeps the grid scoped to
  // things that actually make sense as a logo — videos would just break.
  const { data: media } = useMedia({ type: 'image' });
  const images = useMemo(() => media || [], [media]);
  const currentImage = useMemo(
    () => images.find((item) => item.id === value.logoImageId),
    [images, value.logoImageId],
  );

  return (
    <div className="rounded-xl border border-spa-border bg-spa-surface p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PanelTop className="h-4 w-4 text-spa-primary" />
          <h4 className="text-sm font-semibold text-spa-text-primary">Kopfzeile</h4>
        </div>
        {scopeLabel ? (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-spa-text-secondary">
            {scopeLabel}
          </span>
        ) : null}
      </div>

      <p className="mb-4 text-xs text-spa-text-secondary">
        Titel, Untertitel und Elemente der Anzeige-Kopfzeile. Die Kopfzeile
        erscheint im Split-, Grid-, Full-Rotation- und klassischen
        Triple-Layout. Die Stage-Layouts <em>Editorial Resort</em> und
        <em> Mineral Noir</em> bringen ihr eigenes Chrome mit und ignorieren
        diese Einstellungen.
      </p>

      {/* Enable toggle */}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(event) => set('enabled', event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-spa-border text-spa-primary focus:ring-spa-primary"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-spa-text-primary">
            Kopfzeile anzeigen
          </span>
          <span className="text-xs text-spa-text-secondary">
            Aus = Displays rendern ohne Branding-Streifen oben.
          </span>
        </span>
      </label>

      <div
        className={`mt-4 space-y-4 transition-opacity ${value.enabled ? 'opacity-100' : 'opacity-60'}`}
      >
        {/* Logo text */}
        <div>
          <label
            htmlFor="header-logo-text"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary"
          >
            Titel
          </label>
          <input
            id="header-logo-text"
            type="text"
            value={value.logoText ?? ''}
            disabled={disabled || !value.enabled}
            maxLength={80}
            placeholder="Westfalenbad Hagen"
            onChange={(event) => set('logoText', event.target.value)}
            className="w-full rounded-lg border border-spa-border bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-1 focus:ring-spa-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-spa-text-secondary">
            Das erste Wort wird dunkel, der Rest in der Akzentfarbe dargestellt.
            Lass das Feld leer, um den Fallback „HTML Signage" zu nutzen.
          </p>
        </div>

        {/* Subtitle */}
        <div>
          <label
            htmlFor="header-subtitle"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary"
          >
            Untertitel
          </label>
          <input
            id="header-subtitle"
            type="text"
            value={value.subtitle ?? ''}
            disabled={disabled || !value.enabled}
            maxLength={80}
            placeholder="Saunawelt"
            onChange={(event) => set('subtitle', event.target.value)}
            className="w-full rounded-lg border border-spa-border bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-1 focus:ring-spa-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Logo image picker. Optional — when set, displays render this
            image instead of the two-tone title text. */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
              Logo-Bild
            </label>
            {value.logoImageId ? (
              <button
                type="button"
                disabled={disabled || !value.enabled}
                onClick={() => set('logoImageId', undefined)}
                className="text-[11px] font-semibold text-spa-text-secondary hover:text-spa-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Entfernen
              </button>
            ) : null}
          </div>
          <p className="mb-2 text-xs text-spa-text-secondary">
            Optional. Wenn gesetzt, rendern Displays dieses Bild statt des
            Titels. Lade Bilder vorher in der Mediathek hoch (Typ: Bild).
          </p>

          {currentImage ? (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-spa-border bg-spa-bg-primary px-3 py-2">
              <img
                src={buildUploadUrl(currentImage.filename)}
                alt={currentImage.originalName}
                className="h-10 w-10 shrink-0 rounded object-contain bg-white"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-spa-text-primary">
                  {currentImage.originalName}
                </div>
                <div className="text-[11px] text-spa-text-secondary">
                  Aktuell ausgewählt
                </div>
              </div>
            </div>
          ) : null}

          {images.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-spa-border bg-spa-surface px-3 py-3 text-xs text-spa-text-secondary">
              <ImageIcon className="h-4 w-4 text-spa-primary" />
              Keine Bilder verfügbar. Lade zuerst eines in der Mediathek hoch.
            </div>
          ) : (
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-spa-border bg-spa-surface p-2 md:grid-cols-4">
              <button
                type="button"
                disabled={disabled || !value.enabled}
                onClick={() => set('logoImageId', undefined)}
                className={`flex aspect-square items-center justify-center rounded-md border-2 px-2 text-center text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  !value.logoImageId
                    ? 'border-spa-primary bg-spa-primary/10 text-spa-primary'
                    : 'border-spa-border text-spa-text-secondary hover:border-spa-primary/40'
                }`}
              >
                Nur Text
              </button>
              {images.map((image) => {
                const isSelected = value.logoImageId === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    disabled={disabled || !value.enabled}
                    onClick={() => set('logoImageId', image.id)}
                    title={image.originalName}
                    className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? 'border-spa-primary ring-2 ring-spa-primary/20'
                        : 'border-spa-border hover:border-spa-primary/40'
                    }`}
                  >
                    <img
                      src={buildUploadUrl(image.filename)}
                      alt={image.originalName}
                      className="h-full w-full bg-white object-contain"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ToggleRow
            label="Logo/Titel"
            description="Kopfzeile mit Titel-Text"
            checked={value.showLogo}
            disabled={disabled || !value.enabled}
            onChange={(next) => set('showLogo', next)}
          />
          <ToggleRow
            label="Uhr"
            description="Aktuelle Zeit rechts oben"
            checked={value.showClock}
            disabled={disabled || !value.enabled}
            onChange={(next) => set('showClock', next)}
          />
          <ToggleRow
            label="Datum"
            description="Aktuelles Datum rechts unten"
            checked={value.showDate}
            disabled={disabled || !value.enabled}
            onChange={(next) => set('showDate', next)}
          />
        </div>

        {/* Height */}
        <div>
          <label
            htmlFor="header-height"
            className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-spa-text-secondary"
          >
            <span>Höhe</span>
            <span className="font-mono text-spa-text-primary">
              {value.height ?? 8}%
            </span>
          </label>
          <input
            id="header-height"
            type="range"
            min={5}
            max={15}
            step={1}
            value={value.height ?? 8}
            disabled={disabled || !value.enabled}
            onChange={(event) => set('height', Number.parseInt(event.target.value, 10))}
            className="w-full accent-spa-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-spa-text-secondary">
            Prozent der Bildschirmhöhe, die die Kopfzeile einnimmt.
            Standard: 8%.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-spa-border bg-spa-bg-primary p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-spa-border text-spa-primary focus:ring-spa-primary disabled:cursor-not-allowed"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-spa-text-primary">{label}</span>
        <span className="text-[11px] text-spa-text-secondary">{description}</span>
      </span>
    </label>
  );
}
