import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createCatalogue, createView, type Message, type View } from './index.js';

type Locale = 'en' | 'fr';

/**
 * Messages in the shape the CLI compiles them into: one node per id, reading
 * each value from behind the underscore the transform writes it with.
 *
 * What those nodes are compiled from is the CLI's business, and how they are
 * evaluated is `compileMessage`'s, each covered by its own tests.
 */
const messages = {
  en: {
    greeting: 'Hello',
    items: ['p', ['v', '_count'], { one: ['c', ['#'], ' item'], other: ['c', ['#'], ' items'] }],
    named: ['c', 'Hello, ', ['v', '_name']],
    identified: ['c', 'Order ', ['v', '_id']],
    underscored: ['c', 'Total ', ['v', '__total']],
  },
  fr: {
    greeting: 'Bonjour',
    items: [
      'p',
      ['v', '_count'],
      { one: ['c', ['#'], ' article'], other: ['c', ['#'], ' articles'] },
    ],
  },
} satisfies Record<Locale, View.Messages>;

function make() {
  // Without isolation marks, so an assertion reads as the sentence a user sees
  return createCatalogue(messages, { bidiIsolation: 'none' });
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
    expect(make().locale('fr').call({ id: 'greeting' })).toBe('Bonjour');
  });

  it('formats a message with placeholders', () => {
    expect(say.call({ id: 'items', _count: 1 })).toBe('1 item');
    expect(say.call({ id: 'items', _count: 5 })).toBe('5 items');
  });

  it('names the locale when the message id is not found', () => {
    expect(() => say.call({ id: 'missing' })).toThrow("No message for missing in locale 'en'");
  });

  it('formats a message carried in place of an id', () => {
    expect(say.call({ message: ['n', ['v', '_n']], _n: 1234.5 })).toBe('1,234.5');
  });

  it('hands the descriptor over whole, values still behind their underscore', () => {
    expect(say.call({ id: 'named', _name: 'Ada' })).toBe('Hello, Ada');
    expect(say.call({ id: 'underscored', __total: '9' })).toBe('Total 9');
  });

  it('formats a value named after the descriptor id', () => {
    // The lookup uses the id; `{id}` in the message is filled from `_id`
    expect(say.call({ id: 'identified', _id: '42' })).toBe('Order 42');
  });

  it('does not expose the message id as a value', () => {
    expect(say.call({ id: 'identified' })).not.toContain('identified');
  });
});

describe('bidi isolation', () => {
  const mention: Message = ['c', ['v', '_channel'], ' has a ', ['v', '_multiplier'], ' multiplier'];
  const channel = { id: 'mention', message: mention };

  it('isolates substituted values by default', () => {
    const say = createView('en', {});
    expect(say.call({ ...channel, _channel: '<#123>', _multiplier: '2x' })).toBe(
      '⁨<#123>⁩ has a ⁨2x⁩ multiplier',
    );
  });

  it('reports no options when a view is built with none', () => {
    expect(createView('en', {}).options).toEqual({});
  });

  it('leaves values as given when a view is built with none', () => {
    const say = createView('en', {}, { bidiIsolation: 'none' });
    expect(say.options).toEqual({ bidiIsolation: 'none' });
    expect(Object.isFrozen(say.options)).toBe(true);
    expect(say.call({ ...channel, _channel: '<#123>', _multiplier: '2x' })).toBe(
      '<#123> has a 2x multiplier',
    );
  });

  it('is passed by a catalogue to every view it hands back, lazy or not', async () => {
    const catalogue = createCatalogue(
      {
        en: { mention },
        fr: () => ({ mention: ['c', ['v', '_channel'], ' a ', ['v', '_multiplier']] }),
      },
      { bidiIsolation: 'none' },
    );
    expect(catalogue.locale('en').call({ id: 'mention', _channel: '<@&1>', _multiplier: 2 })).toBe(
      '<@&1> has a 2 multiplier',
    );
    const fr = await catalogue.load('fr');
    expect(fr.call({ id: 'mention', _channel: '<#9>', _multiplier: 3 })).toBe('<#9> a 3');
  });
});

describe('View immutability', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(make().locale('en'))).toBe(true);
  });

  it('copies the messages it was given, so the caller cannot change them later', () => {
    const source: View.Messages = { greeting: 'Hello' };
    const say = createView('en', source);
    source.greeting = 'Goodbye';
    expect(say.call({ id: 'greeting' })).toBe('Hello');
  });

  it('freezes its messages', () => {
    expect(Object.isFrozen(createView('en', { greeting: 'Hello' }).messages)).toBe(true);
  });

  it('copies the trees inside its messages too', () => {
    const source: View.Messages = { greeting: ['c', 'Hello, ', ['v', '_name']] };
    const say = createView('en', source, { bidiIsolation: 'none' });
    (source.greeting as unknown[])[1] = 'Goodbye, ';
    expect(say.call({ id: 'greeting', _name: 'Ada' })).toBe('Hello, Ada');
    expect(Object.isFrozen(say.messages.greeting)).toBe(true);
  });

  it('finds no message on the prototype', () => {
    expect(() => createView('en', {}).call({ id: 'constructor' })).toThrow(/No message/);
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
