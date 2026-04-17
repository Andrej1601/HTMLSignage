import type { Design } from '@htmlsignage/design-sdk';
import { editorialResortManifest } from './manifest';
import { editorialResortTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * Editorial Resort design pack entry-point.
 *
 * Exported under the name `editorialResortDesign`; register it in
 * `packages/frontend/src/designs/registry.ts` (see that file for the
 * matching workspace dep + DesignId union entry).
 */
export const editorialResortDesign: Design = {
  manifest: editorialResortManifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { editorialResortManifest, editorialResortTokens };
