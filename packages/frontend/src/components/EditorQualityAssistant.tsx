import { CheckCircle2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { EditorQualityIssue, EditorQualityTone } from '@/utils/editorQuality';

interface EditorQualityAssistantProps {
  title?: string;
  description: string;
  issues: EditorQualityIssue[];
  okMessage: string;
  className?: string;
}

function getToneLabel(tone: EditorQualityTone): string {
  switch (tone) {
    case 'danger':
      return 'Kritisch';
    case 'warning':
      return 'Prüfen';
    case 'info':
      return 'Hinweis';
    default:
      return 'OK';
  }
}

function getIssueAccentClasses(tone: EditorQualityTone): string {
  switch (tone) {
    case 'danger':
      return 'border-spa-error/25 bg-spa-error-light/70';
    case 'warning':
      return 'border-spa-warning/25 bg-spa-warning-light/70';
    case 'info':
      return 'border-spa-info/25 bg-spa-info-light/60';
    default:
      return 'border-spa-success/25 bg-spa-success-light/70';
  }
}

export function EditorQualityAssistant({
  title = 'Qualitätsassistent',
  description,
  issues,
  okMessage,
  className,
}: EditorQualityAssistantProps) {
  const dangerCount = issues.filter((issue) => issue.tone === 'danger').length;
  const warningCount = issues.filter((issue) => issue.tone === 'warning').length;
  const infoCount = issues.filter((issue) => issue.tone === 'info').length;

  return (
    <SectionCard
      title={title}
      description={description}
      icon={issues.length > 0 ? TriangleAlert : ShieldCheck}
      className={className}
      actions={(
        <div className="flex flex-wrap gap-2">
          {issues.length === 0 ? (
            <StatusBadge label="Keine offenen Checks" tone="success" showDot={false} />
          ) : (
            <>
              {dangerCount > 0 && (
                <StatusBadge label={`${dangerCount} kritisch`} tone="danger" showDot={false} />
              )}
              {warningCount > 0 && (
                <StatusBadge label={`${warningCount} prüfen`} tone="warning" showDot={false} />
              )}
              {infoCount > 0 && (
                <StatusBadge label={`${infoCount} Hinweis${infoCount === 1 ? '' : 'e'}`} tone="info" showDot={false} />
              )}
            </>
          )}
        </div>
      )}
    >
      {issues.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-spa-success/20 bg-spa-success-light/70 px-4 py-4 text-sm text-spa-success-dark">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Editor-Check sauber</p>
            <p className="mt-1 leading-relaxed">{okMessage}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-2xl border px-4 py-4 ${getIssueAccentClasses(issue.tone)}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-spa-text-primary">{issue.title}</p>
                    <StatusBadge label={getToneLabel(issue.tone)} tone={issue.tone} showDot={false} />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-spa-text-secondary">{issue.detail}</p>
                </div>
              </div>

              {issue.fixLabel && (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-spa-text-secondary">
                  Nächster Schritt: {issue.fixLabel}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
