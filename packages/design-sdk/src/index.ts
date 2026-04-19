/**
 * @htmlsignage/design-sdk — public entry point.
 *
 * This SDK defines the contract every design pack must implement and the
 * schemas the host uses to validate packs at load time. It has zero
 * runtime dependencies on the host app beyond React + zod.
 *
 * Phase 0 establishes the contract only; Phase 1 wires real slide data,
 * Phase 2 ships the first design pack built on top.
 */

export { DESIGN_SDK_API_VERSION, isApiVersionCompatible } from './api-version';

export type {
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  RadiusTokens,
  MotionTokens,
  DesignTokens,
  DesignTokenOverrides,
} from './tokens';

export type {
  SlideTypeId,
  SlideDataMap,
  SlideDataFor,
  SaunaAroma,
  SaunaInfusionEntry,
  SaunaDetailInfo,
  SaunaDetailData,
  SaunaDetailStyle,
  SchedulePanelData,
  SchedulePanelCell,
  SchedulePanelStyle,
  InfoImageMode,
  InfoPanelData,
  EventStatusRank,
  EventSlideEntry,
  EventsPanelData,
  MediaImageData,
  MediaVideoData,
} from './slide-data';

export type {
  SlideViewport,
  SlideRenderContext,
  SlideRendererProps,
  SlideRenderer,
  DesignRenderers,
  DesignWrapperProps,
  DesignWrapper,
  DesignCapability,
  DesignStatus,
  DesignManifest,
  Design,
} from './contract';

export {
  colorTokensSchema,
  typographyTokensSchema,
  spacingTokensSchema,
  radiusTokensSchema,
  motionTokensSchema,
  designTokensSchema,
  designTokenOverridesSchema,
  designManifestSchema,
  parseDesignManifest,
  safeParseDesignManifest,
} from './schemas';
