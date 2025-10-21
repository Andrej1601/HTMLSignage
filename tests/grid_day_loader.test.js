import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/dom';

vi.mock('../webroot/admin/js/ui/grid.js', () => ({
  renderGrid: vi.fn()
}));

vi.mock('../webroot/admin/js/ui/slides_master.js', () => ({
  renderSlidesMaster: vi.fn()
}));

const { renderGrid } = await import('../webroot/admin/js/ui/grid.js');
const { renderSlidesMaster } = await import('../webroot/admin/js/ui/slides_master.js');

const { initGridDayLoader } = await import('../webroot/admin/js/ui/grid_day_loader.js');

describe('grid day loader UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="gridActionsLeft"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders select options using saved preference', () => {
    localStorage.setItem('gridLoadDay', 'Wed');
    const ctx = {
      getSettings: () => ({ presets: { Wed: { rows: [] } } }),
      setSchedule: vi.fn()
    };

    initGridDayLoader(ctx);

    const select = document.getElementById('gridLoadDay');
    expect(select).toBeTruthy();
    expect(select.value).toBe('Wed');
    const options = Array.from(select.options).map((opt) => opt.value);
    expect(options).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('shows a warning when preset for selected day is missing', async () => {
    const notifications = await import('../webroot/admin/js/core/notifications.js');
    const warningSpy = vi.spyOn(notifications, 'notifyWarning').mockImplementation(() => {});
    const ctx = {
      getSettings: () => ({ presets: {} }),
      setSchedule: vi.fn()
    };

    initGridDayLoader(ctx);

    const button = screen.getByRole('button', { name: 'Laden' });
    fireEvent.click(button);

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy.mock.calls[0][0]).toMatch(/Kein Preset für/);
    warningSpy.mockRestore();
  });

  it('loads preset and triggers downstream renderers', () => {
    const preset = { rows: [{ time: '08:00', entries: [] }] };
    const ctx = {
      getSettings: () => ({ presets: { Mon: preset } }),
      setSchedule: vi.fn(),
      queueUnsavedEvaluation: vi.fn(),
      resetUnsavedBaseline: vi.fn(),
      hasUnsavedChanges: () => false
    };

    initGridDayLoader(ctx);

    const select = document.getElementById('gridLoadDay');
    select.value = 'Mon';
    const button = screen.getByRole('button', { name: 'Laden' });
    fireEvent.click(button);

    expect(ctx.setSchedule).toHaveBeenCalledTimes(1);
    const applied = ctx.setSchedule.mock.calls[0][0];
    expect(applied).toEqual(preset);
    expect(applied).not.toBe(preset);
    expect(ctx.queueUnsavedEvaluation).toHaveBeenCalled();
    expect(ctx.resetUnsavedBaseline).toHaveBeenCalledWith({ skipDraftClear: true });
    expect(renderGrid).toHaveBeenCalled();
    expect(renderSlidesMaster).toHaveBeenCalled();
  });
});
