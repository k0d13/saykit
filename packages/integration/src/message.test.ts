import { describe, expect, it } from 'vitest';
import { compileMessage, type Message } from './message.js';
import { createView } from './index.js';

/**
 * The evaluator, node by node. What the CLI emits for a given ICU message is
 * its own business and has its own tests; this is only about what each node
 * means once it is here.
 */
const format = (message: Message, values: Record<string, unknown> = {}, locale = 'en-US') =>
  compileMessage(message, locale, { bidiIsolation: 'none' })(values);

describe('compileMessage', () => {
  it('formats a message with no placeholders as itself', () => {
    expect(format('Hello')).toBe('Hello');
  });

  it('joins the parts of a concatenation', () => {
    expect(format(['c', 'Hello, ', ['v', '_name'], '!'], { _name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('writes nothing for a value that is not there', () => {
    expect(format(['c', 'Hello, ', ['v', '_name']])).toBe('Hello, ');
  });

  it('takes the branch its test chooses', () => {
    const message: Message = ['?', ['=', ['v', '_n'], 1], 'one', 'many'];
    expect(format(message, { _n: 1 })).toBe('one');
    expect(format(message, { _n: 2 })).toBe('many');
  });

  it('formats a number the way the locale writes one', () => {
    expect(format(['f', 'number', ['v', '_n']], { _n: 1234.5 })).toBe('1,234.5');
    // French groups with a space and marks the decimal with a comma
    expect(format(['f', 'number', ['v', '_n']], { _n: 1234.5 }, 'fr')).toMatch(/^1.234,5$/u);
  });

  it('hands a helper the options it was compiled with', () => {
    const message: Message = ['f', 'number', ['v', '_n'], { style: 'percent' }];
    expect(format(message, { _n: 0.25 })).toBe('25%');
  });

  it('formats a date, and a duration with no locale of its own', () => {
    const when = new Date(2020, 0, 2, 12, 4, 5);
    expect(format(['f', 'datetime', ['v', '_d'], { dateStyle: 'long' }], { _d: when })).toBe(
      'January 2, 2020',
    );
    expect(format(['f', 'duration', ['v', '_s']], { _s: 3661 })).toBe('1:01:01');
  });

  it('selects a plural category, applying an offset first', () => {
    const message: Message = ['f', 'plural', ['-', ['v', '_n'], 1]];
    expect(format(message, { _n: 2 })).toBe('one');
    expect(format(message, { _n: 4 })).toBe('other');
  });

  it('scales a number by a multiplier', () => {
    expect(format(['f', 'number', ['*', ['v', '_n'], 100]], { _n: 1.5 })).toBe('150');
  });

  it('matches a select case against the value as text', () => {
    const message: Message = ['?', ['=', ['s', ['v', '_tier']], '0'], 'Free', 'Paid'];
    expect(format(message, { _tier: 0 })).toBe('Free');
    expect(format(message, { _tier: '0' })).toBe('Free');
    expect(format(message, { _tier: 1 })).toBe('Paid');
  });
});

describe('bidi isolation', () => {
  const isolated = (message: Message, values: Record<string, unknown>, locale = 'en-US') =>
    compileMessage(message, locale)(values);

  it('isolates a written value by its first strong character', () => {
    expect(isolated(['c', 'Hi ', ['v', '_name']], { _name: 'Ada' })).toBe('Hi \u2068Ada\u2069');
    expect(isolated(['f', 'duration', ['v', '_s']], { _s: 61 })).toBe('\u20681:01\u2069');
  });

  it('leaves a number or a date alone in a left-to-right locale', () => {
    expect(isolated(['c', ['f', 'number', ['v', '_n']], ' items'], { _n: 5 })).toBe('5 items');
  });

  it('isolates a number right to left in a right-to-left locale', () => {
    expect(isolated(['f', 'number', ['v', '_n']], { _n: 5 }, 'ar')).toMatch(/^\u2067.+\u2069$/u);
  });

  it('isolates only what is written, never what is compared or selected on', () => {
    const message: Message = [
      '?',
      ['=', ['f', 'plural', ['v', '_n']], 'one'],
      ['c', ['v', '_who'], ' has one'],
      'many',
    ];
    expect(isolated(message, { _n: 1, _who: 'Ada' })).toBe('\u2068Ada\u2069 has one');
    expect(isolated(['?', ['=', ['s', ['v', '_k']], 'a'], 'A', 'B'], { _k: 'a' })).toBe('A');
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
