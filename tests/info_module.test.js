import { describe, it, expect, afterEach } from 'vitest';
import { collectInfoModules, renderInfoModule, __setTestSettings } from '../webroot/player/src/main.js';

const resetSettings = () => __setTestSettings(null);

afterEach(() => {
  resetSettings();
});

describe('info modules', () => {
  it('collectInfoModules aggregates enabled banner entries', () => {
    __setTestSettings({
      extras: {
        infoModules: [
          {
            id: 'disabled',
            enabled: false,
            text: 'Should be skipped'
          },
          {
            id: 'keep',
            text: '  Auslastung 80% ',
            icon: '  📊  '
          },
          {
            id: 'empty',
            text: '   '
          }
        ]
      }
    });

    const modules = collectInfoModules();
    expect(modules).toHaveLength(1);

    const module = modules[0];
    expect(module).toMatchObject({
      type: 'info-module',
      id: 'info-banner'
    });
    expect(module.items).toEqual([
      { id: 'keep', text: 'Auslastung 80%', icon: '📊' }
    ]);
  });

  it('renderInfoModule duplicates banner items when more than one entry', () => {
    const module = {
      id: 'capacity',
      items: [
        { id: 'a', text: 'Sauna 80%', icon: '🔥' },
        { id: 'b', text: 'Pool offen' }
      ]
    };

    const container = renderInfoModule(module, 'right');
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.dataset.region).toBe('right');
    expect(container.classList.contains('extra-info-banner')).toBe(true);
    const track = container.querySelector('.info-banner-track');
    expect(track).toBeTruthy();
    const items = track.querySelectorAll('.info-banner-item');
    expect(items.length).toBe(4);
    const firstTexts = Array.from(items).map((node) => node.textContent?.trim());
    expect(firstTexts[0]).toBe(firstTexts[2]);
    expect(firstTexts[1]).toBe(firstTexts[3]);
  });

  it('renderInfoModule does not duplicate a single banner entry', () => {
    const module = {
      id: 'single',
      items: [{ id: 'solo', text: 'Sauna 80%' }]
    };

    const container = renderInfoModule(module, 'left');
    const track = container.querySelector('.info-banner-track');
    expect(track).toBeTruthy();
    const items = track.querySelectorAll('.info-banner-item');
    expect(items.length).toBe(1);
  });
});
