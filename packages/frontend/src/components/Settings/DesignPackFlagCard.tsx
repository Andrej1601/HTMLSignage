import { Palette } from 'lucide-react';
import type { DisplaySettings } from '@/types/settings.types';
import { DESIGN_IDS, DEFAULT_DESIGN_ID, type DesignId } from '@/designs';

interface DesignPackFlagCardProps {
  display: DisplaySettings | undefined;
  onChange: (next: DisplaySettings) => void;
}

/**
 * Design-pack picker.
 *
 * Since phase 3 the design-pack pipeline is always active — there is
 * no legacy fallback to toggle to. This card just lets the operator
 * pick which registered pack to render. The `useDesignPacks` flag is
 * kept for device-setting backwards compatibility but ignored by the
 * host.
 */
export function DesignPackFlagCard({ display, onChange }: DesignPackFlagCardProps) {
  const activeId = (display?.designPackId as DesignId | undefined) ?? DEFAULT_DESIGN_ID;

  const setDesignId = (value: DesignId) => {
    onChange({ ...(display ?? {}), designPackId: value });
  };

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <h4 className="mb-1 flex items-center gap-2 text-base font-semibold text-spa-text-primary">
        <Palette className="h-4 w-4" />
        Design
      </h4>
      <p className="mb-4 text-sm text-spa-text-secondary">
        Wählt das Design, mit dem alle Slides auf allen Anzeigen gerendert werden.
        Farben, Schriften und Abstände kommen aus dem Design; die Theme-Palette im
        Abschnitt „Theme" überschreibt seine Farben an den passenden Stellen.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
          Aktives Design
        </span>
        <select
          value={activeId}
          onChange={(event) => setDesignId(event.target.value as DesignId)}
          className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-sm text-spa-text-primary"
        >
          {DESIGN_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 rounded-lg bg-spa-bg-primary px-3 py-2 text-xs text-spa-text-secondary">
        <strong className="text-spa-text-primary">Hinweis:</strong>{' '}
        Änderungen greifen erst nach <em>Speichern</em> und einem harten Reload
        auf der Anzeige (Strg+F5).
      </div>
    </div>
  );
}
