import { DESIGN_SDK_API_VERSION, type DesignManifest } from '@htmlsignage/design-sdk';
import { editorialResortTokens } from './tokens';

export const editorialResortManifest: DesignManifest = {
  id: 'editorial-resort',
  version: '0.1.0',
  apiVersion: DESIGN_SDK_API_VERSION,
  name: 'Editorial Resort',
  description:
    'Magazinartige Resort-Ästhetik — Serif-Typografie, warmes Cream-Papier, großzügige Rhythmik.',
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
  defaultTokens: editorialResortTokens,
};
