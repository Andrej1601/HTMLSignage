import type { Design } from '@htmlsignage/design-sdk';
import { wellnessClassicManifest } from './manifest';
import { wellnessClassicTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';
import { MediaImageRenderer } from './slides/MediaImageRenderer';
import { MediaVideoRenderer } from './slides/MediaVideoRenderer';
import { EventsSlideRenderer } from './slides/EventsSlideRenderer';
import { SaunaDetailRenderer } from './slides/SaunaDetailRenderer';
import { SchedulePanelRenderer } from './slides/SchedulePanelRenderer';

/**
 * Wellness Classic design pack.
 *
 * Ships renderers for all six slide types, each consuming the headless
 * data shapes from `@htmlsignage/design-sdk` and styling exclusively
 * through the token set declared in `wellnessClassicTokens`.
 */
export const wellnessClassicDesign: Design = {
  manifest: wellnessClassicManifest,
  renderers: {
    infos: InfosSlideRenderer,
    'media-image': MediaImageRenderer,
    'media-video': MediaVideoRenderer,
    events: EventsSlideRenderer,
    'sauna-detail': SaunaDetailRenderer,
    'content-panel': SchedulePanelRenderer,
  },
};

export { wellnessClassicManifest, wellnessClassicTokens };
