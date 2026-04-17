import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Save, SlidersHorizontal } from 'lucide-react';
import type { DisplaySettings } from '@/types/settings.types';
import {
  designTokenOverridesSchema,
  type DesignTokenOverrides,
} from '@htmlsignage/design-sdk';

interface DesignTokenOverrideEditorProps {
  display: DisplaySettings | undefined;
  onChange: (next: DisplaySettings) => void;
}

const EMPTY_TEMPLATE = `{
  "colors": {
    "accentPrimary": "#...",
    "surface": "#..."
  }
}
`;

type ParseResult =
  | { ok: true; value: DesignTokenOverrides; empty: boolean }
  | { ok: false; message: string };

function parseInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: {}, empty: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? `Ungültiges JSON: ${err.message}` : 'Ungültiges JSON.',
    };
  }

  const result = designTokenOverridesSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join('.') || '<root>';
    return {
      ok: false,
      message: `${path}: ${firstIssue.message}`,
    };
  }

  return { ok: true, value: result.data as DesignTokenOverrides, empty: false };
}

/**
 * JSON editor for design-token overrides.
 *
 * Operators paste a `DesignTokenOverrides` snippet (category-level
 * partials: colors / typography / spacing / radius / motion). The
 * editor validates against the SDK's Zod schema on every keystroke
 * and unlocks "Anwenden" only when the input parses cleanly. Saved
 * values are applied on top of the pack defaults + theme palette in
 * the canonical merge order.
 */
export function DesignTokenOverrideEditor({
  display,
  onChange,
}: DesignTokenOverrideEditorProps) {
  const saved = display?.designTokenOverrides;
  const initial = useMemo(
    () => (saved && Object.keys(saved as object).length > 0 ? JSON.stringify(saved, null, 2) : ''),
    [saved],
  );

  const [draft, setDraft] = useState<string>(initial);
  const parse = useMemo(() => parseInput(draft), [draft]);
  const dirty = draft.trim() !== initial.trim();

  const canApply = parse.ok && dirty;
  const hasSaved = saved != null && Object.keys(saved as object).length > 0;

  const handleApply = useCallback(() => {
    if (!parse.ok) return;
    const nextDisplay: DisplaySettings = { ...(display ?? {}) };
    if (parse.empty) {
      delete nextDisplay.designTokenOverrides;
    } else {
      nextDisplay.designTokenOverrides = parse.value;
    }
    onChange(nextDisplay);
  }, [display, onChange, parse]);

  const handleReset = useCallback(() => {
    setDraft('');
    const nextDisplay: DisplaySettings = { ...(display ?? {}) };
    delete nextDisplay.designTokenOverrides;
    onChange(nextDisplay);
  }, [display, onChange]);

  const handleLoadTemplate = useCallback(() => {
    if (draft.trim().length === 0) {
      setDraft(EMPTY_TEMPLATE);
    }
  }, [draft]);

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <h4 className="mb-1 flex items-center gap-2 text-base font-semibold text-spa-text-primary">
        <SlidersHorizontal className="h-4 w-4" />
        Design-Token-Overrides
      </h4>
      <p className="mb-3 text-sm text-spa-text-secondary">
        Überschreibt einzelne Design-Tokens (Farben, Typografie, Spacing, Radius,
        Motion) ohne Code-Deploy. Die JSON-Struktur folgt{' '}
        <code className="rounded bg-spa-bg-primary px-1 py-0.5 text-xs">
          DesignTokenOverrides
        </code>
        . Felder, die du weglässt, bleiben vom aktiven Design gesteuert.
      </p>

      <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
        <span>JSON</span>
        {draft.trim().length === 0 ? (
          <button
            type="button"
            onClick={handleLoadTemplate}
            className="font-normal normal-case tracking-normal text-spa-primary hover:underline"
          >
            Beispiel einfügen
          </button>
        ) : null}
      </label>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
        placeholder="{}"
        rows={10}
        className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface p-3 font-mono text-xs text-spa-text-primary focus:border-spa-primary focus:outline-none"
      />

      <div className="mt-2 flex items-start gap-2 min-h-[1.25rem] text-xs">
        {parse.ok ? (
          parse.empty ? (
            <span className="text-spa-text-secondary">Keine Overrides gesetzt.</span>
          ) : (
            <span className="flex items-center gap-1 text-spa-success-dark">
              <CheckCircle2 className="h-3.5 w-3.5" /> JSON gültig.
            </span>
          )
        ) : (
          <span className="flex items-start gap-1 text-spa-error-dark">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {parse.message}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className="inline-flex items-center gap-2 rounded-lg bg-spa-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-spa-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Anwenden
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasSaved && draft.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-spa-bg-secondary px-3 py-1.5 text-sm text-spa-text-primary hover:bg-spa-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" /> Zurücksetzen
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-spa-bg-primary px-3 py-2 text-xs text-spa-text-secondary">
        <strong className="text-spa-text-primary">Merge-Reihenfolge:</strong>{' '}
        Pack-Default → Theme-Palette → diese Overrides. Felder aus höheren Ebenen
        überschreiben niedrigere.
      </div>
    </div>
  );
}
