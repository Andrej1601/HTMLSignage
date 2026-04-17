import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ErrorInfo } from 'react';
import type {
  DesignTokens,
  DesignTokenOverrides,
  SlideDataFor,
  SlideRenderContext,
  SlideTypeId,
  SlideViewport,
} from '@htmlsignage/design-sdk';
import { DesignErrorBoundary } from './DesignErrorBoundary';
import { useDesign } from './useDesign';
import { DEFAULT_DESIGN_ID, type DesignId } from './registry';
import { recordDesignError } from '@/services/api/telemetry';

interface DesignHostProps<T extends SlideTypeId> {
  /** The slide type being rendered — selects the right renderer in the pack. */
  slideType: T;
  /** Headless data produced by the slide-data hooks. */
  data: SlideDataFor<T>;
  /** Partial context — the host fills in the measured viewport. */
  context: Omit<SlideRenderContext, 'viewport'>;
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
  tokenOverrides?: DesignTokenOverrides;
}

function mergeTokens(base: DesignTokens, overrides?: DesignTokenOverrides): DesignTokens {
  if (!overrides) return base;
  return {
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    typography: { ...base.typography, ...(overrides.typography ?? {}) },
    spacing: { ...base.spacing, ...(overrides.spacing ?? {}) },
    radius: { ...base.radius, ...(overrides.radius ?? {}) },
    motion: { ...base.motion, ...(overrides.motion ?? {}) },
  };
}

/** Thresholds used to flag narrow / short / compact containers. */
const NARROW_PX = 640;
const SHORT_PX = 420;
const COMPACT_PX = 320;
const ULTRA_COMPACT_PX = 220;

function deriveViewport(width: number, height: number): SlideViewport {
  return {
    width,
    height,
    isNarrow: width > 0 && width < NARROW_PX,
    isShort: height > 0 && height < SHORT_PX,
    isCompact: (width > 0 && width < COMPACT_PX) || (height > 0 && height < COMPACT_PX),
    isUltraCompact:
      (width > 0 && width < ULTRA_COMPACT_PX) || (height > 0 && height < ULTRA_COMPACT_PX),
  };
}

/**
 * Hook: observe a ref'd element's size with ResizeObserver, return the
 * latest dimensions as a `SlideViewport`. Updates are throttled to the
 * browser's animation frame to avoid layout thrash.
 */
function useMeasuredViewport(ref: React.RefObject<HTMLElement | null>): SlideViewport {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const schedule = (w: number, h: number) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      });
    };

    // Initial measurement (ResizeObserver fires async).
    schedule(el.clientWidth, el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      schedule(Math.round(box.width), Math.round(box.height));
    });
    observer.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);

  return deriveViewport(size.width, size.height);
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewport = useMeasuredViewport(wrapperRef);

  const handleRenderError = useCallback(
    (err: Error, info: ErrorInfo) => {
      void recordDesignError({
        designId: design?.manifest.id ?? resolvedId,
        slideType,
        message: err.message || 'Unknown design renderer error',
        stack: err.stack ?? undefined,
        componentStack: info.componentStack ?? undefined,
        occurredAt: new Date().toISOString(),
      });
    },
    [design?.manifest.id, resolvedId, slideType],
  );

  // Legacy-path render. Wrapped in the same sizing element so the flag
  // flip doesn't reflow the page.
  const renderedFallback = (
    <div ref={wrapperRef} className="h-full w-full">
      {fallback}
    </div>
  );

  if (!enabled || error || !design) return renderedFallback;

  const renderer = design.renderers[slideType];
  if (!renderer) return renderedFallback;

  const tokens = mergeTokens(design.manifest.defaultTokens, tokenOverrides);
  const fullContext: SlideRenderContext = { ...context, viewport };

  const content = createElement(renderer, {
    data,
    tokens,
    context: fullContext,
  });

  const wrapped = design.Wrapper
    ? createElement(design.Wrapper, { tokens, children: content })
    : content;

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <DesignErrorBoundary
        fallback={fallback}
        resetKey={`${design.manifest.id}:${slideType}`}
        onError={handleRenderError}
      >
        {wrapped}
      </DesignErrorBoundary>
    </div>
  );
}
