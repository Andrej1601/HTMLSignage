import type { CSSProperties } from 'react';
import type { SlideRendererProps } from '../contract';
import type { SchedulePanelCell, SchedulePanelData } from '../slide-data';
import { withAlpha } from '../utils/colors';
import { scaled, scaledFont } from '../utils/viewport';
import { AutoScroll } from './AutoScroll';

// ── Voice presets ──────────────────────────────────────────────────────────
//
// The grid layout is shared across packs, but the *typographic voice* —
// weights, casing, letter-spacing, badge style — is what makes it feel
// like a wellness-classic playbill or an aurora-thermal brass fixture.
// Each preset is a small dictionary of style decisions that the renderer
// reads at the right place; pass `voice="editorial"` (or a custom
// `SchedulePanelGridVoice`) when the host pack wants the softer look.

export interface SchedulePanelGridVoice {
  saunaName: {
    fontFamilyToken: 'fontBody' | 'fontHeading';
    fontWeight: number;
    textTransform: CSSProperties['textTransform'];
    letterSpacing: string;
  };
  cellTime: {
    fontWeight: number;
    letterSpacing: string;
  };
  cellTitle: {
    fontFamilyToken: 'fontBody' | 'fontHeading';
    fontWeight: number;
    textTransform: CSSProperties['textTransform'];
    letterSpacing: string;
  };
  statusBadge: {
    /** 'solid' = filled pill (classic). 'outline' = subtle border with optional live-glow (editorial). */
    style: 'solid' | 'outline';
    fontWeight: number;
    letterSpacing: string;
  };
  duration: {
    fontWeight: number;
    textTransform: CSSProperties['textTransform'];
    letterSpacing: string;
  };
  aroma: {
    fontWeight: number;
    textTransform: CSSProperties['textTransform'];
  };
  placeholder: {
    fontWeight: number;
    letterSpacing: string;
  };
}

