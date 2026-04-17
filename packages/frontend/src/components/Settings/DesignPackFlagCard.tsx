import { FlaskConical } from 'lucide-react';
import type { DisplaySettings } from '@/types/settings.types';
import { DESIGN_IDS, DEFAULT_DESIGN_ID, type DesignId } from '@/designs';

interface DesignPackFlagCardProps {
  display: DisplaySettings | undefined;
  onChange: (next: DisplaySettings) => void;
}

/**
 * Experimental toggle for the design-pack rendering pipeline.
 *
 * This is a test-only card — the permanent UI lands in the theme
 * editor during Phase 4 (tenant overrides). Until then, flipping this
 * flag per environment lets us A/B the new pack against the legacy
 * components without a deploy.
 */
export function DesignPackFlagCard({ display, onChange }: DesignPackFlagCardProps) {
  const enabled = display?.useDesignPacks === true;
  const activeId = (display?.designPackId as DesignId | undefined) ?? DEFAULT_DESIGN_ID;

  const setEnabled = (value: boolean) => {
    onChange({ ...(display ?? {}), useDesignPacks: value });
  };

  const setDesignId = (value: DesignId) => {
    onChange({ ...(display ?? {}), designPackId: value });
  };

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <h4 className="mb-1 flex items-center gap-2 text-base font-semibold text-spa-text-primary">
        <FlaskConical className="h-4 w-4" />
        Design-Packs (Beta)
      </h4>
      <p className="mb-4 text-sm text-spa-text-secondary">
        Aktiviert die neue Design-Pack-Render-Pipeline. Solange die Option aus ist,
        rendern alle Anzeigen unverändert mit dem Legacy-Renderer.
      </p>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-spa-text-primary">
            Design-Packs aktivieren
          </span>
          <span className="text-xs text-spa-text-secondary">
            Rendert jeden Slide-Typ durch den DesignHost. Bei Fehler fällt die
            Anzeige automatisch auf den Legacy-Renderer zurück.
          </span>
        </span>
      </label>

      <div className={`mt-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-60'}`}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
            Aktives Design
          </span>
          <select
            value={activeId}
            disabled={!enabled}
            onChange={(event) => setDesignId(event.target.value as DesignId)}
            className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-sm text-spa-text-primary disabled:cursor-not-allowed"
          >
            {DESIGN_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-spa-bg-primary px-3 py-2 text-xs text-spa-text-secondary">
        <strong className="text-spa-text-primary">Hinweis:</strong>{' '}
        Änderungen greifen erst nach <em>Speichern</em> und einem harten Reload
        auf der Anzeige (Strg+F5).
      </div>
    </div>
  );
}
