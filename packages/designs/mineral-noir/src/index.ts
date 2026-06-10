import type { Design } from '@htmlsignage/design-sdk';
import { mineralNoirManifest } from './manifest';
import { mineralNoirTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * Mineral Noir design pack.
 *
 * Ships renderers for all six slide types. Each renderer consumes the
 * headless data shapes from `@htmlsignage/design-sdk` and styles
 * exclusively through `mineralNoirTokens` — so palette / tenant
 * overrides flow through without touching renderer source.
 */
export const mineralNoirDesign: Design = {
  manifest: mineralNoirManifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { mineralNoirManifest, mineralNoirTokens };
