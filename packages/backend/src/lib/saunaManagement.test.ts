import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateSaunaStatusInSettings, SaunaNotFoundError } from './saunaManagement.js';

describe('updateSaunaStatusInSettings', () => {
  it('updates the status of the matching sauna', () => {
    const data: Record<string, unknown> = {
      saunas: [
        { id: 's1', name: 'Finnish', status: 'off' },
        { id: 's2', name: 'Steam', status: 'off' },
      ],
    };
    const result = updateSaunaStatusInSettings(data, 's1', 'on');
    const saunas = result.saunas as Array<Record<string, unknown>>;
    assert.equal(saunas[0].status, 'on');
    assert.equal(saunas[1].status, 'off');
  });

  it('throws SaunaNotFoundError for unknown id', () => {
    const data: Record<string, unknown> = {
      saunas: [{ id: 's1', name: 'Finnish', status: 'off' }],
    };
    assert.throws(
      () => updateSaunaStatusInSettings(data, 'unknown', 'on'),
      (err: unknown) => err instanceof SaunaNotFoundError && err.saunaId === 'unknown',
    );
  });

  it('throws when saunas array is missing', () => {
    assert.throws(
      () => updateSaunaStatusInSettings({}, 's1', 'on'),
      SaunaNotFoundError,
    );
  });

  it('does not mutate original sauna objects', () => {
    const original = { id: 's1', name: 'Finnish', status: 'off' };
    const data: Record<string, unknown> = { saunas: [original] };
    updateSaunaStatusInSettings(data, 's1', 'on');
    assert.equal(original.status, 'off');
  });

  it('preserves other properties on the sauna', () => {
    const data: Record<string, unknown> = {
      saunas: [{ id: 's1', name: 'Finnish', status: 'off', temp: 80 }],
    };
    const result = updateSaunaStatusInSettings(data, 's1', 'heating');
    const saunas = result.saunas as Array<Record<string, unknown>>;
    assert.equal(saunas[0].temp, 80);
    assert.equal(saunas[0].name, 'Finnish');
    assert.equal(saunas[0].status, 'heating');
  });

  it('preserves other fields on data object', () => {
    const data: Record<string, unknown> = {
      theme: 'dark',
      saunas: [{ id: 's1', status: 'off' }],
    };
    const result = updateSaunaStatusInSettings(data, 's1', 'on');
    assert.equal(result.theme, 'dark');
  });
});

describe('SaunaNotFoundError', () => {
  it('has correct name and message', () => {
    const err = new SaunaNotFoundError('xyz');
    assert.equal(err.name, 'SaunaNotFoundError');
    assert.equal(err.saunaId, 'xyz');
    assert.ok(err.message.includes('xyz'));
  });

  it('is an instance of Error', () => {
    assert.ok(new SaunaNotFoundError('a') instanceof Error);
  });
});
