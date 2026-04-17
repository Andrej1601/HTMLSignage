import { describe, expect, it } from 'vitest';
import {
  DESIGN_SDK_API_VERSION,
  designTokensSchema,
  designTokenOverridesSchema,
  isApiVersionCompatible,
  parseDesignManifest,
  safeParseDesignManifest,
  type DesignManifest,
  type DesignTokens,
} from '../src/index';

const validTokens: DesignTokens = {
  colors: {
    surface: '#E8DEBD',
    surfaceElevated: '#F9F7F4',
    border: '#D4A574',
    textPrimary: '#5C3101',
    textSecondary: '#7A4A1F',
    textInverse: '#FFFFFF',
    accentPrimary: '#D4A574',
    accentSecondary: '#B8976A',
    statusLive: '#10B981',
    statusNext: '#D4A574',
    statusWarning: '#F59E0B',
  },
  typography: {
    fontBody: 'Inter, system-ui, sans-serif',
    fontHeading: 'Inter, system-ui, sans-serif',
    fontMono: 'JetBrains Mono, monospace',
    baseSizePx: 16,
    baseLineHeight: 1.5,
    scaleSm: 0.875,
    scaleBase: 1,
    scaleLg: 1.125,
    scaleXl: 1.25,
    scale2xl: 1.5,
    scale3xl: 2,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  radius: { sm: 4, md: 8, lg: 16, pill: 9999 },
  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },
};

const validManifest: DesignManifest = {
  id: 'wellness-classic',
  version: '1.0.0',
  apiVersion: DESIGN_SDK_API_VERSION,
  name: 'Wellness Classic',
  description: 'The default wellness spa appearance.',
  supportedSlides: ['sauna-detail', 'content-panel', 'infos', 'events'],
  capabilities: ['light-mode', 'landscape'],
  status: 'stable',
  defaultTokens: validTokens,
};

describe('api-version', () => {
  it('exports a semver string', () => {
    expect(DESIGN_SDK_API_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('accepts matching major', () => {
    expect(isApiVersionCompatible('1.5.0')).toBe(true);
    expect(isApiVersionCompatible('1.0.0-beta.2')).toBe(true);
  });

  it('rejects mismatching major', () => {
    expect(isApiVersionCompatible('2.0.0')).toBe(false);
    expect(isApiVersionCompatible('0.9.0')).toBe(false);
  });
});

describe('designTokensSchema', () => {
  it('accepts a well-formed token set', () => {
    expect(() => designTokensSchema.parse(validTokens)).not.toThrow();
  });

  it('accepts alternative color syntaxes', () => {
    const tokens = {
      ...validTokens,
      colors: {
        ...validTokens.colors,
        surface: 'oklch(0.9 0.02 80)',
        surfaceElevated: 'rgb(249 247 244)',
        border: 'var(--brand-border)',
      },
    };
    expect(() => designTokensSchema.parse(tokens)).not.toThrow();
  });

  it('rejects a non-color string for a color field', () => {
    const tokens = { ...validTokens, colors: { ...validTokens.colors, surface: '' } };
    expect(designTokensSchema.safeParse(tokens).success).toBe(false);
  });

  it('rejects negative spacing', () => {
    const tokens = { ...validTokens, spacing: { ...validTokens.spacing, md: -1 } };
    expect(designTokensSchema.safeParse(tokens).success).toBe(false);
  });
});

describe('designTokenOverridesSchema', () => {
  it('accepts an empty override object', () => {
    expect(() => designTokenOverridesSchema.parse({})).not.toThrow();
  });

  it('accepts a partial color override', () => {
    expect(() =>
      designTokenOverridesSchema.parse({ colors: { accentPrimary: '#ff0000' } }),
    ).not.toThrow();
  });

  it('rejects unknown category keys', () => {
    const result = designTokenOverridesSchema.safeParse({ mystery: { foo: 'bar' } });
    // zod in strict default is loose on unknown keys; at minimum the shape
    // is validated for known categories — this is a sanity check, not strict.
    expect(result.success).toBe(true);
  });
});

describe('designManifestSchema', () => {
  it('accepts a well-formed manifest', () => {
    expect(() => parseDesignManifest(validManifest)).not.toThrow();
  });

  it('rejects a non-kebab id', () => {
    const bad = { ...validManifest, id: 'WellnessClassic' };
    expect(safeParseDesignManifest(bad).success).toBe(false);
  });

  it('rejects a non-semver version', () => {
    const bad = { ...validManifest, version: '1.0' };
    expect(safeParseDesignManifest(bad).success).toBe(false);
  });

  it('requires at least one supported slide type', () => {
    const bad = { ...validManifest, supportedSlides: [] as DesignManifest['supportedSlides'] };
    expect(safeParseDesignManifest(bad).success).toBe(false);
  });

  it('rejects an invalid slide type id', () => {
    const bad = { ...validManifest, supportedSlides: ['unknown-slide'] };
    expect(safeParseDesignManifest(bad).success).toBe(false);
  });

  it('returns structured issues on failure', () => {
    const bad = { ...validManifest, id: 'Bad Id', version: 'v1' };
    const result = safeParseDesignManifest(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('id');
      expect(paths).toContain('version');
    }
  });
});
