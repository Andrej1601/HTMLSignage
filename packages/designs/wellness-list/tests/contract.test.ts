import { describe, expect, it } from 'vitest';
import {
  DESIGN_SDK_API_VERSION,
  designManifestSchema,
  designTokensSchema,
  isApiVersionCompatible,
  type SlideTypeId,
} from '@htmlsignage/design-sdk';
import { wellnessListDesign } from '../src/index';

describe('Wellness List design pack contract', () => {
  const { manifest, renderers } = wellnessListDesign;

  it('manifest passes the SDK schema', () => {
    expect(() => designManifestSchema.parse(manifest)).not.toThrow();
  });

  it('default tokens pass the SDK schema', () => {
    expect(() => designTokensSchema.parse(manifest.defaultTokens)).not.toThrow();
  });

  it('targets a compatible SDK API version', () => {
    expect(isApiVersionCompatible(manifest.apiVersion)).toBe(true);
  });

  it('matches the host SDK major version exactly', () => {
    const packMajor = manifest.apiVersion.split('.')[0];
    const sdkMajor = DESIGN_SDK_API_VERSION.split('.')[0];
    expect(packMajor).toBe(sdkMajor);
  });

  it('declares at least one supported slide type', () => {
    expect(manifest.supportedSlides.length).toBeGreaterThan(0);
  });

  it('ships a renderer for every slide type declared in supportedSlides', () => {
    for (const slideType of manifest.supportedSlides as SlideTypeId[]) {
      expect(renderers[slideType], `renderer missing for "${slideType}"`).toBeDefined();
    }
  });
});
