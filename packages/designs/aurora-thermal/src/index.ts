import type { Design } from '@htmlsignage/design-sdk';
import { auroraThermalManifest } from './manifest';
import { auroraThermalTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * Aurora Thermal — the production flagship design pack.
 *
 * "Goldene Stunde in der Saunawelt." Designed to greet guests with
 * warmth and depth: warm-charcoal stage, polished-brass accents,
 * moderne Display-Serif, cinematic rhythm. All six slide types ship
 * here and share the pack's typographic voice, status chip system,
 * and ambient corner-glow backdrop.
 *
 * Styling is exclusively driven by `auroraThermalTokens` — tenant
 * / slideshow overrides flow through via `DesignTokenOverrides`
 * without touching renderer source.
 */
export const auroraThermalDesign: Design = {
  manifest: auroraThermalManifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { auroraThermalManifest, auroraThermalTokens };
