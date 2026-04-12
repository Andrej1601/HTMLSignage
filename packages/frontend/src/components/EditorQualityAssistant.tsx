import { CheckCircle2, TriangleAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { EditorQualityIssue, EditorQualityTone } from '@/utils/editorQuality';

interface EditorQualityAssistantProps {
  title?: string;
  description: string;
  issues: EditorQualityIssue[];
  okMessage: string;
  className?: string;
}

function getToneAccent(tone: EditorQualityTone) {
  switch (tone) {
    case 'danger':  return { bar: 'bg-spa-error', text: 'text-spa-error-dark', bg: 'bg-spa-error-light/60 border-spa-error/20' };
    case 'warning': return { bar: 'bg-spa-warning', text: 'text-spa-warning-dark', bg: 'bg-spa-warning-light/60 border-spa-warning/20' };
    case 'info':    return { bar: 'bg-spa-info', text: 'text-spa-info-dark', bg: 'bg-spa-info-light/50 border-spa-info/20' };
    default:        return { bar: 'bg-spa-success', text: 'text-spa-success-dark', bg: 'bg-spa-success-light/60 border-spa-success/20' };
  }
}

export function EditorQualityAssistant({ issues, okMessage, className }: EditorQualityAssistantProps) {
  const [expanded, setExpanded] = useState(false);

  const dangerCount  = issues.filter((i) => i.tone === 'danger').length;
  const warningCount = issues.filter((i) => i.tone === 'warning').length;
  const infoCount    = issues.filter((i) => i.tone === 'info').length;
  const hasIssues    = issues.length > 0;

  if (!hasIssues) {
    // Compact OK strip
    return (
      <div className={clsx('flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2', className)}>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="text-xs text-emerald-700">{okMessage}</span>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-lg border border-amber-200 bg-amber-50 overflow-hidden', className)}>
      {/* Compact summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/60 transition-colors"
      >
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-xs font-medium text-amber-800">
          Qualitätsassistent
        </span>
        {/* Issue counts */}
        <span className="flex items-center gap-1.5">
          {dangerCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {dangerCount} kritisch
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {warningCount} prüfen
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {infoCount} Hinweis{infoCount > 1 ? 'e' : ''}
            </span>
          )}
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-amber-500" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-amber-500" />
        }
      </button>

      {/* Expanded detail list */}
      {expanded && (
        <div className="border-t border-amber-200 px-3 py-2 space-y-2">
          {issues.map((issue) => {
            const accent = getToneAccent(issue.tone);
            return (
              <div
                key={issue.id}
                className={clsx('flex gap-2.5 rounded-lg border px-3 py-2', accent.bg)}
              >
                <div className={clsx('mt-0.5 h-2 w-2 rounded-full shrink-0', accent.bar)} />
                <div className="min-w-0">
                  <p className={clsx('text-xs font-semibold', accent.text)}>{issue.title}</p>
                  <p className="text-xs text-spa-text-secondary mt-0.5 leading-relaxed">{issue.detail}</p>
                  {issue.fixLabel && (
                    <p className="mt-1 text-[10px] font-medium text-spa-text-secondary/70 uppercase tracking-wide">
                      → {issue.fixLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
