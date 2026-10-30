import { compileMessage as bind, Kind } from 'saykit';
import { describe, expect, it } from 'vitest';
import { compileMessage } from './compile.js';

/**
 * The compiled message is checked two ways: a snapshot, so a change to what is
 * emitted is visible in review, and a call, so a snapshot cannot be right about
 * a tree that is wrong about output.
 *
 * The call goes through the real runtime rather than a mirror of it, since what
 * matters is that the pair agree: this package decides the shape, and `saykit`
 * is the only thing that reads it.
 *
 * Every style the extractor accepts is exercised here. A style is authored once
 * and read by everyone, so this is the table that says what an author gets.
 */
function format(icu: string, values: Record<string, unknown> = {}, locale = 'en-US') {
  return bind(compileMessage(icu), locale, { bidiIsolation: 'none' })(values);
}

describe('compileMessage', () => {
  it('compiles a message with no placeholders to the string itself', () => {
    expect(compileMessage('Hello!')).toBe('Hello!');
  });

  it('reads a placeholder from behind its underscore', () => {
    expect(compileMessage('Hello, {name}')).toMatchInlineSnapshot(`
      [
        "Hello, ",
        [
          0,
          "_name",
        ],
      ]
    `);
    expect(format('Hello, {name}', { _name: 'Ada' })).toBe('Hello, Ada');
  });

  it('reads a numbered placeholder', () => {
    expect(format('Hello, {0}', { _0: 'Ada' })).toBe('Hello, Ada');
  });

  it('reads a placeholder whose name already starts with an underscore', () => {
    expect(format('Total {_total}', { __total: '9' })).toBe('Total 9');
  });

  it('does not treat the descriptor id as a value', () => {
    // `{id}` is filled from the descriptor's `_id`, never from the id that
    // chose the message
    expect(format('Order {id}', { id: 'identified', _id: '42' })).toBe('Order 42');
  });

  it('keeps literal text literal, with nothing to escape it for', () => {
    // `'{'` is ICU's way of writing a brace that opens nothing. Text is data
    // here rather than source, so none of this is escaped on the way through
    const icu = "A `backtick`, a $'{'hole} and a \\ slash";
    expect(compileMessage(icu)).toBe('A `backtick`, a ${hole} and a \\ slash');
    expect(format(icu)).toBe('A `backtick`, a ${hole} and a \\ slash');
  });

  it('reads a placeholder written straight after a dollar sign', () => {
    expect(format('costs ${amount}', { _amount: 5 })).toBe('costs $5');
  });

  it('leaves markup as the literal text the renderer reads', () => {
    expect(compileMessage('Click <link>here</link>')).toBe('Click <link>here</link>');
  });

  it('rejects a style with a placeholder in it', () => {
    expect(() => compileMessage('{v, number, {x}}')).toThrow();
  });
});