const CLASSIC_VOICE: SchedulePanelGridVoice = {
  saunaName: { fontFamilyToken: 'fontBody', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' },
  cellTime: { fontWeight: 900, letterSpacing: '-0.02em' },
  cellTitle: { fontFamilyToken: 'fontBody', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusBadge: { style: 'solid', fontWeight: 900, letterSpacing: '0.16em' },
  duration: { fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' },
  aroma: { fontWeight: 700, textTransform: 'uppercase' },
  placeholder: { fontWeight: 900, letterSpacing: '0.2em' },
};

const EDITORIAL_VOICE: SchedulePanelGridVoice = {
  saunaName: { fontFamilyToken: 'fontHeading', fontWeight: 500, textTransform: 'none', letterSpacing: '-0.005em' },
  cellTime: { fontWeight: 600, letterSpacing: '0.02em' },
  cellTitle: { fontFamilyToken: 'fontHeading', fontWeight: 500, textTransform: 'none', letterSpacing: '-0.005em' },
  statusBadge: { style: 'outline', fontWeight: 700, letterSpacing: '0.14em' },
  duration: { fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
  aroma: { fontWeight: 500, textTransform: 'none' },
  placeholder: { fontWeight: 600, letterSpacing: '0.14em' },
};

// Mineral Noir's architectural register — sans-only, semibold rather than
// black, generous tracking on the labels (engineering-drawing feel),
// outline status pills (no solid fills), and aroma kept uppercase to read
// as data not prose. Sits between `classic`'s shouty solidness and
// `editorial`'s serif softness.
const MINERAL_VOICE: SchedulePanelGridVoice = {
  saunaName: { fontFamilyToken: 'fontBody', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em' },
  cellTime: { fontWeight: 500, letterSpacing: '0.02em' },
  cellTitle: { fontFamilyToken: 'fontBody', fontWeight: 600, textTransform: 'none', letterSpacing: '-0.005em' },
  statusBadge: { style: 'outline', fontWeight: 600, letterSpacing: '0.18em' },
  duration: { fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' },
  aroma: { fontWeight: 500, textTransform: 'uppercase' },
  placeholder: { fontWeight: 600, letterSpacing: '0.2em' },
};

const VOICE_PRESETS = {
  classic: CLASSIC_VOICE,
  editorial: EDITORIAL_VOICE,
  mineral: MINERAL_VOICE,
} satisfies Record<string, SchedulePanelGridVoice>;

export type SchedulePanelGridVoiceName = keyof typeof VOICE_PRESETS;

function resolveVoice(
  voice: SchedulePanelGridVoiceName | SchedulePanelGridVoice | undefined,
): SchedulePanelGridVoice {
  if (!voice) return CLASSIC_VOICE;
  if (typeof voice === 'string') return VOICE_PRESETS[voice];
  return voice;
}

// ── Component ──────────────────────────────────────────────────────────────

interface SchedulePanelGridProps extends SlideRendererProps<'content-panel'> {
  /**
   * Typographic voice. Defaults to the wellness-classic shouty look
   * (`'classic'`). Editorial packs (aurora-thermal, etc.) should pass
   * `'editorial'` for the serif/medium-weight treatment.
   */
  voice?: SchedulePanelGridVoiceName | SchedulePanelGridVoice;
}

/**
 * Saunakacheln grid — one column per sauna, each column has a header
 * (colour bar + name + temperature) and a vertically stacked list of
 * cards. Long columns auto-scroll so the layout stays constant across
 * zone sizes.
 *
 * Originally written for the wellness-classic pack; lifted into the SDK
 * so other packs can opt into the same visual language without copying
 * ~470 lines of layout code. Tokens (colours, typography, radius) come
 * from the slide-renderer props, so the grid automatically adopts the
 * host pack's palette / brand voice. Typographic styling (weights,
 * casing, badge style) is selected via the optional `voice` prop.
 */
export function SchedulePanelGrid({
  data,
  tokens,
  context,
  voice,
}: SchedulePanelGridProps) {
  const { colors, typography } = tokens;
  const { viewport } = context;
  const v = resolveVoice(voice);

  if (data.saunas.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
        }}
      >
        Keine Saunen sichtbar.
      </div>
    );
  }

  // Responsive column count: full-size 3-up, narrow → 2, very narrow → 1.
  const gridColumns = viewport.width < 430 ? 1 : viewport.width < 700 ? 2 : 3;
  const pad = scaled(20, viewport, 6);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(16, viewport, 6)}px`,
      }}
    >
      <div
        className="grid flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gap: `${scaled(16, viewport, 6)}px`,
        }}
      >
        {data.saunas.map((sauna, idx) => (
          <SaunaColumn
            key={sauna.id}
            sauna={sauna}
            index={idx}
            entries={collectSaunaEntries(data, idx)}
            tokens={tokens}
            viewport={viewport}
            voice={v}
          />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface FlatEntry {
  key: string;
  time: string;
  saunaIndex: number;
  saunaName: string;
  cell: SchedulePanelCell;
}

function collectSaunaEntries(data: SchedulePanelData, saunaIdx: number): FlatEntry[] {
  const result: FlatEntry[] = [];
  const row = data.cells[saunaIdx] ?? [];
  row.forEach((cell, slotIdx) => {
    if (!cell) return;
    const time = cell.time ?? data.timeSlots[slotIdx] ?? '';
    result.push({
      key: `${saunaIdx}-${slotIdx}-${time}`,
      time,
      saunaIndex: saunaIdx,
      saunaName: data.saunas[saunaIdx]?.name ?? '',
      cell,
    });
  });
  result.sort((a, b) => {
    const [ah, am] = a.time.split(':').map((x) => Number.parseInt(x, 10) || 0);
    const [bh, bm] = b.time.split(':').map((x) => Number.parseInt(x, 10) || 0);
    return ah * 60 + am - (bh * 60 + bm);
  });
  return result;
}

/**
 * Resolve a sauna's accent colour. Prefers an explicit `color` from the
 * data; otherwise rotates through a deterministic palette built from the
 * pack's accent tokens so every sauna still gets a stable visual marker.
 */
export function resolveSaunaAccent(
  sauna: SchedulePanelData['saunas'][number],
  index: number,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
): string {
  if (sauna.color) return sauna.color;
  const { colors } = tokens;
  const palette = [
    colors.accentPrimary,
    colors.accentSecondary,
    colors.statusLive,
    colors.statusNext,
    colors.statusWarning,
  ];
  return palette[index % palette.length];
}

function FlameIcon({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function IntensityFlames({
  level,
  size,
  activeColor,
  idleColor,
}: {
  level: number;
  size: number;
  activeColor: string;
  idleColor: string;
}) {
  return (
    <div
      className="inline-flex items-center shrink-0"
      style={{ gap: Math.max(1, Math.round(size * 0.08)) }}
    >
      {[1, 2, 3, 4].map((i) => (
        <FlameIcon
          key={i}
          size={size}
          color={i <= level ? activeColor : idleColor}
          filled={i <= level}
        />
      ))}
    </div>
  );
}

function SaunaColumn({
  sauna,
  index,
  entries,
  tokens,
  viewport,
  voice,
}: {
  sauna: SchedulePanelData['saunas'][number];
  index: number;
  entries: FlatEntry[];
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
  voice: SchedulePanelGridVoice;
}) {
  const { colors, typography, radius } = tokens;
  const accent = resolveSaunaAccent(sauna, index, tokens);
  const saunaNameFont = typography[voice.saunaName.fontFamilyToken];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Column header: colour bar + name + temperature */}
      <div
        className="flex items-center shrink-0"
        style={{
          gap: `${scaled(10, viewport, 4)}px`,
          paddingBottom: `${scaled(8, viewport, 3)}px`,
          borderBottom: `2px solid ${withAlpha(colors.border, 0.8)}`,
          marginBottom: `${scaled(10, viewport, 3)}px`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: scaled(6, viewport, 3),
            height: scaled(28, viewport, 14),
            borderRadius: `${radius.pill}px`,
            backgroundColor: sauna.outOfOrder
              ? withAlpha(colors.textPrimary, 0.2)
              : accent,
          }}
        />
        <span
          className="min-w-0 flex-1 truncate"
          style={{
            color: sauna.outOfOrder ? withAlpha(colors.textPrimary, 0.45) : colors.textPrimary,
            fontFamily: saunaNameFont,
            fontWeight: voice.saunaName.fontWeight,
            textTransform: voice.saunaName.textTransform,
            letterSpacing: voice.saunaName.letterSpacing,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            lineHeight: 1.1,
          }}
          title={sauna.name}
        >
          {sauna.name}
        </span>
        {!sauna.outOfOrder && typeof sauna.temperatureC === 'number' ? (
          <span
            className="shrink-0 tabular-nums"
            style={{
              color: colors.accentPrimary,
              backgroundColor: withAlpha(colors.surfaceElevated, 0.7),
              border: `1px solid ${withAlpha(colors.border, 0.7)}`,
              borderRadius: `${radius.pill}px`,
              padding: `${scaled(2, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
              fontFamily: typography.fontMono,
              fontWeight: 600,
              letterSpacing: '0.02em',
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
            }}
          >
            {sauna.temperatureC}°C
          </span>
        ) : null}
      </div>

      {/* Body */}
      {sauna.outOfOrder ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
            border: `1px dashed ${withAlpha(colors.textPrimary, 0.25)}`,
            borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
            color: withAlpha(colors.textPrimary, 0.5),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
            letterSpacing: voice.placeholder.letterSpacing,
            padding: `${scaled(16, viewport, 6)}px`,
            textAlign: 'center',
            fontWeight: voice.placeholder.fontWeight,
            textTransform: 'uppercase',
          }}
        >
          Außer Betrieb
        </div>
      ) : entries.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            color: withAlpha(colors.textSecondary, 0.6),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
            letterSpacing: voice.placeholder.letterSpacing,
            fontWeight: voice.placeholder.fontWeight,
            textTransform: 'uppercase',
          }}
        >
          Keine Aufgüsse
        </div>
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <div className="flex flex-col" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
            {entries.map((entry) => (
              <SaunaCard
                key={entry.key}
                entry={entry}
                accent={accent}
                tokens={tokens}
                viewport={viewport}
                voice={voice}
              />
            ))}
          </div>
        </AutoScroll>
      )}
    </div>
  );
}

