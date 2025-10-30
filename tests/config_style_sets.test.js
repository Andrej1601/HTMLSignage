import { describe, it, expect } from 'vitest';
import { normalizeSettings } from '../webroot/admin/js/core/config.js';

describe('style set sanitization', () => {
  it('retains display settings and time scale values', () => {
    const settings = {
      slides: {
        activeStyleSet: 'custom',
        styleSets: {
          custom: {
            label: 'Custom',
            display: { layoutMode: 'split', layoutProfile: 'portrait-split' },
            fonts: { overviewTimeScale: 1.4 }
          }
        }
      }
    };

    const normalized = normalizeSettings(settings, { assignMissingIds: false });
    const styleSet = normalized.slides.styleSets.custom;
    expect(styleSet.display).toMatchObject({
      layoutMode: 'split',
      layoutProfile: 'portrait-split'
    });
    expect(styleSet.fonts.overviewTimeScale).toBeCloseTo(1.4);
  });
});
