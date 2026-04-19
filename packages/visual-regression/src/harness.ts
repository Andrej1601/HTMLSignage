import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  Design,
  DesignTokens,
  SlideRendererProps,
  SlideTypeId,
} from '@htmlsignage/design-sdk';

/**
 * Render a pack's slide renderer to a static HTML string. Intentionally
 * uses `renderToStaticMarkup` (no React hydration hooks, no `data-*`
 * reconciliation markers) so the snapshots stay stable and readable.
 *
 * The snapshot carries inline styles + class names — which is exactly
 * what the pack renderers emit. Pure CSS changes wouldn't surface in
 * HTML, but the packs style via `style={}` + tokens rather than
 * external stylesheets, so visual regressions show up as attribute
 * diffs that a JSON/HTML snapshot comparison catches reliably.
 */
export function renderSlideToHtml<T extends SlideTypeId>(
  design: Design,
  slideType: T,
  data: SlideRendererProps<T>['data'],
  context: SlideRendererProps<T>['context'],
  tokenOverrides?: Partial<DesignTokens>,
): string {
  const renderer = design.renderers[slideType] as
    | ComponentType<SlideRendererProps<T>>
    | undefined;
  if (!renderer) {
    throw new Error(
      `Design "${design.manifest.id}" is missing a renderer for slide type "${slideType}".`,
    );
  }

  const tokens: DesignTokens = {
    ...design.manifest.defaultTokens,
    ...(tokenOverrides ?? {}),
  };

  const element = createElement(renderer, { data, tokens, context });
  return renderToStaticMarkup(element);
}
