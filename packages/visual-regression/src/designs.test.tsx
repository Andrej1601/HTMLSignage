import { describe, expect, it } from 'vitest';
import type { Design, SaunaDetailStyle, SchedulePanelStyle } from '@htmlsignage/design-sdk';
import { wellnessClassicDesign } from '@htmlsignage/design-wellness-classic';
import { mineralNoirDesign } from '@htmlsignage/design-mineral-noir';
import { editorialResortDesign } from '@htmlsignage/design-editorial-resort';
import {
  buildContext,
  buildEventsPanelData,
  buildInfoPanelData,
  buildMediaImageData,
  buildMediaVideoData,
  buildSaunaDetailData,
  buildSchedulePanelData,
} from './fixtures';
import { renderSlideToHtml } from './harness';

/**
 * Visual-regression guard for every pack × slide × variant combo.
 *
 * Each matrix cell renders a single slide renderer with deterministic
 * fixture data and snapshots the resulting HTML. A snapshot drift
 * means the renderer's DOM tree or inline styles changed — which is
 * the class of regression we want to catch before shipping.
 */

const DESIGNS: Array<{ id: string; design: Design }> = [
  { id: 'wellness-classic', design: wellnessClassicDesign },
  { id: 'mineral-noir', design: mineralNoirDesign },
  { id: 'editorial-resort', design: editorialResortDesign },
];

const SCHEDULE_STYLES: SchedulePanelStyle[] = ['list', 'matrix', 'timeline'];
const SAUNA_DETAIL_STYLES: SaunaDetailStyle[] = ['split', 'hero', 'portrait'];

describe('Design pack HTML snapshots', () => {
  for (const { id, design } of DESIGNS) {
    describe(id, () => {
      // Content-panel × three style hints
      for (const style of SCHEDULE_STYLES) {
        it(`content-panel / ${style}`, () => {
          const html = renderSlideToHtml(
            design,
            'content-panel',
            buildSchedulePanelData(style),
            buildContext(),
          );
          expect(html).toMatchSnapshot();
        });
      }

      // Sauna-detail × three style hints
      for (const style of SAUNA_DETAIL_STYLES) {
        it(`sauna-detail / ${style}`, () => {
          const html = renderSlideToHtml(
            design,
            'sauna-detail',
            buildSaunaDetailData(style),
            buildContext(),
          );
          expect(html).toMatchSnapshot();
        });
      }

      it('infos', () => {
        const html = renderSlideToHtml(
          design,
          'infos',
          buildInfoPanelData(),
          buildContext(),
        );
        expect(html).toMatchSnapshot();
      });

      it('events', () => {
        const html = renderSlideToHtml(
          design,
          'events',
          buildEventsPanelData(),
          buildContext(),
        );
        expect(html).toMatchSnapshot();
      });

      it('media-image', () => {
        const html = renderSlideToHtml(
          design,
          'media-image',
          buildMediaImageData(),
          buildContext(),
        );
        expect(html).toMatchSnapshot();
      });

      it('media-video', () => {
        const html = renderSlideToHtml(
          design,
          'media-video',
          buildMediaVideoData(),
          buildContext(),
        );
        expect(html).toMatchSnapshot();
      });
    });
  }
});
