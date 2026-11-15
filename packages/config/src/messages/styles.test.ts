import { describe, expect, it } from 'vitest';
import { ARGUMENT_TYPES, isArgumentType, validateArgumentStyle } from './styles.js';

describe('isArgumentType', () => {
  it.each(ARGUMENT_TYPES)('claims %s', (type) => {
    expect(isArgumentType(type)).toBe(true);
  });

  it('rejects a type the formatter cannot honour', () => {
    expect(isArgumentType('spellout')).toBe(false);
    expect(isArgumentType('duration')).toBe(false);
    expect(isArgumentType('choice')).toBe(false);
  });

  // The types come from a plain object, so a key every object inherits must not
  // pass for one an author asked for
  it('rejects an inherited property name', () => {
    expect(isArgumentType('toString')).toBe(false);
    expect(isArgumentType('constructor')).toBe(false);
  });
});

describe('validateArgumentStyle', () => {
  it.each([
    ['number', 'integer'],
    ['number', 'percent'],
    ['date', 'short'],
    ['date', 'full'],
    ['time', 'medium'],
    ['time', 'long'],
  ] as const)('accepts the %s style %s', (type, style) => {
    expect(() => validateArgumentStyle(type, style)).not.toThrow();
  });

  it('accepts a literal number pattern', () => {
    expect(() => validateArgumentStyle('number', '#,##0.00')).not.toThrow();
    expect(() => validateArgumentStyle('number', '0.###')).not.toThrow();
  });

  // A brace would close the argument early and take the rest of the message
  // with it, so it is rejected even though a number style is otherwise open
  it('rejects a number pattern containing ICU pattern syntax', () => {
    expect(() => validateArgumentStyle('number', '#,##0{}')).toThrow('Invalid number style');
    expect(() => validateArgumentStyle('number', '#\n0')).toThrow('Invalid number style');
    expect(() => validateArgumentStyle('number', '')).toThrow('Invalid number style');
  });

  it('rejects an unknown date or time style', () => {
    expect(() => validateArgumentStyle('date', 'meduim')).toThrow(
      "Invalid date style 'meduim', expected 'short', 'medium', 'long', 'full'",
    );
    expect(() => validateArgumentStyle('time', 'relative')).toThrow('Invalid time style');
  });

  // MF1 has nowhere to write the currency code, so this formats as a bare
  // number. The literal-pattern escape must not readmit it as a "pattern"
  it('rejects the currency style, which the formatter cannot honour', () => {
    expect(() => validateArgumentStyle('number', 'currency')).toThrow('Invalid number style');
    expect(() => validateArgumentStyle('date', 'currency')).toThrow('Invalid date style');
  });

  // A pattern is what has a digit placeholder in it; a bare word is a style
  // name, and every style name we do not support has to stay rejected
  it.each(['spellout', 'duration', 'compact', 'meduim'])(
    'rejects the bare word %o as a number pattern',
    (style) => {
      expect(() => validateArgumentStyle('number', style)).toThrow('Invalid number style');
    },
  );

  // A skeleton is the open-ended half of a style, so it is checked by being
  // resolved rather than by being looked up
  it.each([
    ['number', '::currency/EUR'],
    ['number', '::compact-short'],
    ['number', '::percent scale/100'],
    ['number', '::scale/1000'],
    ['number', '::.00'],
    ['date', '::yyyyMMdd'],
    ['date', '::yMMMM'],
    ['time', '::Hm'],
  ] as const)('accepts the %s skeleton %s', (type, style) => {
    expect(() => validateArgumentStyle(type, style)).not.toThrow();
  });

  it('rejects a skeleton that names no fields', () => {
    expect(() => validateArgumentStyle('date', '::')).toThrow(
      "Invalid date skeleton '::': it names no fields",
    );
    // Every token is understood, but a literal shows nothing on its own
    expect(() => validateArgumentStyle('date', "::'x'")).toThrow('Invalid date skeleton');
  });

  it('rejects a skeleton the formatter cannot resolve', () => {
    expect(() => validateArgumentStyle('number', '::bogus')).toThrow(
      "Invalid number skeleton '::bogus'",
    );
    expect(() => validateArgumentStyle('date', '::qqqq')).toThrow("Invalid date skeleton '::qqqq'");
  });

  // `qqqq` is valid ICU, a stand-alone quarter, that `Intl` cannot show. A
  // skeleton naming it alongside fields that do resolve is still rejected, so
  // this agrees with the runtime rather than letting a field be dropped
  it('rejects a skeleton that only partly resolves', () => {
    expect(() => validateArgumentStyle('date', '::yMMMdqqqq')).toThrow(
      "Invalid date skeleton '::yMMMdqqqq'",
    );
    expect(() => validateArgumentStyle('date', "::yMMMd'x'")).toThrow('Invalid date skeleton');
  });

  // The named styles are a closed list, so the error names the skeleton escape
  // too, otherwise an author reading it would think the list was all there is
  it('names the skeleton escape for every type', () => {
    expect(() => validateArgumentStyle('date', 'nope')).toThrow('a skeleton such as ::yyyyMMdd');
    expect(() => validateArgumentStyle('number', 'nope')).toThrow(
      'a skeleton such as ::currency/EUR',
    );
  });

  it('names the literal pattern escape only for numbers', () => {
    expect(() => validateArgumentStyle('number', '#{}')).toThrow('literal number pattern');
    expect(() => validateArgumentStyle('date', 'nope')).not.toThrow('literal number pattern');
  });
});
