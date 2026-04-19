import { DESIGN_SDK_API_VERSION, type DesignManifest } from '@htmlsignage/design-sdk';
import { mineralNoirTokens } from './tokens';

export const mineralNoirManifest: DesignManifest = {
  id: 'mineral-noir',
  version: '0.1.0',
  apiVersion: DESIGN_SDK_API_VERSION,
  name: 'Mineral Noir',
  description: 'Architektonischer Dark-Luxus — Platin-Typografie, Hairlines, asketische Ruhe.',
  author: 'HTMLSignage',
  supportedSlides: [
    'sauna-detail',
    'content-panel',
    'infos',
    'events',
    'media-image',
    'media-video',
  ],
  capabilities: ['dark-mode', 'landscape'],
  status: 'beta',
  defaultTokens: mineralNoirTokens,
};