function SaunaCard({
  entry,
  accent,
  tokens,
  viewport,
  voice,
}: {
  entry: FlatEntry;
  accent: string;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
  voice: SchedulePanelGridVoice;
}) {
  const { colors, typography, radius } = tokens;
  const { cell } = entry;
  const isLive = cell.isLive;
  const isPre = cell.isPrestart;
  const isNext = cell.isNext;
  const isFinished = cell.isFinished;

  const containerBg = isLive
    ? withAlpha(colors.statusLive, 0.12)
    : isPre
      ? withAlpha(colors.statusWarning, 0.12)
      : isNext
        ? withAlpha(colors.statusNext, 0.12)
        : isFinished
          ? withAlpha(colors.surfaceElevated, 0.3)
          : withAlpha(colors.surfaceElevated, 0.9);

  const containerBorder = isLive
    ? withAlpha(colors.statusLive, 0.45)
    : isPre
      ? withAlpha(colors.statusWarning, 0.4)
      : isNext
        ? withAlpha(colors.statusNext, 0.4)
        : withAlpha(colors.border, 0.7);

  const timeColor = isLive
    ? colors.statusLive
    : isPre || isNext
      ? colors.statusWarning
      : isFinished
        ? withAlpha(colors.textPrimary, 0.35)
        : colors.textPrimary;

  const titleColor = isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary;

  const flameActive = isFinished
    ? withAlpha(colors.accentPrimary, 0.35)
    : isLive
      ? colors.statusLive
      : isPre || isNext
        ? colors.statusWarning
        : accent;
  const flameIdle = withAlpha(colors.accentPrimary, 0.2);

  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : isNext
        ? { label: 'GLEICH', color: colors.statusNext }
        : isFinished
          ? { label: 'VORBEI', color: withAlpha(colors.textPrimary, 0.55) }
          : null;

  const intensity = cell.intensity ?? 0;
  const duration = cell.durationMin ?? 15;
  const titleFont = typography[voice.cellTitle.fontFamilyToken];

  const badgeStyle: CSSProperties = voice.statusBadge.style === 'outline' && badge
    ? {
        color: badge.color,
        backgroundColor: withAlpha(badge.color, isLive ? 0.18 : 0.1),
        border: `1px solid ${withAlpha(badge.color, 0.55)}`,
        boxShadow: isLive
          ? `0 0 0 2px ${withAlpha(badge.color, 0.08)}, 0 0 14px ${withAlpha(badge.color, 0.35)}`
          : 'none',
      }
    : badge
      ? {
          color: colors.textInverse,
          backgroundColor: badge.color,
        }
      : {};

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: containerBg,
        borderRadius: `${scaled(radius.lg, viewport, 5)}px`,
        border: `1px solid ${containerBorder}`,
        padding: `${scaled(10, viewport, 4)}px ${scaled(12, viewport, 5)}px`,
        gap: `${scaled(6, viewport, 2)}px`,
      }}
    >
      {/* Row 1: time + status badge | flames */}
      <div
        className="flex items-center justify-between"
        style={{ gap: `${scaled(8, viewport, 3)}px` }}
      >
        <div
          className="flex items-center min-w-0"
          style={{ gap: `${scaled(8, viewport, 3)}px` }}
        >
          <span
            className="font-mono tabular-nums shrink-0"
            style={{
              color: timeColor,
              fontWeight: voice.cellTime.fontWeight,
              letterSpacing: voice.cellTime.letterSpacing,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 12)}px`,
              lineHeight: 1,
            }}
          >
            {entry.time}
          </span>
          {badge ? (
            <span
              className="inline-flex items-center uppercase shrink-0"
              style={{
                ...badgeStyle,
                fontWeight: voice.statusBadge.fontWeight,
                letterSpacing: voice.statusBadge.letterSpacing,
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm * 0.82,
                  viewport,
                  7,
                )}px`,
                padding: `${scaled(2, viewport, 1)}px ${scaled(7, viewport, 3)}px`,
                borderRadius: `${radius.pill}px`,
              }}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {intensity > 0 ? (
          <IntensityFlames
            level={intensity}
            size={scaled(12, viewport, 8)}
            activeColor={flameActive}
            idleColor={flameIdle}
          />
        ) : null}
      </div>

      {/* Row 2: title | duration pill */}
      <div
        className="flex items-center justify-between"
        style={{ gap: `${scaled(8, viewport, 3)}px` }}
      >
        <span
          className="truncate flex-1 min-w-0"
          style={{
            color: titleColor,
            fontFamily: titleFont,
            fontWeight: voice.cellTitle.fontWeight,
            textTransform: voice.cellTitle.textTransform,
            letterSpacing: voice.cellTitle.letterSpacing,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
          }}
        >
          {cell.title}
        </span>
        <span
          className="shrink-0"
          style={{
            color: withAlpha(colors.textPrimary, 0.6),
            backgroundColor: withAlpha(colors.border, 0.3),
            borderRadius: `${radius.pill}px`,
            padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
            fontWeight: voice.duration.fontWeight,
            textTransform: voice.duration.textTransform,
            letterSpacing: voice.duration.letterSpacing,
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleSm * 0.85,
              viewport,
              7,
            )}px`,
          }}
        >
          {duration} MIN
        </span>
      </div>

      {/* Row 3: aromas */}
      {(cell.aromas?.length ?? 0) > 0 ? (
        <div
          className="flex flex-wrap"
          style={{ gap: `${scaled(4, viewport, 2)}px` }}
        >
          {cell.aromas!.slice(0, 3).map((aroma) => (
            <span
              key={aroma.id}
              className="inline-flex items-center"
              style={{
                color: aroma.color ?? colors.textSecondary,
                backgroundColor: withAlpha(aroma.color ?? colors.accentSecondary, 0.12),
                border: `1px solid ${withAlpha(
                  aroma.color ?? colors.accentSecondary,
                  0.3,
                )}`,
                borderRadius: `${radius.pill}px`,
                fontWeight: voice.aroma.fontWeight,
                textTransform: voice.aroma.textTransform,
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm * 0.8,
                  viewport,
                  7,
                )}px`,
                padding: `${scaled(1, viewport, 1)}px ${scaled(6, viewport, 3)}px`,
                gap: `${scaled(3, viewport, 1)}px`,
                opacity: isFinished ? 0.6 : 1,
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
