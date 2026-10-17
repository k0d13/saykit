import { describe, expect, it } from 'vitest';
import { dateTimeFormat, numberFormat, pluralRules, toDate, toNumeric } from './runtime.js';

describe('formatters', () => {
  it('keeps one per kind, locale and options bag', () => {
    // Constructing an `Intl` object is the expensive half, so a second message
    // asking for the same one has to reach it
    expect(numberFormat('en-US')).toBe(numberFormat('en-US'));
    expect(numberFormat('en-US', { style: 'percent' })).not.toBe(numberFormat('en-US'));
    expect(numberFormat('fr-FR')).not.toBe(numberFormat('en-US'));
    expect(dateTimeFormat('en-US', { year: 'numeric' })).toBe(
      dateTimeFormat('en-US', { year: 'numeric' }),
    );
  });

  it('keeps the cardinal and ordinal rules apart', () => {
    expect(pluralRules('en-US', 'cardinal').select(2)).toBe('other');
    expect(pluralRules('en-US', 'ordinal').select(2)).toBe('two');
  });
});

describe('toNumeric', () => {
  it('reads a number written as a string or a wrapper', () => {
    expect(toNumeric('42')).toBe(42);
    expect(toNumeric({ valueOf: () => 42 })).toBe(42);
  });

  // The precision is the whole point of writing one
  it('keeps a bigint a bigint', () => {
    expect(toNumeric(10n ** 25n)).toBe(10n ** 25n);
  });

  it('reads nothing numeric as nothing', () => {
    expect(toNumeric('lots')).toBeUndefined();
    expect(toNumeric('')).toBeUndefined();
    expect(toNumeric(null)).toBeUndefined();
  });
});

describe('toDate', () => {
  const when = new Date(2020, 0, 2);

  it('reads a Date, an epoch offset, a string or a wrapper', () => {
    expect(toDate(when)).toBe(when);
    expect(toDate(when.getTime())?.getTime()).toBe(when.getTime());
    expect(toDate('2020-01-02T00:00:00')?.getTime()).toBe(when.getTime());
    expect(toDate({ valueOf: () => when.getTime() })?.getTime()).toBe(when.getTime());
  });

  it('reads an invalid date as nothing', () => {
    expect(toDate('someday')).toBeUndefined();
    expect(toDate(new Date(Number.NaN))).toBeUndefined();
  });
});
