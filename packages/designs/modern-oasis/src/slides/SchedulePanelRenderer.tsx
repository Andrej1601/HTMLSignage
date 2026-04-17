import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Modern Oasis — content-panel (schedule grid) slide renderer.
 *
 * TODO: Render the `saunas[] × timeSlots[]` matrix. `cells[saunaIdx]
 * [slotIdx]` is a `SchedulePanelCell | null`. Use `cell.isLive` /
 * `cell.isNext` for status highlighting, and `cell.aromas` for
 * scent chips.
 */
export function SchedulePanelRenderer({ data, tokens }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  if (data.saunas.length === 0 || data.timeSlots.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
      >
        Heute keine Einträge geplant.
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${spacing.lg}px`,
      }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `auto repeat(${data.saunas.length}, minmax(0, 1fr))`,
          gap: `${spacing.xs}px`,
          alignContent: 'start',
        }}
      >
        <div />
        {data.saunas.map((sauna) => (
          <div key={sauna.id} className="font-black uppercase" style={{ textAlign: 'center' }}>
            {sauna.name}
          </div>
        ))}
        {data.timeSlots.map((time, slotIdx) => (
          <>
            <div key={`t-${time}`} className="font-mono font-black">
              {time}
            </div>
            {data.saunas.map((_, saunaIdx) => {
              const cell = data.cells[saunaIdx]?.[slotIdx] ?? null;
              return (
                <div
                  key={`${time}-${saunaIdx}`}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: `${tokens.radius.sm}px`,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                  }}
                >
                  {cell?.title ?? '—'}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
