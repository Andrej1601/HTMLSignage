import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Aurora Thermal — goldene Stunde in der Saunawelt.
 *
 * Die Leitmetapher: jener Moment, wenn in einer finnischen Sauna das
 * letzte Tageslicht weicht und die Zedernwände im Glühen des Ofens
 * amberfarben aufleuchten. Warme Charcoal-Tiefen, Messing-Akzente,
 * ein Hauch Moosgrün — keine Schlagschatten, kein Schnickschnack,
 * nur Materialehrlichkeit.
 *
 * Typografie: moderne Display-Serif (Fraunces) für Headlines — ruhig,
 * geerdet, mit sanften Italic-Kurven. Inter als Body für Lesbarkeit auf
 * großen Distanzen. JetBrains Mono für Uhrzeiten (Messing-Schild-Optik).
 *
 * Radii: 14–24px für Karten, 2px für Hairlines. Wir rezitieren nicht
 * "ui kit-chic", wir zitieren Hotel-Lobby-Messing.
 *
 * Motion: bewusst langsam. Das Publikum entspannt — die UI auch.
 */
export const auroraThermalTokens: DesignTokens = {
  colors: {
    // Deep warm charcoal — the glow of a cedar wall at dusk, not black.
    surface: '#1B1410',
    // Elevated surface warms by a notch — amber-ember infusion.
    surfaceElevated: '#2C2219',
    // Hairline: ghost of brass. Never pure grey, never pure black.
    border: '#3E3124',

    // Warm ivory — feels like candlelight on paper, not fluorescent white.
    textPrimary: '#F5E9D7',
    // Muted taupe with a warm undertone — keeps hierarchies soft.
    textSecondary: '#B5A48E',
    // Text on brass-coloured backgrounds → deep espresso.
    textInverse: '#1B1410',

    // The signature. Polished brass with a whisper of warmth.
    accentPrimary: '#D4A057',
    // Moss sage — a forested counterpoint that grounds the gold.
    accentSecondary: '#7A9064',

    // Live: glowing ember. A beat warmer and brighter than brass so
    // "Jetzt" reads at a glance across the room.
    statusLive: '#EFA765',
    // Next: deep brass — the quieter cousin of the live tone.
    statusNext: '#B8874A',
    // Warning: ember amber-red, reserved for prestart / caution.
    statusWarning: '#CE5E3E',
  },

  typography: {
    // Inter for body — humanist, highly legible from 3m.
    fontBody:
      '"Inter", "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    // Fraunces for display — modern variable serif with optical sizes,
    // soft italic curves, and a personality that reads "premium spa"
    // rather than "law firm". Fallback to classic serifs in stages.
    fontHeading:
      '"Fraunces", "Cormorant Garamond", "Playfair Display", "Noto Serif Display", Georgia, Cambria, "Times New Roman", Times, serif',
    // Mono for times — tabular integrity, hotel-signage feel.
    fontMono:
      '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',

    baseSizePx: 16,
    baseLineHeight: 1.5,

    // Generous scale spread — we want display type to sing, not whisper.
    scaleSm: 0.8125,
    scaleBase: 1,
    scaleLg: 1.25,
    scaleXl: 1.625,
    scale2xl: 2.125,
    scale3xl: 3.0,
  },

  spacing: { xs: 4, sm: 12, md: 24, lg: 40, xl: 64 },

  // Radii lean soft-modern: enough roundness to feel tactile, never blob-y.
  radius: { sm: 6, md: 14, lg: 24, pill: 9999 },

  motion: {
    // Slower than UI-kit defaults — matches the pace of a sauna evening.
    durationFast: 260,
    durationBase: 520,
    durationSlow: 920,
    easingStandard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
};
