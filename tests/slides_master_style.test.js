import { describe, it, expect } from 'vitest';
import { syncActiveStyleSetSnapshot } from '../webroot/admin/js/ui/slides_master.js';

describe('slides master style set synchronisation', () => {
  it('copies selected sections into the active style set snapshot', () => {
    const settings = {
      theme: { bg: '#111111', fg: '#ffffff', accent: '#ff6600' },
      fonts: { family: 'Inter', tileTextScale: 1.2 },
      slides: {
        activeStyleSet: 'primary',
        tileHeightScale: 1.1,
        styleSets: {
          primary: {
            label: 'Primary',
            theme: { bg: '#000000' },
            fonts: { family: 'System' },
            slides: { tileHeightScale: 0.9 },
            display: { layoutMode: 'grid' }
          }
        }
      },
      display: { layoutMode: 'list' }
    };

    const result = syncActiveStyleSetSnapshot(settings, {
      includeTheme: true,
      includeFonts: false,
      includeSlides: true,
      includeDisplay: false
    });

    expect(result).toBe(true);
    const snapshot = settings.slides.styleSets.primary;
    expect(snapshot.theme).toMatchObject({ bg: '#111111', fg: '#ffffff', accent: '#ff6600' });
    expect(snapshot.slides).toMatchObject({ tileHeightScale: 1.1 });
    expect(snapshot.fonts.family).toBe('System');
    expect(snapshot.display.layoutMode).toBe('grid');
  });

  it('returns false when active style set is missing', () => {
    const settings = { slides: { activeStyleSet: 'missing', styleSets: {} } };
    expect(syncActiveStyleSetSnapshot(settings)).toBe(false);
  });
});
