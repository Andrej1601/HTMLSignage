import { DESIGN_SDK_API_VERSION, type DesignManifest } from '@htmlsignage/design-sdk';
import { auroraThermalTokens } from './tokens';

/**
 * Aurora Thermal — das Aushängeschild-Design für den Produktivbetrieb.
 *
 * "Goldene Stunde in der Saunawelt." Warme Charcoal-Bühne mit Messing-
 * Akzenten, moderne Display-Serif, großzügige Rhythmik. Entwickelt für
 * permanent installierte Großdisplays im Spa-Bereich: dunkel genug, um
 * Gäste nicht zu blenden, warm genug, um Atmosphäre zu tragen.
 *
 * Status `stable` → geeignet als Default. Die drei Schwester-Packs
 * (Wellness Classic, Editorial Resort, Mineral Noir) bleiben als
 * alternative Bühnen bestehen.
 */
export const auroraThermalManifest: DesignManifest = {
  id: 'aurora-thermal',
  version: '1.0.0',
  apiVersion: DESIGN_SDK_API_VERSION,
  name: 'Aurora Thermal',
  description:
    'Goldene Stunde in der Saunawelt — warme Charcoal-Bühne, polierte Messing-Akzente, moderne Display-Serif.',
  author: 'HTMLSignage',
  supportedSlides: [
    'sauna-detail',
    'content-panel',
    'infos',
    'events',
    'media-image',
    'media-video',
  ],
  capabilities: ['dark-mode', 'landscape', 'portrait'],
  status: 'stable',
  defaultTokens: auroraThermalTokens,
};
