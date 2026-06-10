import { DESIGN_SDK_API_VERSION, type DesignManifest } from '@htmlsignage/design-sdk';
import { wellnessClassicTokens } from './tokens';

export const wellnessClassicManifest: DesignManifest = {
  id: 'wellness-classic',
  version: '0.1.0',
  apiVersion: DESIGN_SDK_API_VERSION,
  name: 'Wellness Classic',
  description:
    'Das warme, klassische Erscheinungsbild mit Standard-Palette und ruhiger Typografie.',
  author: 'HTMLSignage',
  supportedSlides: [
    'sauna-detail',
    'content-panel',
    'infos',
    'events',
    'media-image',
    'media-video',
  ],
  capabilities: ['light-mode', 'landscape'],
  status: 'beta',
  defaultTokens: wellnessClassicTokens,
};
