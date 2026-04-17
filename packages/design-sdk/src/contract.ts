import type { ComponentType, ReactNode } from 'react';
import type { DesignTokens } from './tokens';
import type { SlideDataFor, SlideTypeId } from './slide-data';

/**
 * Information every slide renderer receives alongside its data.
 */
export interface SlideRenderContext {
  /** ID of the zone this slide is rendered into. */
  zoneId: string;
  /** Total duration the slide will be visible, in ms. */
  durationMs: number;
  /** Whether transitions are enabled for the current slideshow. */
  transitionsEnabled: boolean;
  /** ISO language tag (e.g. 'de-DE'). */
  locale: string;
  /** Device identifier, for telemetry correlation. */
  deviceId?: string;
}

/**
 * Props every slide renderer receives. Typed by slide type `T`.
 */
export interface SlideRendererProps<T extends SlideTypeId> {
  data: SlideDataFor<T>;
  tokens: DesignTokens;
  context: SlideRenderContext;
}

/**
 * A slide renderer is a React component typed to a specific slide type.
 */
export type SlideRenderer<T extends SlideTypeId> = ComponentType<SlideRendererProps<T>>;

/**
 * Map of slide-type → renderer. Every design pack must provide renderers
 * for the slide types listed in `manifest.supportedSlides`.
 */
export type DesignRenderers = {
  [K in SlideTypeId]?: SlideRenderer<K>;
};

/**
 * Optional wrapper rendered once around all zones — useful for design-wide
 * chrome (gradients, logos, ambient motion). Receives the merged tokens.
 */
export interface DesignWrapperProps {
  tokens: DesignTokens;
  children: ReactNode;
}

export type DesignWrapper = ComponentType<DesignWrapperProps>;

/**
 * Capability flags a design may declare. Consumers (core + admin UI) can
 * filter/recommend designs based on these.
 */
export type DesignCapability =
  | 'dark-mode'
  | 'light-mode'
  | 'high-contrast'
  | 'portrait'
  | 'landscape'
  | 'reduced-motion'
  | 'custom-fonts';

export type DesignStatus = 'beta' | 'stable' | 'deprecated';

/**
 * Design manifest — the declarative metadata the loader validates before
 * mounting a design pack.
 */
export interface DesignManifest {
  /** Globally unique, kebab-case. */
  id: string;
  /** Semver string for the design pack itself. */
  version: string;
  /** Semver of the SDK API this design targets. Major must match the host SDK. */
  apiVersion: string;

  /** Human-readable name shown in admin UI. */
  name: string;
  /** One-sentence description. */
  description: string;
  /** Optional author/owner. */
  author?: string;
  /** Public URL or data URI of a preview thumbnail (16:9 recommended). */
  thumbnailUrl?: string;

  /** Slide types this design can render. Must match the renderers it ships. */
  supportedSlides: SlideTypeId[];
  /** Capability flags. Empty array is allowed. */
  capabilities: DesignCapability[];
  /** Lifecycle status. Admin UI may hide deprecated designs by default. */
  status: DesignStatus;

  /** Default tokens. Overrides compose on top of these. */
  defaultTokens: DesignTokens;

  /**
   * Optional compatibility bounds on the host app version. Semver ranges
   * (e.g. '>=2.0.0 <3.0.0'). If absent, design is assumed compatible.
   */
  appVersionRange?: string;
}

/**
 * A complete design pack: manifest + renderers (+ optional wrapper).
 *
 * A design is just data and components — no side effects at import time.
 * The loader calls `design.manifest` to validate, then mounts renderers.
 */
export interface Design {
  manifest: DesignManifest;
  renderers: DesignRenderers;
  Wrapper?: DesignWrapper;
}
