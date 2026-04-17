import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  Design,
  SlideDataFor,
  SlideRendererProps,
  SlideTypeId,
} from '@htmlsignage/design-sdk';
import { wellnessClassicDesign } from '@htmlsignage/design-wellness-classic';
import { modernOasisDesign } from '@htmlsignage/design-modern-oasis';
import { editorialResortDesign } from '@htmlsignage/design-editorial-resort';
import { mineralNoirDesign } from '@htmlsignage/design-mineral-noir';
import { DEFAULT_CONTEXT, SLIDE_FIXTURES } from './fixtures';

const DESIGNS: Array<[string, Design]> = [
  ['wellness-classic', wellnessClassicDesign],
  ['modern-oasis', modernOasisDesign],
  ['editorial-resort', editorialResortDesign],
  ['mineral-noir', mineralNoirDesign],
];

const SLIDE_TYPES: SlideTypeId[] = [
  'sauna-detail',
  'content-panel',
  'infos',
  'events',
  'media-image',
  'media-video',
];

/**
 * Strip portions of the output that jitter between runs (random keys,
 * aroma-id autogen counters, etc.) so snapshots stay stable.
 */
function stableMarkup(html: string): string {
  return html.replace(/data-react[^=]*="[^"]*"/g, '');
}

/**
 * Snapshot-regression suite. Every design × every supported slide type
 * gets rendered to static markup with deterministic fixtures; Vitest
 * writes / reads the baseline from `__snapshots__/`. A failing assertion
 * means the renderer's output changed — either intentionally (update
 * snapshots) or as a regression (fix the renderer).
 */
describe('design pack renderers', () => {
  for (const [designId, design] of DESIGNS) {
    describe(designId, () => {
      it('manifest declares the expected slide types', () => {
        for (const slideType of SLIDE_TYPES) {
          expect(design.manifest.supportedSlides, `${designId} → ${slideType}`).toContain(slideType);
          expect(design.renderers[slideType], `${designId} → renderer for ${slideType}`).toBeDefined();
        }
      });

      for (const slideType of SLIDE_TYPES) {
        it(`renders ${slideType}`, () => {
          const renderer = design.renderers[slideType];
          if (!renderer) throw new Error(`missing renderer: ${slideType}`);

          const props: SlideRendererProps<typeof slideType> = {
            data: SLIDE_FIXTURES[slideType] as SlideDataFor<typeof slideType>,
            tokens: design.manifest.defaultTokens,
            context: DEFAULT_CONTEXT,
          };

          const html = renderToStaticMarkup(
            createElement(renderer as React.ComponentType<typeof props>, props),
          );
          expect(stableMarkup(html)).toMatchSnapshot();
        });
      }
    });
  }
});
