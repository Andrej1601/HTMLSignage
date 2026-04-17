import type { Design } from '@htmlsignage/design-sdk';
import { wellnessListManifest } from './manifest';
import { wellnessListTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * Wellness List design pack entry-point.
 *
 * Exported under the name `wellnessListDesign`; register it in
 * `packages/frontend/src/designs/registry.ts` (see that file for the
 * matching workspace dep + DesignId union entry).
 */
export const wellnessListDesign: Design = {
  manifest: wellnessListManifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { wellnessListManifest, wellnessListTokens };
