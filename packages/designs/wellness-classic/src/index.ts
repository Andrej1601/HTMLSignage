import type { Design } from '@htmlsignage/design-sdk';
import { wellnessClassicManifest } from './manifest';
import { wellnessClassicTokens } from './tokens';
import { InfosSlideRenderer } from './slides/InfosSlideRenderer';

/**
 * Wellness Classic design pack.
 *
 * Phase 2 starts with one renderer (`infos`) to prove the contract
 * end-to-end. Remaining slide types (sauna-detail, content-panel,
 * events, media-image, media-video) land in subsequent commits.
 *
 * A design whose `manifest.supportedSlides` advertises a slide type
 * but omits the renderer falls back to the legacy component path at
 * the host level, so partial packs are safe to ship.
 */
export const wellnessClassicDesign: Design = {
  manifest: wellnessClassicManifest,
  renderers: {
    infos: InfosSlideRenderer,
  },
};

export { wellnessClassicManifest, wellnessClassicTokens };