describe('choices', () => {
  it('compiles a plural to a conditional over the categories', () => {
    const icu = '{count, plural, one {# item} other {# items}}';
    expect(compileMessage(icu)).toMatchInlineSnapshot(`
      [
        3,
        "_count",
        {
          "one": [
            [
              6,
            ],
            " item",
          ],
          "other": [
            [
              6,
            ],
            " items",
          ],
        },
      ]
    `);
    expect(format(icu, { _count: 1 })).toBe('1 item');
    expect(format(icu, { _count: 5 })).toBe('5 items');
  });

  it('matches an exact case before a category, however the message writes them', () => {
    const icu = '{count, plural, one {# item} =0 {nothing} other {# items}}';
    expect(JSON.stringify(compileMessage(icu))).toMatchInlineSnapshot(
      `"[3,"_count",{"one":[[6]," item"],"=0":"nothing","other":[[6]," items"]}]"`,
    );
    expect(format(icu, { _count: 0 })).toBe('nothing');
    expect(format(icu, { _count: 1 })).toBe('1 item');
  });

  it('matches an exact case whatever the count is written as', () => {
    const icu = '{count, plural, =1 {just one} other {# items}}';
    expect(format(icu, { _count: 1n })).toBe('just one');
    expect(format(icu, { _count: '1' })).toBe('just one');
  });

  it('applies a plural offset', () => {
    const icu = '{n, plural, offset:1 one {you and # other} other {you and # others}}';
    expect(format(icu, { _n: 3 })).toBe('you and 2 others');
    expect(format(icu, { _n: 2 })).toBe('you and 1 other');
  });

  /**
   * ICU tests an exact value against the *original* number, before the offset
   * is applied; the offset only reaches the CLDR category and `#`. So in the
   * "you and N others" idiom, where the selector counts everyone including you,
   * the branch meaning "nobody else" is `=1`, not `=0`.
   */
  it('matches an exact branch before applying the offset', () => {
    const correct = '{n, plural, offset:1 =1 {nobody else} other {you and # others}}';
    expect(format(correct, { _n: 1 })).toBe('nobody else');
    expect(format(correct, { _n: 3 })).toBe('you and 2 others');

    const wrong = '{n, plural, offset:1 =0 {nobody else} other {you and # others}}';
    expect(format(wrong, { _n: 1 })).toBe('you and 0 others');
  });

  it('compiles an ordinal', () => {
    const icu = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect(compileMessage(icu)).toMatchObject([Kind.Ordinal, '_n', {}]);
    expect(format(icu, { _n: 1 })).toBe('1st');
    expect(format(icu, { _n: 2 })).toBe('2nd');
    expect(format(icu, { _n: 3 })).toBe('3rd');
    expect(format(icu, { _n: 4 })).toBe('4th');
  });

  it('compiles a select', () => {
    const icu = '{g, select, male {He} female {She} other {They}}';
    expect(JSON.stringify(compileMessage(icu))).toMatchInlineSnapshot(
      `"[5,"_g",{"male":"He","female":"She","other":"They"}]"`,
    );
    expect(format(icu, { _g: 'female' })).toBe('She');
    expect(format(icu, { _g: 'other' })).toBe('They');
  });

  // Assigned into `{}`, this key would set the prototype rather than add a case
  it('keeps a select branch named __proto__', () => {
    const icu = '{g, select, __proto__ {A} other {B}}';
    expect(JSON.stringify(compileMessage(icu))).toContain('"__proto__":"A"');
    expect(format(icu, { _g: '__proto__' })).toBe('A');
  });

  /**
   * ICU `select` has no exact-value syntax: `=0` there is a parse error, while
   * a bare `0` matches the number and the string alike.
   */
  it.each([
    [0, 'Free'],
    ['0', 'Free'],
    [1, 'Pro'],
    ['enterprise', 'Custom'],
  ])('selects the bare numeric case for %o', (tier, expected) => {
    expect(format('{tier, select, 0 {Free} 1 {Pro} other {Custom}}', { _tier: tier })).toBe(
      expected,
    );
  });

  it('writes an exact key the one way the runtime looks it up', () => {
    expect(compileMessage('{n, plural, =01 {one} other {#}}')).toMatchObject([
      Kind.Plural,
      '_n',
      { '=1': 'one' },
    ]);
  });

  it('writes nothing when a choice has no other case and none matched', () => {
    expect(format('{g, select, male {He}}', { _g: 'female' })).toBe('');
  });

  it('nests a choice inside a choice, with # reaching through a select', () => {
    const icu =
      '{count, plural, one {{g, select, male {he has #} other {they have #}}} other {# of them}}';
    expect(format(icu, { _count: 1, _g: 'male' })).toBe('he has 1');
    expect(format(icu, { _count: 1, _g: 'x' })).toBe('they have 1');
    expect(format(icu, { _count: 5, _g: 'male' })).toBe('5 of them');
  });
});

