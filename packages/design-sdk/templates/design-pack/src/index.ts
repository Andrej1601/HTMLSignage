import type { Design } from '@htmlsignage/design-sdk';
import { {{designIdCamel}}Manifest } from './manifest';
import { {{designIdCamel}}Tokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * {{designName}} design pack entry-point.
 *
 * Exported under the name `{{designIdCamel}}Design`; register it in
 * `packages/frontend/src/designs/registry.ts` (see that file for the
 * matching workspace dep + DesignId union entry).
 */
export const {{designIdCamel}}Design: Design = {
  manifest: {{designIdCamel}}Manifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { {{designIdCamel}}Manifest, {{designIdCamel}}Tokens };
