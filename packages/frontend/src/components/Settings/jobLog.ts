const DEFAULT_VISIBLE_JOB_LOG_LINES = 120;

export interface VisibleJobLog {
  text: string;
  truncated: boolean;
  totalLines: number;
}

export function getVisibleJobLog(
  value: string,
  maxLines = DEFAULT_VISIBLE_JOB_LOG_LINES,
): VisibleJobLog {
  const normalized = value.trimEnd();
  if (!normalized) {
    return {
      text: '',
      truncated: false,
      totalLines: 0,
    };
  }

  const lines = normalized.split(/\r?\n/);
  if (lines.length <= maxLines) {
    return {
      text: normalized,
      truncated: false,
      totalLines: lines.length,
    };
  }

  return {
    text: lines.slice(lines.length - maxLines).join('\n'),
    truncated: true,
    totalLines: lines.length,
  };
}