describe('numbers', () => {
  it.each([
    ['{n, number}', { _n: 1234.5 }, '1,234.5'],
    ['{n, number, integer}', { _n: 1234.5 }, '1,235'],
    ['{n, number, percent}', { _n: 0.25 }, '25%'],
    ['{n, number, #,##0.00}', { _n: 1234.5 }, '1,234.50'],
  ])('formats %s', (icu, values, expected) => {
    expect(format(icu, values)).toBe(expected);
  });

  it.each([
    ['{n, number, ::.00}', { _n: 1234.5 }, '1,234.50'],
    ['{n, number, ::group-off}', { _n: 1234.5 }, '1234.5'],
    ['{n, number, ::compact-short}', { _n: 12345 }, '12K'],
    ['{n, number, ::scale/1000}', { _n: 1.5 }, '1,500'],
    // A skeleton's `percent` only writes the sign. The named MF1 style scales
    // as well, which is `percent scale/100` spelled out
    ['{n, number, ::percent}', { _n: 25 }, '25%'],
    ['{n, number, ::percent scale/100}', { _n: 0.25 }, '25%'],
  ])('formats the number skeleton %s', (icu, values, expected) => {
    expect(format(icu, values)).toBe(expected);
  });

  // MF1 has nowhere to write a currency code, so `{n, number, currency}` cannot
  // name one and falls back to a plain number. A skeleton carries the code
  it('formats a currency, which only a skeleton can ask for', () => {
    expect(format('{n, number, ::currency/EUR}', { _n: 1234.5 })).toBe('€1,234.50');
    expect(format('{n, number, currency}', { _n: 1234.5 })).toBe('1,234.5');
  });

  it('applies a scale as a multiplier, since Intl has no option for one', () => {
    expect(JSON.stringify(compileMessage('{v, number, ::scale/100}'))).toMatchInlineSnapshot(
      `"[1,"_v",{},100]"`,
    );
  });

  it('falls back to a plain number for an unreadable number style', () => {
    expect(JSON.stringify(compileMessage('{n, number, ::bogus}'))).toMatchInlineSnapshot(
      `"[1,"_n"]"`,
    );
    expect(format('{n, number, ::bogus}', { _n: 1234.5 })).toBe('1,234.5');
  });
});

describe('dates and times', () => {
  // Built in local time, at midday, so the calendar date is the same one in
  // every timezone the suite might run in
  const when = new Date(2020, 0, 2, 12, 4, 5);

  it.each([
    ['{d, date}', 'Jan 2, 2020'],
    ['{d, date, short}', '1/2/2020'],
    ['{d, date, medium}', 'Jan 2, 2020'],
    ['{d, date, long}', 'January 2, 2020'],
    ['{d, date, full}', 'Thursday, January 2, 2020'],
  ])('formats %s', (icu, expected) => {
    expect(format(icu, { _d: when })).toBe(expected);
  });

  it.each(['{d, time}', '{d, time, short}', '{d, time, medium}', '{d, time, long}'])(
    'formats %s',
    (icu) => {
      expect(format(icu, { _d: when })).toMatch(/\d{1,2}:\d{2}/);
    },
  );

  it.each([
    ['{d, date, ::yyyyMMdd}', '01/02/2020'],
    ['{d, date, ::yMMMM}', 'January 2020'],
    ['{d, date, ::MMMd}', 'Jan 2'],
    ['{d, date, ::EEEE}', 'Thursday'],
    ['{d, time, ::Hm}', '12:04'],
  ])('formats the date skeleton %s', (icu, expected) => {
    expect(format(icu, { _d: when })).toBe(expected);
  });

  // A message that renders in a slightly wrong shape is recoverable; one that
  // renders nothing is not
  it.each([
    ['{d, date, bogus}', 'Jan 2, 2020'],
    ['{d, date, ::qqqq}', 'Jan 2, 2020'],
  ])('falls back to the default format for %s', (icu, expected) => {
    expect(format(icu, { _d: when })).toBe(expected);
  });
});

describe('other argument types', () => {
  // An argument type with no formatter still writes its value, rather than
  // taking the rest of the message down with it. No macro authors either of
  // these, so they only ever arrive from a catalogue written by hand
  it('falls back to the plain value for an unknown argument type', () => {
    expect(JSON.stringify(compileMessage('{n, spellout}'))).toMatchInlineSnapshot(`"[0,"_n"]"`);
    expect(format('{n, spellout}', { _n: 42 })).toBe('42');
    expect(format('{s, duration}', { _s: 3661 })).toBe('3661');
  });
});
