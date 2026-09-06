import { describe, expect, it } from 'vitest';
import { datetime, duration, number, plural } from './runtime.js';

describe('number', () => {
  it('formats for the locale it is given', () => {
    expect(number('en-US', 1234.5)).toBe('1,234.5');
    expect(number('fr-FR', 1234.5)).toBe('1 234,5');
  });

  it('takes an Intl options bag', () => {
    expect(number('en-US', 0.25, { style: 'percent' })).toBe('25%');
  });

  it('formats a bigint without narrowing it', () => {
    expect(number('en-US', 9007199254740993n)).toBe('9,007,199,254,740,993');
  });

  it('keeps one formatter per locale and options bag', () => {
    // Constructing an `Intl` object is the expensive half, so the second call
    // has to reach the same one
    expect(number('en-US', 1)).toBe(number('en-US', 1));
    expect(number('en-US', 1, { style: 'percent' })).toBe('100%');
    expect(number('en-US', 1)).toBe('1');
  });
});

describe('datetime', () => {
  const when = new Date(2020, 0, 2, 12, 4, 5);

  it('formats a Date', () => {
    expect(datetime('en-US', when, { year: 'numeric', month: 'long' })).toBe('January 2020');
  });

  it('formats an epoch offset', () => {
    expect(datetime('en-US', when.getTime(), { year: 'numeric' })).toBe('2020');
  });
});

describe('plural', () => {
  it('selects a cardinal category by default', () => {
    expect(plural('en-US', 1)).toBe('one');
    expect(plural('en-US', 5)).toBe('other');
  });

  it('selects an ordinal category when asked', () => {
    expect(plural('en-US', 1, 'ordinal')).toBe('one');
    expect(plural('en-US', 2, 'ordinal')).toBe('two');
    expect(plural('en-US', 4, 'ordinal')).toBe('other');
  });

  it('keeps the cardinal and ordinal rules apart', () => {
    expect(plural('en-US', 2)).toBe('other');
    expect(plural('en-US', 2, 'ordinal')).toBe('two');
  });
});

describe('duration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [61, '1:01'],
    [3661, '1:01:01'],
    [-61, '-1:01'],
    [1.5, '0:01.500'],
  ])('writes %d as a clock reading', (seconds, expected) => {
    expect(duration(seconds)).toBe(expected);
  });

  it('writes a value that is not a number as itself', () => {
    expect(duration(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(duration(Number.NaN)).toBe('NaN');
  });
});
