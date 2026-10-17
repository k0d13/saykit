import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileMessage, type Message } from './message.js';
import { createView } from './index.js';

/**
 * The evaluator, node by node. What the CLI emits for a given ICU message is
 * its own business and has its own tests; this is only about what each node
 * means once it is here.
 */
const format = (message: Message, values: Record<string, unknown> = {}, locale = 'en-US') =>
  compileMessage(message, locale, { bidiIsolation: 'none' })(values);

// The isolation marks, as code points, since the characters are invisible
const FSI = String.fromCharCode(0x2068);
const RLI = String.fromCharCode(0x2067);
const PDI = String.fromCharCode(0x2069);

const items: Message = [
  'p',
  ['v', '_n'],
  { one: ['c', ['#'], ' item'], other: ['c', ['#'], ' items'] },
];

describe('compileMessage', () => {
  it('formats a message with no placeholders as itself', () => {
    expect(format('Hello')).toBe('Hello');
  });

  it('joins the parts of a concatenation', () => {
    expect(format(['c', 'Hello, ', ['v', '_name'], '!'], { _name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('writes nothing for a value that is not there', () => {
    expect(format(['c', 'Hello, ', ['v', '_name']])).toBe('Hello, ');
    expect(format(['c', 'n=', ['n', ['v', '_n']]])).toBe('n=');
    expect(format(['c', 'd=', ['d', ['v', '_d']]])).toBe('d=');
  });

  it('formats a number the way the locale writes one', () => {
    expect(format(['n', ['v', '_n']], { _n: 1234.5 })).toBe('1,234.5');
    // French groups with a space and marks the decimal with a comma
    expect(format(['n', ['v', '_n']], { _n: 1234.5 }, 'fr')).toMatch(/^1.234,5$/u);
  });

  it('hands the formatter the options it was compiled with', () => {
    expect(format(['n', ['v', '_n'], { style: 'percent' }], { _n: 0.25 })).toBe('25%');
  });

  it('scales a number by a multiplier, keeping a bigint whole', () => {
    expect(format(['n', ['v', '_n'], {}, 100], { _n: 1.5 })).toBe('150');
    expect(format(['n', ['v', '_n'], {}, 100], { _n: 5n })).toBe('500');
  });

  it('reads a number written as a string or a wrapper', () => {
    expect(format(['n', ['v', '_n']], { _n: '1234.5' })).toBe('1,234.5');
    expect(format(['n', ['v', '_n']], { _n: { valueOf: () => 42 } })).toBe('42');
  });

  it('formats a date from a Date, an epoch offset or a string', () => {
    const when = new Date(2020, 0, 2, 12, 4, 5);
    const message: Message = ['d', ['v', '_d'], { dateStyle: 'long' }];
    expect(format(message, { _d: when })).toBe('January 2, 2020');
    expect(format(message, { _d: when.getTime() })).toBe('January 2, 2020');
    expect(format(message, { _d: '2020-01-02T12:00:00' })).toBe('January 2, 2020');
  });

  it('selects a plural category, and writes its number as #', () => {
    expect(format(items, { _n: 1 })).toBe('1 item');
    expect(format(items, { _n: 1234 })).toBe('1,234 items');
  });

  it('selects an ordinal category', () => {
    const message: Message = [
      'p',
      ['v', '_n'],
      {
        one: ['c', ['#'], 'st'],
        two: ['c', ['#'], 'nd'],
        few: ['c', ['#'], 'rd'],
        other: ['c', ['#'], 'th'],
      },
      0,
      1,
    ];
    expect(format(message, { _n: 1 })).toBe('1st');
    expect(format(message, { _n: 22 })).toBe('22nd');
    expect(format(message, { _n: 13 })).toBe('13th');
  });

  it('matches an exact case before the offset, and a category after it', () => {
    const message: Message = [
      'p',
      ['v', '_n'],
      {
        '=1': 'just you',
        one: ['c', 'you and ', ['#'], ' other'],
        other: ['c', 'you and ', ['#'], ' others'],
      },
      1,
    ];
    expect(format(message, { _n: 1 })).toBe('just you');
    expect(format(message, { _n: 2 })).toBe('you and 1 other');
    expect(format(message, { _n: 3 })).toBe('you and 2 others');
    expect(format(message, { _n: 3n })).toBe('you and 2 others');
  });

  it('matches an exact case whatever the count is written as', () => {
    const message: Message = ['p', ['v', '_n'], { '=1': 'one!', other: 'more' }];
    expect(format(message, { _n: 1 })).toBe('one!');
    expect(format(message, { _n: 1n })).toBe('one!');
    expect(format(message, { _n: '1' })).toBe('one!');
  });

  it('matches a select case against the value as text', () => {
    const message: Message = ['s', ['v', '_tier'], { 0: 'Free', other: 'Paid' }];
    expect(format(message, { _tier: 0 })).toBe('Free');
    expect(format(message, { _tier: '0' })).toBe('Free');
    expect(format(message, { _tier: 1 })).toBe('Paid');
  });

  it('falls back to other, or to nothing, for a value no case names', () => {
    expect(format(['s', ['v', '_k'], { a: 'A' }], { _k: 'b' })).toBe('');
    expect(format(['s', ['v', '_k'], { a: 'A', other: 'O' }])).toBe('O');
    // A plural with no number to select on takes `other`, with nothing for `#`
    expect(format(items)).toBe(' items');
    // A key every object inherits is not a case
    expect(format(['s', ['v', '_k'], { other: 'O' }], { _k: 'constructor' })).toBe('O');
  });

  it('writes a # in a select as the number of the plural around it', () => {
    const message: Message = [
      'p',
      ['v', '_n'],
      { other: ['s', ['v', '_g'], { other: ['c', ['#'], ' x'] }] },
      1,
    ];
    expect(format(message, { _n: 3, _g: 'a' })).toBe('2 x');
  });
});

describe('formatting errors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes a value it cannot format as given, and warns, rather than throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(format(['c', 'On ', ['d', ['v', '_d']]], { _d: 'someday' })).toBe('On someday');
    expect(format(['c', 'x', ['n', ['v', '_n']]], { _n: 'lots' })).toBe('xlots');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('writes values as given when its options cannot build a formatter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const message: Message = ['n', ['v', '_n'], { style: 'currency', currency: 'NOT-A-CODE' }];
    expect(format(message, { _n: 5 })).toBe('5');
    expect(warn).toHaveBeenCalled();
  });
});

describe('bidi isolation', () => {
  const isolated = (message: Message, values: Record<string, unknown>, locale = 'en-US') =>
    compileMessage(message, locale)(values);

  it('isolates a written value by its first strong character', () => {
    expect(isolated(['c', 'Hi ', ['v', '_name']], { _name: 'Ada' })).toBe(`Hi ${FSI}Ada${PDI}`);
  });

  it('leaves a number or a date alone in a left-to-right locale', () => {
    expect(isolated(items, { _n: 5 })).toBe('5 items');
    expect(isolated(['n', ['v', '_n']], { _n: 5 })).toBe('5');
  });

  it('isolates a number right to left in a right-to-left locale', () => {
    const written = isolated(['n', ['v', '_n']], { _n: 5 }, 'ar');
    expect(written.startsWith(RLI) && written.endsWith(PDI)).toBe(true);
  });

  it('isolates only what is written, never what is selected on', () => {
    const message: Message = [
      'p',
      ['v', '_n'],
      { one: ['c', ['v', '_who'], ' has one'], other: 'many' },
    ];
    expect(isolated(message, { _n: 1, _who: 'Ada' })).toBe(`${FSI}Ada${PDI} has one`);
    expect(isolated(['s', ['v', '_k'], { a: 'A', other: 'B' }], { _k: 'a' })).toBe('A');
  });
});

describe('a view over compiled messages', () => {
  it('calls a message as many times as asked', () => {
    const say = createView(
      'en',
      { greeting: ['c', 'Hello, ', ['v', '_name']] },
      { bidiIsolation: 'none' },
    );

    expect(say.call({ id: 'greeting', _name: 'Ada' })).toBe('Hello, Ada');
    expect(say.call({ id: 'greeting', _name: 'Grace' })).toBe('Hello, Grace');
  });

  it('keeps its messages as the data they were given as', () => {
    const say = createView('en', { greeting: 'Hello' });
    expect(say.messages.greeting).toBe('Hello');
    // Serialisable, which is the whole point of compiling to data
    expect(JSON.parse(JSON.stringify(say.messages))).toEqual({ greeting: 'Hello' });
  });
});
