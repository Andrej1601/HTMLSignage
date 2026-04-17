import { createElement, type ReactNode } from 'react';
import type {
  DesignTokens,
  SlideDataFor,
  SlideRenderContext,
  SlideTypeId,
} from '@htmlsignage/design-sdk';
import { DesignErrorBoundary } from './DesignErrorBoundary';
import { useDesign } from './useDesign';
import { DEFAULT_DESIGN_ID, type DesignId } from './registry';

interface DesignHostProps<T extends SlideTypeId> {
  /** The slide type being rendered — selects the right renderer in the pack. */
  slideType: T;
  /** Headless data produced by the slide-data hooks. */
  data: SlideDataFor<T>;
  /** Render context passed through to the renderer. */
  context: SlideRenderContext;
  /**
   * Rendered in place of the design renderer when:
   * - no design pack is active / `enabled === false`,
   * - the pack is still loading,
   * - the pack is missing a renderer for this slide type,
   * - the renderer throws at runtime (caught by the boundary),
   * - the pack failed manifest validation.
   */
  fallback: ReactNode;
  /** Feature flag: if false, the fallback renders unconditionally. */
  enabled: boolean;
  /** Which pack to use. Defaults to the first registered one. */
  designId?: DesignId;
  /**
   * Optional overrides merged onto the design's default tokens.
   * Phase 4 lights this up for tenant/slideshow branding.
   */
  tokenOverrides?: Partial<DesignTokens>;
}

function mergeTokens(base: DesignTokens, overrides?: Partial<DesignTokens>): DesignTokens {
  if (!overrides) return base;
  return {
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    typography: { ...base.typography, ...(overrides.typography ?? {}) },
    spacing: { ...base.spacing, ...(overrides.spacing ?? {}) },
    radius: { ...base.radius, ...(overrides.radius ?? {}) },
    motion: { ...base.motion, ...(overrides.motion ?? {}) },
  };
}

/**
 * Mount point for design-pack rendering. The host resolves a design
 * pack by id, selects the renderer for the current slide type, and
 * guards the tree with an error boundary.
 *
 * If the feature flag is off, the pack is still loading, the pack
 * doesn't ship a renderer for this slide type, or the renderer
 * crashes at runtime, the `fallback` is rendered — meaning the legacy
 * component path stays authoritative until Phase 3.
 */
export function DesignHost<T extends SlideTypeId>(props: DesignHostProps<T>) {
  const { slideType, data, context, fallback, enabled, designId, tokenOverrides } = props;

  const resolvedId: DesignId = designId ?? DEFAULT_DESIGN_ID;
  const { design, error } = useDesign(resolvedId);

  if (!enabled || error || !design) return <>{fallback}</>;

  const renderer = design.renderers[slideType];
  if (!renderer) return <>{fallback}</>;

  const tokens = mergeTokens(design.manifest.defaultTokens, tokenOverrides);

  const content = createElement(renderer, {
    data,
    tokens,
    context,
  });

  const wrapped = design.Wrapper
    ? createElement(design.Wrapper, { tokens, children: content })
    : content;

  return (
    <DesignErrorBoundary
      fallback={fallback}
      resetKey={`${design.manifest.id}:${slideType}`}
    >
      {wrapped}
    </DesignErrorBoundary>
  );
}
