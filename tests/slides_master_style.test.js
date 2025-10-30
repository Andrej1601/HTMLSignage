import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncActiveStyleSetSnapshot } from '../webroot/admin/js/ui/slides_master.js';

describe('slides master style set synchronisation', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

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

  it('captures typography controls when snapshotting the active style set', () => {
    const elements = {
      fontScale: { value: '1.2' },
      h1Scale: { value: '1.1' },
      h2Scale: { value: '0.95' },
      ovTitleScale: { value: '1.3' },
      ovHeadScale: { value: '1.05' },
      ovCellScale: { value: '0.9' },
      ovTimeScale: { value: '0.85' },
      ovTimeWidthScale: { value: '1.4' },
      overviewFlames: { checked: false }
    };

    global.document = {
      getElementById: (id) => elements[id] ?? null
    };

    const settings = {
      theme: {},
      fonts: {
        family: 'Inter',
        scale: 1,
        h1Scale: 1,
        h2Scale: 1,
        overviewTitleScale: 1,
        overviewHeadScale: 0.9,
        overviewCellScale: 0.8,
        overviewTimeScale: 0.8,
        overviewTimeWidthScale: 1,
        overviewShowFlames: true,
        tileTextScale: 0.8,
        tileWeight: 600,
        tileTimeWeight: 600,
        chipHeight: 1,
        chipOverflowMode: 'scale',
        flamePct: 55,
        flameGapScale: 0.14,
        tileMetaScale: 1,
        tileTimeScale: 1
      },
      slides: {
        activeStyleSet: 'classic',
        styleSets: {
          classic: {
            label: 'Classic',
            theme: {},
            fonts: {},
            slides: {},
            display: {}
          }
        }
      },
      display: {}
    };

    const result = syncActiveStyleSetSnapshot(settings);
    expect(result).toBe(true);

    const snapshotFonts = settings.slides.styleSets.classic.fonts;
    expect(snapshotFonts).toMatchObject({
      scale: 1.2,
      h1Scale: 1.1,
      h2Scale: 0.95,
      overviewTitleScale: 1.3,
      overviewHeadScale: 1.05,
      overviewCellScale: 0.9,
      overviewTimeScale: 0.85,
      overviewTimeWidthScale: 1.4,
      overviewShowFlames: false
    });
  });
});
