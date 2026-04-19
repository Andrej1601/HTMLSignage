import { useMemo, useState } from 'react';
import { Code2, RotateCcw } from 'lucide-react';
import {
  designTokenOverridesSchema,
  type DesignTokenOverrides,
} from '@htmlsignage/design-sdk';

interface SlideshowTokenOverridesEditorProps {
  /** Currently-stored overrides for the selected slideshow. */
  value?: DesignTokenOverrides;
  /** Called with the parsed overrides (or `undefined` to clear). */
  onChange: (next: DesignTokenOverrides | undefined) => void;
  /**
   * Pack-level description shown above the textarea so operators
   * know which tokens they may set.
   */
  exampleTokens?: DesignTokenOverrides;
  disabled?: boolean;
}

/**
 * JSON-based editor for per-slideshow design-pack token overrides.
 *
 * Why JSON and not a visual form? The token surface is wide (colors,
 * typography, spacing, radius, motion), and hand-written JSON gives
 * tenants the flexibility to override any subset without forcing the
 * admin UI to ship a picker for every token. Validation runs via the
 * same zod schema the SDK uses at load-time, so bad edits are
 * rejected before they reach a live display.
 */
export function SlideshowTokenOverridesEditor({
  value,
  onChange,
  exampleTokens,
  disabled = false,
}: SlideshowTokenOverridesEditorProps) {
  const initialDraft = useMemo(() => stringify(value), [value]);
  // Track the last external value we rendered — whenever it changes
  // (slideshow switch, "reset all overrides" button, etc.) we re-sync
  // the local draft without needing an effect hook. Derive-from-props
  // keeps the React strict lint rule happy.
  const [baseline, setBaseline] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [issues, setIssues] = useState<string[]>([]);
  if (initialDraft !== baseline) {
    setBaseline(initialDraft);
    setDraft(initialDraft);
    setIssues([]);
  }

  const applyDraft = (nextDraft: string) => {
    setDraft(nextDraft);

    const trimmed = nextDraft.trim();
    if (trimmed === '') {
      setIssues([]);
      onChange(undefined);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ungültiges JSON';
      setIssues([`JSON-Fehler: ${message}`]);
      return;
    }

    const result = designTokenOverridesSchema.safeParse(parsed);
    if (!result.success) {
      setIssues(
        result.error.issues.map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
          return `${path}: ${issue.message}`;
        }),
      );
      return;
    }

    setIssues([]);
    const next = Object.keys(result.data).length === 0 ? undefined : (result.data as DesignTokenOverrides);
    onChange(next);
  };

  const reset = () => {
    setDraft('');
    setIssues([]);
    onChange(undefined);
  };

  const hasValue = Boolean(value && Object.keys(value).length > 0);
  const exampleJson = exampleTokens
    ? stringify(exampleTokens)
    : stringify({
        colors: { accentPrimary: '#A86B32' },
        radius: { lg: 12 },
      });

  return (
    <div className="rounded-lg border border-spa-bg-secondary bg-spa-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-spa-primary" />
          <h5 className="text-sm font-semibold text-spa-text-primary">
            Design-Token Overrides
          </h5>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={disabled || !hasValue}
          className="inline-flex items-center gap-1.5 rounded-md border border-spa-bg-secondary px-2 py-1 text-xs font-medium text-spa-text-secondary transition-colors hover:text-spa-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          Zurücksetzen
        </button>
      </div>

      <p className="mb-2 text-xs text-spa-text-secondary">
        JSON, das einzelne Pack-Tokens überschreibt. Leere Sektionen sind
        erlaubt; ungenannte Tokens fallen auf die Pack-Defaults zurück.
        Validierung passiert beim Eintippen.
      </p>

      <textarea
        value={draft}
        onChange={(event) => applyDraft(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        placeholder={exampleJson}
        className="h-60 w-full resize-y rounded-md border border-spa-bg-secondary bg-spa-bg-primary p-3 font-mono text-xs text-spa-text-primary focus:border-spa-primary focus:outline-hidden focus:ring-1 focus:ring-spa-primary disabled:cursor-not-allowed disabled:opacity-60"
      />

      {issues.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded-md bg-spa-danger-light px-3 py-2 text-xs text-spa-danger-dark">
          {issues.slice(0, 6).map((issue, idx) => (
            <li key={idx} className="font-mono">
              {issue}
            </li>
          ))}
          {issues.length > 6 ? (
            <li className="font-mono">… {issues.length - 6} weitere Probleme</li>
          ) : null}
        </ul>
      ) : hasValue ? (
        <p className="mt-2 text-xs text-spa-success-dark">
          Overrides gültig — beim Speichern aktiv.
        </p>
      ) : (
        <p className="mt-2 text-xs text-spa-text-secondary">
          Keine Overrides gesetzt — Pack-Defaults + Theme-Mapping greifen.
        </p>
      )}
    </div>
  );
}

function stringify(value: DesignTokenOverrides | undefined): string {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}
