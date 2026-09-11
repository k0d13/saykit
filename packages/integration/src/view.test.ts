import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createCatalogue, createView, type View } from './index.js';

type Locale = 'en' | 'fr';

const messages = {
  en: {
    greeting: 'Hello',
    items: '{count, plural, one {# item} other {# items}}',
    named: 'Hello, {name}',
    identified: 'Order {id}',
    underscored: 'Total {_total}',
  },
  fr: { greeting: 'Bonjour', items: '{count, plural, one {# article} other {# articles}}' },
} satisfies Record<Locale, View.Messages>;

/**
 * Drop the bidi isolation marks the formatter wraps substituted values in, so
 * an assertion can read as the sentence a user sees.
 */
function plain(formatted: string) {
  return formatted.replaceAll(/[⁨⁩]/g, '');
}

function make() {
  return createCatalogue(messages);
}

describe('createView', () => {
  it('builds a view over a bare record of messages, with no catalogue', () => {
    const say = createView('en', messages.en);
    expect(say.locale).toBe('en');
    expect(say.call({ id: 'greeting' })).toBe('Hello');
  });

  it('is what a catalogue memoises, so a direct view is a second value', () => {
    // Same messages, same locale, but built outside the catalogue: views are
    // memoised per catalogue rather than interned globally
    expect(createView('en', messages.en)).not.toBe(make().locale('en'));
  });
});

describe('View#call', () => {
  const say = make().locale('en');

  it('formats a message for the locale the view is bound to', () => {
    expect(say.call({ id: 'greeting' })).toBe('Hello');
  });

  it('formats a message with placeholders', () => {
    expect(say.call({ id: 'items', count: 1 })).toBe('1 item');
    expect(say.call({ id: 'items', count: 5 })).toBe('5 items');
  });

  it('caches the compiled format across calls', () => {
    const fr = make().locale('fr');
    expect(fr.call({ id: 'items', count: 1 })).toBe('1 article');
    // Second call hits the cached format
    expect(fr.call({ id: 'items', count: 2 })).toBe('2 articles');
  });

  it('formats a message carried in place of an id', () => {
    expect(say.call({ message: '{n, number}', _n: 1234.5 })).toBe('1,234.5');
  });

  it('throws when the message id is not found', () => {
    expect(() => say.call({ id: 'missing' })).toThrow('Message for missing is not a string');
  });

  it('strips the underscore the transform compiles values behind', () => {
    expect(plain(say.call({ id: 'named', _name: 'Ada' }))).toBe('Hello, Ada');
  });

  it('formats keys written without one, so a hand-written call still works', () => {
    expect(plain(say.call({ id: 'named', name: 'Ada' }))).toBe('Hello, Ada');
  });

  it('formats a value named after the descriptor id', () => {
    // The lookup still uses the id; the value only fills `{id}` in the message
    expect(plain(say.call({ id: 'identified', _id: '42' }))).toBe('Order 42');
  });

  it('does not expose the message id as a value', () => {
    // `{id}` is left unresolved rather than filled with the message's own id
    expect(plain(say.call({ id: 'identified' }))).not.toContain('identified');
  });

  it('strips exactly one underscore, so a name that starts with one survives', () => {
    expect(plain(say.call({ id: 'underscored', __total: '9' }))).toBe('Total 9');
  });

  it('treats a value named `__proto__` as a value, not as a prototype', () => {
    // Assigning the stripped key would write through to `Object.prototype`
    // rather than naming a placeholder, so the values are built from own
    // entries instead
    const descriptor = { id: 'named', _name: 'Ada' };
    Object.defineProperty(descriptor, '___proto__', {
      value: { polluted: true },
      enumerable: true,
    });
    expect(plain(say.call(descriptor))).toBe('Hello, Ada');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('ignores keys a descriptor only inherits', () => {
    const descriptor = Object.assign(Object.create({ _name: 'Ghost' }), { id: 'named' });
    expect(plain(say.call(descriptor))).not.toContain('Ghost');
  });
});

describe('View immutability', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(make().locale('en'))).toBe(true);
  });

  it('copies the messages it was given, so the caller cannot change them later', () => {
    const source = { greeting: 'Hello' };
    const say = createView('en', source);
    source.greeting = 'Goodbye';
    expect(say.messages).toEqual({ greeting: 'Hello' });
    expect(say.call({ id: 'greeting' })).toBe('Hello');
  });

  it('freezes its messages, so a compiled format cannot go stale', () => {
    const say = createView('en', { greeting: 'Hello' });
    expect(Object.isFrozen(say.messages)).toBe(true);
  });
});

