import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * {{designName}} — infos slide renderer.
 *
 * TODO: Render {@link data} (title, text, imageUrl, imageMode) using
 * {@link tokens} for colour and typography. The `context.viewport`
 * flags (isNarrow / isCompact / isUltraCompact) tell you how much
 * space is available.
 */
export function InfosSlideRenderer({ data, tokens }: SlideRendererProps<'infos'>) {
  const { colors, typography, spacing } = tokens;
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${spacing.xl}px`,
        gap: `${spacing.md}px`,
      }}
    >
      <h2
        className="font-black uppercase"
        style={{
          color: colors.accentPrimary,
          fontSize: `${typography.baseSizePx * typography.scale2xl}px`,
          letterSpacing: '0.15em',
        }}
      >
        {data.title}
      </h2>
      <p
        style={{
          color: colors.textSecondary,
          fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
          lineHeight: typography.baseLineHeight,
          maxWidth: '60ch',
          textAlign: 'center',
        }}
      >
        {data.text}
      </p>
    </div>
  );
}
