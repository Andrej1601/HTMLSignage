import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * {{designName}} — sauna-detail slide renderer.
 *
 * TODO: Render the sauna identity (name, description, info, image) and
 * its `upcoming[]` infusion list. Each infusion exposes:
 *  - time, durationMin, title, description?
 *  - intensity (1–4), aromas[]
 *  - isLive, isNext, isPrestart, isFinished
 *
 * Let the host drive rotation and auto-scrolling — don't reinvent
 * timers here.
 */
export function SaunaDetailRenderer({ data, tokens }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${spacing.xl}px`,
        gap: `${spacing.lg}px`,
      }}
    >
      <h2
        className="font-black"
        style={{
          color: data.accentColor ?? colors.accentPrimary,
          fontSize: `${typography.baseSizePx * typography.scale3xl}px`,
          lineHeight: 1,
        }}
      >
        {data.name}
      </h2>
      {data.upcoming.length === 0 ? (
        <p style={{ color: colors.textSecondary }}>Heute keine Aufgüsse geplant.</p>
      ) : (
        <ul className="flex flex-col" style={{ gap: `${spacing.sm}px` }}>
          {data.upcoming.slice(0, 8).map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline"
              style={{
                gap: `${spacing.md}px`,
                color: entry.isFinished ? colors.textSecondary : colors.textPrimary,
              }}
            >
              <span className="font-mono font-black" style={{ fontSize: `${typography.baseSizePx * typography.scaleLg}px` }}>
                {entry.time}
              </span>
              <span style={{ fontSize: `${typography.baseSizePx * typography.scaleLg}px` }}>
                {entry.title}
              </span>
              {entry.isLive ? (
                <span style={{ color: colors.statusLive, marginLeft: 'auto' }}>· LÄUFT</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
