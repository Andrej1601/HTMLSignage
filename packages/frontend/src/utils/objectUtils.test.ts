import { describe, it, expect } from 'vitest';
import { isPlainRecord, deepMergeRecords } from './objectUtils';

describe('isPlainRecord', () => {
  it('returns true for plain objects', () => {
    expect(isPlainRecord({})).toBe(true);
    expect(isPlainRecord({ a: 1 })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord([1, 2])).toBe(false);
  });

  it('returns false for null/undefined/primitives', () => {
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord(undefined)).toBe(false);
    expect(isPlainRecord(42)).toBe(false);
    expect(isPlainRecord('string')).toBe(false);
    expect(isPlainRecord(true)).toBe(false);
  });
});

describe('deepMergeRecords', () => {
  it('merges flat objects', () => {
    expect(deepMergeRecords({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('override wins for same key', () => {
    expect(deepMergeRecords({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('deep merges nested objects', () => {
    const base = { theme: { bg: '#000', text: '#fff' } };
    const override = { theme: { bg: '#111' } };
    expect(deepMergeRecords(base, override)).toEqual({
      theme: { bg: '#111', text: '#fff' },
    });
  });

  it('override array replaces base array', () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    expect(deepMergeRecords(base, override)).toEqual({ items: [4, 5] });
  });

  it('does not mutate inputs', () => {
    const base = { a: { b: 1 } };
    const override = { a: { c: 2 } };
    const baseCopy = JSON.parse(JSON.stringify(base));
    deepMergeRecords(base, override);
    expect(base).toEqual(baseCopy);
  });

  it('handles deeply nested structures', () => {
    const base = { l1: { l2: { l3: { value: 'old' } } } };
    const override = { l1: { l2: { l3: { value: 'new' } } } };
    expect(deepMergeRecords(base, override)).toEqual({
      l1: { l2: { l3: { value: 'new' } } },
    });
  });
});
