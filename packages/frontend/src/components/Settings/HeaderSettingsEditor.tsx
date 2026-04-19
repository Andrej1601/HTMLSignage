import { PanelTop } from 'lucide-react';
import type { HeaderSettings } from '@/types/settings.types';

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
