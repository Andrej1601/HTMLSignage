import { describe, it, expect, afterEach } from 'vitest';
import { collectInfoModules, renderInfoModule, __setTestSettings } from '../webroot/player/src/main.js';

const resetSettings = () => __setTestSettings(null);

afterEach(() => {
  resetSettings();
});

describe('info modules', () => {
  it('collectInfoModules normalizes layout, region and dwell time', () => {
    __setTestSettings({
      extras: {
        infoModules: [
          {
            id: 'disabled',
            title: 'Disabled module',
            enabled: false,
            items: [{ label: 'Ignore', value: '0%' }]
          },
          {
            id: 'keep',
            title: ' Auslastung ',
            subtitle: ' Live ',
            icon: '📊',
            layout: 'Ticker',
            region: 'LEFT',
            dwellSec: '7',
            note: '  Hinweis ',
            items: [
              { id: 'm1', label: ' Sauna ', value: ' 80% ', icon: '🔥' },
              { label: '', value: '', text: '', badge: '' },
              { id: 'm2', label: 'Pool', text: 'geöffnet' }
            ]
          }
        ]
      }
    });

    const modules = collectInfoModules();
    expect(modules).toHaveLength(1);

    const module = modules[0];
    expect(module).toMatchObject({
      type: 'info-module',
      id: 'keep',
      title: 'Auslastung',
      subtitle: 'Live',
      icon: '📊',
      layout: 'ticker',
      region: 'left',
      note: 'Hinweis',
      dwellSec: 7
    });
    expect(module.items).toHaveLength(2);
    expect(module.items[0]).toMatchObject({ id: 'm1', label: 'Sauna', value: '80%', icon: '🔥' });
    expect(module.items[1]).toMatchObject({ id: 'm2', label: 'Pool', text: 'geöffnet' });
  });

  it('renderInfoModule duplicates ticker entries when more than one item', () => {
    const module = {
      id: 'capacity',
      layout: 'ticker',
      items: [
        { id: 'a', label: 'Sauna', value: '80%', icon: '🔥' },
        { id: 'b', label: 'Pool', text: 'offen' }
      ]
    };

    const container = renderInfoModule(module, 'right');
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.dataset.region).toBe('right');
    const track = container.querySelector('.extra-info-ticker-track');
    expect(track).toBeTruthy();
    const items = track.querySelectorAll('.extra-info-ticker-item');
    expect(items.length).toBe(4);
    const firstTexts = Array.from(items).map((node) => node.textContent?.trim());
    expect(firstTexts[0]).toBe(firstTexts[2]);
    expect(firstTexts[1]).toBe(firstTexts[3]);
  });

  it('renderInfoModule ticker does not duplicate a single entry', () => {
    const module = {
      id: 'single',
      layout: 'ticker',
      items: [{ id: 'solo', label: 'Sauna', value: '80%' }]
    };

    const container = renderInfoModule(module, 'left');
    const track = container.querySelector('.extra-info-ticker-track');
    expect(track).toBeTruthy();
    const items = track.querySelectorAll('.extra-info-ticker-item');
    expect(items.length).toBe(1);
  });
});
