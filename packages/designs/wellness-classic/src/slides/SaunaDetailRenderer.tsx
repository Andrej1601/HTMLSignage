import type {
  SaunaInfusionEntry,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';

function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  if (c.startsWith('#')) {
    const raw = c.slice(1);
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    if (hex.length !== 6) return c;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  return c;
}

function InfusionRow({
  entry,
  tokens,
}: {
  entry: SaunaInfusionEntry;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
}) {
  const { colors, typography, spacing, radius } = tokens;
  const isLive = entry.isLive;
  const isPre = entry.isPrestart;
  const isFinished = entry.isFinished;

  const statusColor = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isFinished
        ? colors.textSecondary
        : colors.textPrimary;

  const bg = isLive
    ? withAlpha(colors.statusLive, 0.12)
    : isPre
      ? withAlpha(colors.statusWarning, 0.12)
      : withAlpha(colors.surfaceElevated, 0.9);

  const borderColor = isLive
    ? withAlpha(colors.statusLive, 0.3)
    : isPre
      ? withAlpha(colors.statusWarning, 0.3)
      : colors.border;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: bg,
        borderRadius: `${radius.lg}px`,
        border: `1px solid ${borderColor}`,
        padding: `${spacing.md}px`,
        gap: `${spacing.xs}px`,
        opacity: isFinished ? 0.55 : 1,
      }}
    >
      <div className="flex items-baseline" style={{ gap: `${spacing.sm}px` }}>
        <span
          className="font-mono font-black"
          style={{
            color: statusColor,
            fontSize: `${typography.baseSizePx * typography.scale2xl}px`,
            lineHeight: 1,
          }}
        >
          {entry.time}
        </span>
        <span
          className="font-bold uppercase"
          style={{
            color: isFinished ? colors.textSecondary : colors.textPrimary,
            fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
            letterSpacing: '0.04em',
          }}
        >
          {entry.title}
        </span>
        {isLive ? (
          <span
            className="ml-auto font-black uppercase"
            style={{
              color: colors.textInverse,
              backgroundColor: colors.statusLive,
              fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.15em',
            }}
          >
            LÄUFT
          </span>
        ) : entry.isNext ? (
          <span
            className="ml-auto font-black uppercase"
            style={{
              color: colors.textInverse,
              backgroundColor: colors.statusNext,
              fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.15em',
            }}
          >
            Als Nächstes
          </span>
        ) : null}
      </div>

      {(entry.aromas?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap" style={{ gap: `${spacing.xs}px` }}>
          {entry.aromas!.map((aroma) => (
            <span
              key={aroma.id}
              className="inline-flex items-center font-bold uppercase"
              style={{
                color: aroma.color ?? colors.textSecondary,
                backgroundColor: withAlpha(aroma.color ?? colors.accentSecondary, 0.12),
                border: `1px solid ${withAlpha(aroma.color ?? colors.accentSecondary, 0.3)}`,
                borderRadius: `${radius.pill}px`,
                fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                gap: `${spacing.xs}px`,
              }}
            >
              {aroma.emoji ? <span>{aroma.emoji}</span> : null}
              <span>{aroma.name}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wellness Classic — sauna-detail slide renderer.
 *
 * Two-column layout: left = sauna identity (name, description, info
 * badges, background image), right = ordered list of today's infusions
 * with live/next/prestart/finished states.
 */
export function SaunaDetailRenderer({ data, tokens }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;

  const accent = data.accentColor ?? colors.accentPrimary;

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
      }}
    >
      <section className="relative flex flex-col overflow-hidden">
        {data.imageUrl ? (
          <>
            <img
              src={data.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(colors.textPrimary, 0.55)} 0%, ${withAlpha(
                  colors.textPrimary,
                  0.3,
                )} 55%, ${withAlpha(colors.surface, 0.9)} 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(
                colors.surfaceElevated,
                0.35,
              )} 55%, ${colors.surface} 100%)`,
            }}
          />
        )}

        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${spacing.xl}px`, gap: `${spacing.lg}px` }}
        >
          <div
            className="inline-flex items-center font-black uppercase"
            style={{
              alignSelf: 'flex-start',
              color: data.imageUrl ? colors.textInverse : colors.textPrimary,
              backgroundColor: withAlpha(accent, data.imageUrl ? 0.85 : 0.15),
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: `${radius.pill}px`,
              fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
              letterSpacing: '0.25em',
            }}
          >
            Sauna
          </div>

          <h2
            className="font-black"
            style={{
              color: data.imageUrl ? colors.textInverse : colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${typography.baseSizePx * typography.scale3xl * 1.25}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {data.name}
          </h2>

          {data.infoBadges.length > 0 ? (
            <div className="flex flex-wrap" style={{ gap: `${spacing.sm}px` }}>
              {data.infoBadges.map((badge, idx) => (
                <span
                  key={idx}
                  className="font-semibold"
                  style={{
                    color: data.imageUrl ? colors.textInverse : colors.textPrimary,
                    backgroundColor: withAlpha(
                      data.imageUrl ? colors.surfaceElevated : accent,
                      data.imageUrl ? 0.2 : 0.15,
                    ),
                    border: `1px solid ${withAlpha(
                      data.imageUrl ? colors.surfaceElevated : accent,
                      data.imageUrl ? 0.35 : 0.3,
                    )}`,
                    borderRadius: `${radius.md}px`,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    fontSize: `${typography.baseSizePx * typography.scaleBase}px`,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap" style={{ gap: `${spacing.md}px` }}>
            {data.info.temperatureC != null ? (
              <Stat
                label="Temperatur"
                value={`${data.info.temperatureC}°C`}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
              />
            ) : null}
            {data.info.humidityPct != null ? (
              <Stat
                label="Feuchte"
                value={`${data.info.humidityPct}%`}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
              />
            ) : null}
            {data.info.capacity != null ? (
              <Stat
                label="Plätze"
                value={String(data.info.capacity)}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="flex flex-col overflow-hidden"
        style={{ padding: `${spacing.xl}px`, gap: `${spacing.md}px` }}
      >
        <div
          className="flex items-baseline justify-between"
          style={{ marginBottom: `${spacing.xs}px` }}
        >
          <span
            className="font-black uppercase"
            style={{
              color: colors.accentPrimary,
              fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
              letterSpacing: '0.3em',
            }}
          >
            Aufgussplan
          </span>
          <span
            className="font-semibold"
            style={{
              color: colors.textSecondary,
              fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
            }}
          >
            {data.upcoming.length} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: colors.textSecondary,
              fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
            }}
          >
            Heute keine Aufgüsse geplant.
          </div>
        ) : (
          <div
            className="flex flex-1 flex-col overflow-y-auto"
            style={{ gap: `${spacing.sm}px` }}
          >
            {data.upcoming.map((entry) => (
              <InfusionRow key={entry.id} entry={entry} tokens={tokens} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  tokens,
}: {
  label: string;
  value: string;
  color: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
}) {
  const { typography, spacing } = tokens;
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <span
        className="font-black uppercase"
        style={{
          color,
          fontSize: `${typography.baseSizePx * typography.scale2xl}px`,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-semibold uppercase"
        style={{
          color,
          opacity: 0.75,
          fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
          letterSpacing: '0.2em',
          marginTop: `${spacing.xs}px`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