describe('View inspect', () => {
  it('names the locale it is bound to', () => {
    expect(inspect(make().locale('en'))).toBe("View<'en'> {}");
  });
});

describe('View macros', () => {
  const say = make().locale('en');

  it('throws when the message macro itself survives to runtime', () => {
    expect(() => (say as unknown as (s: TemplateStringsArray) => string)`Hello`).toThrow(
      "'say' is a macro and must be used with the relevant saykit plugin",
    );
  });

  it.each([
    ['plural', () => say.plural(1, { other: '#' })],
    ['ordinal', () => say.ordinal(1, { other: '#' })],
    ['select', () => say.select('a', { other: 'b' })],
    ['number', () => say.number(1)],
    ['date', () => say.date(new Date())],
    ['time', () => say.time(new Date())],
  ])('throws for %s', (name, call) => {
    expect(call).toThrow(
      `'say.${name}' is a macro and must be used with the relevant saykit plugin`,
    );
  });
});

// The macros exist to author these strings, so what matters is that the ICU
// they extract to is ICU the runtime formatter actually honours. Every style
// the parser accepts is exercised here, against the formatter we ship
describe('formatted arguments', () => {
  // Built in local time, at midday, so the calendar date is the same one in
  // every timezone the suite might run in
  const when = new Date(2020, 0, 2, 12, 4, 5);

  function format(message: string, values: Record<string, unknown>) {
    return createCatalogue({ 'en-US': { m: message } })
      .locale('en-US')
      .call({ id: 'm', ...values });
  }

  it.each([
    ['{n, number}', { n: 1234.5 }, '1,234.5'],
    ['{n, number, integer}', { n: 1234.5 }, '1,235'],
    ['{n, number, percent}', { n: 0.25 }, '25%'],
    ['{n, number, #,##0.00}', { n: 1234.5 }, '1,234.50'],
  ])('formats %s', (message, values, expected) => {
    expect(format(message, values)).toBe(expected);
  });

  // Skeletons are why the MF1 conversion is ours rather than the upstream
  // package's: it renders a style into MF2's option vocabulary, which has no
  // word for a currency on a number or for any of these fields on a date
  it.each([
    ['{n, number, ::.00}', { n: 1234.5 }, '1,234.50'],
    ['{n, number, ::group-off}', { n: 1234.5 }, '1234.5'],
    ['{n, number, ::compact-short}', { n: 12345 }, '12K'],
    ['{n, number, ::scale/1000}', { n: 1.5 }, '1,500'],
    // A skeleton's `percent` only writes the sign. The named MF1 style scales
    // as well, which is `percent scale/100` spelled out
    ['{n, number, ::percent}', { n: 25 }, '25%'],
    ['{n, number, ::percent scale/100}', { n: 0.25 }, '25%'],
  ])('formats the number skeleton %s', (message, values, expected) => {
    expect(format(message, values)).toBe(expected);
  });

  // MF1 has nowhere to write a currency code, so `{n, number, currency}` cannot
  // name one and falls back to a plain number. A skeleton carries the code
  it('formats a currency, which only a skeleton can ask for', () => {
    expect(format('{n, number, ::currency/EUR}', { n: 1234.5 })).toBe('€1,234.50');
    expect(format('{n, number, currency}', { n: 1234.5 })).toBe('1,234.5');
  });

  it.each([
    ['{d, date, ::yyyyMMdd}', '01/02/2020'],
    ['{d, date, ::yMMMM}', 'January 2020'],
    ['{d, date, ::MMMd}', 'Jan 2'],
    ['{d, date, ::EEEE}', 'Thursday'],
    ['{d, time, ::Hm}', '12:04'],
  ])('formats the date skeleton %s', (message, expected) => {
    expect(format(message, { d: when })).toBe(expected);
  });

  // A style is authored once and read by everyone. A message that renders in a
  // slightly wrong shape is recoverable; one that renders `{$d}` is not
  it.each([
    ['{d, date, bogus}', 'Jan 2, 2020'],
    ['{d, date, ::qqqq}', 'Jan 2, 2020'],
  ])('falls back to the default format for %s', (message, expected) => {
    expect(format(message, { d: when })).toBe(expected);
  });

  it('falls back to a plain number for an unreadable number style', () => {
    expect(format('{n, number, ::bogus}', { n: 1234.5 })).toBe('1,234.5');
  });

  // No macro authors a `duration`, so this only ever arrives from a catalogue
  // written by hand. `Intl` has no clock-reading format, so we write it out
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [61, '1:01'],
    [3661, '1:01:01'],
    [-61, '-1:01'],
    [1.5, '0:01.500'],
  ])('formats {n, duration} of %d', (n, expected) => {
    expect(plain(format('{n, duration}', { n }))).toBe(expected);
  });

  // An argument type with no formatter still writes its value, rather than
  // taking the rest of the message down with it
  it('falls back to the plain value for an unknown argument type', () => {
    expect(plain(format('{n, spellout}', { n: 42 }))).toBe('42');
  });

  it.each([
    ['{d, date}', 'Jan 2, 2020'],
    ['{d, date, short}', '1/2/2020'],
    ['{d, date, medium}', 'Jan 2, 2020'],
    ['{d, date, long}', 'January 2, 2020'],
    ['{d, date, full}', 'Thursday, January 2, 2020'],
  ])('formats %s', (message, expected) => {
    expect(format(message, { d: when })).toBe(expected);
  });

  it.each(['{d, time}', '{d, time, short}', '{d, time, medium}', '{d, time, long}'])(
    'formats %s',
    (message) => {
      expect(format(message, { d: when })).toMatch(/\d{1,2}:\d{2}/);
    },
  );

  // ICU `select` has no exact-value syntax: `=0` there is a parse error, while
  // a bare `0` matches the number and the string alike
  it.each([
    [0, 'Free'],
    ['0', 'Free'],
    [1, 'Pro'],
    ['enterprise', 'Custom'],
  ])('selects the bare numeric case for %o', (tier, expected) => {
    const message = '{tier, select, 0 {Free} 1 {Pro} other {Custom}}';
    expect(format(message, { tier })).toBe(expected);
  });

  it('applies a plural offset', () => {
    const message = '{n, plural, offset:1 one {you and # other} other {you and # others}}';
    expect(format(message, { n: 3 })).toBe('you and 2 others');
    expect(format(message, { n: 2 })).toBe('you and 1 other');
  });

  // ICU tests an exact value against the *original* number, before the offset
  // is applied; the offset only reaches the CLDR category and `#`. So in the
  // "you and N others" idiom, where the selector counts everyone including you,
  // the branch meaning "nobody else" is `=1`, not `=0`
  it('matches an exact branch before applying the offset', () => {
    const correct = '{n, plural, offset:1 =1 {nobody else} other {you and # others}}';
    expect(format(correct, { n: 1 })).toBe('nobody else');
    expect(format(correct, { n: 3 })).toBe('you and 2 others');

    const wrong = '{n, plural, offset:1 =0 {nobody else} other {you and # others}}';
    expect(format(wrong, { n: 1 })).toBe('you and 0 others');
  });
});
