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
 * Mineral Noir design pack entry-point.
 *
 * Exported under the name `mineralNoirDesign`; register it in
 * `packages/frontend/src/designs/registry.ts` (see that file for the
 * matching workspace dep + DesignId union entry).
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
