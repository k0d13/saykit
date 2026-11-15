import { describe, expect, it } from 'vitest';
import { convertMessageToIcu } from './convert.js';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
} from './types.js';

const dummy = undefined as any;

describe('convertMessageToIcu', () => {
  it('should generate literal messages', () => {
    const message = new LiteralMessage('Hello');
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"Hello"');
  });

  it('should generate argument messages', () => {
    const message = new ArgumentMessage('name', dummy);
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"{name}"');
  });

  it('should generate argument messages with a format type', () => {
    const message = new ArgumentMessage('count', dummy, { type: 'number' });
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"{count, number}"');
  });

  it('should generate argument messages with a format type and style', () => {
    const message = new ArgumentMessage('when', dummy, { type: 'date', style: 'medium' });
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"{when, date, medium}"');
  });

  it('should omit an empty style rather than emit a trailing comma', () => {
    const message = new ArgumentMessage('n', dummy, { type: 'number', style: undefined });
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"{n, number}"');
  });

  it('should generate element messages', () => {
    const message = new ElementMessage('0', [new LiteralMessage('Hello world!')], dummy);
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"<0>Hello world!</0>"');
  });

  it('should generate childless element messages as self-closing', () => {
    const message = new ElementMessage('icon', [], dummy);
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"<icon/>"');
  });

  it('should keep element messages paired when a child renders to nothing', () => {
    const message = new ElementMessage(
      'bold',
      [new CompositeMessage({}, [], [], [], dummy)],
      dummy,
    );
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"<bold></bold>"');
  });

  it('should generate choice messages with numeric identifiers as `=n`', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [
        { identifier: '0', value: new LiteralMessage('none') },
        { identifier: 'one', value: new LiteralMessage('one') },
        { identifier: 'other', value: new LiteralMessage('many') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{count, plural,
        =0 {none}
        one {one}
        other {many}
      }"
    `);
  });

  it('should generate choice messages with an offset', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [
        {
          identifier: 'one',
          value: new CompositeMessage(
            {},
            [],
            [],
            [
              new LiteralMessage('you and '),
              new ArgumentMessage('count', dummy),
              new LiteralMessage(' other'),
            ],
            dummy,
          ),
        },
        {
          identifier: 'other',
          value: new CompositeMessage(
            {},
            [],
            [],
            [
              new LiteralMessage('you and '),
              new ArgumentMessage('count', dummy),
              new LiteralMessage(' others'),
            ],
            dummy,
          ),
        },
      ],
      dummy,
      1,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{count, plural, offset:1
        one {you and # other}
        other {you and # others}
      }"
    `);
  });

  it('should generate an offset of zero rather than treat it as absent', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [{ identifier: 'other', value: new ArgumentMessage('count', dummy) }],
      dummy,
      0,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{count, plural, offset:0
        other {#}
      }"
    `);
  });

  it('should escape a brace an author wrote as text', () => {
    const message = new LiteralMessage("save as {name}, it's fine");
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot(`"save as '{'name'}', it''s fine"`);
  });

  // `#` is the plural's own selector spelled the way ICU spells it, so the two
  // are one placeholder and one prop rather than a number written twice
  it('should write a plural selector inside its own branch as a hash', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [{ identifier: 'other', value: new ArgumentMessage('count', dummy) }],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{count, plural,
        other {#}
      }"
    `);
  });

  it('should leave another argument in a plural branch named', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [{ identifier: 'other', value: new ArgumentMessage('total', dummy) }],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{count, plural,
        other {{total}}
      }"
    `);
  });

  // A formatted argument is not interchangeable with `#`, which formats itself
  // the way the plural does
  it('should leave a formatted selector named', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [
        {
          identifier: 'other',
          value: new ArgumentMessage('count', dummy, { type: 'number', style: 'percent' }),
        },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toContain('{count, number, percent}');
  });

  it('should escape a hash inside a plural branch but not outside one', () => {
    const message = new CompositeMessage(
      {},
      [],
      [],
      [
        new LiteralMessage('issue #1: '),
        new ChoiceMessage(
          'plural',
          'count',
          [{ identifier: 'other', value: new LiteralMessage('#1 of many') }],
          dummy,
        ),
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "issue #1: {count, plural,
        other {'#'1 of many}
      }"
    `);
  });

  // `#` reaches through a nested select to the plural enclosing it, so text in
  // there still needs quoting
  it('should keep a hash live inside a select nested in a plural', () => {
    const message = new ChoiceMessage(
      'plural',
      'count',
      [
        {
          identifier: 'other',
          value: new ChoiceMessage(
            'select',
            'kind',
            [{ identifier: 'other', value: new LiteralMessage('#') }],
            dummy,
          ),
        },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toContain("other {'#'}");
  });

  // `select` matches literal strings and has no number to offset, so emitting
  // one would be invalid ICU rather than a harmless no-op
  it('should drop an offset on a select', () => {
    const message = new ChoiceMessage(
      'select',
      'kind',
      [{ identifier: 'other', value: new LiteralMessage('x') }],
      dummy,
      1,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{kind, select,
        other {x}
      }"
    `);
  });

  it('should generate choice messages with ordinal kind', () => {
    const message = new ChoiceMessage(
      'ordinal',
      'place',
      [
        { identifier: '1', value: new LiteralMessage('first') },
        { identifier: '2', value: new LiteralMessage('second') },
        { identifier: '3', value: new LiteralMessage('third') },
        { identifier: 'other', value: new LiteralMessage('other') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{place, selectordinal,
        =1 {first}
        =2 {second}
        =3 {third}
        other {other}
      }"
    `);
  });

  // A numeric key stays bare under `select`, which matches its cases as literal
  // strings, `=0` there is a parse error, not an exact value
  it('should generate select messages with numeric identifiers bare', () => {
    const message = new ChoiceMessage(
      'select',
      'tier',
      [
        { identifier: '0', value: new LiteralMessage('Free') },
        { identifier: '1', value: new LiteralMessage('Pro') },
        { identifier: 'other', value: new LiteralMessage('Unknown') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{tier, select,
        0 {Free}
        1 {Pro}
        other {Unknown}
      }"
    `);
  });

  it('should generate choice messages with select kind', () => {
    const message = new ChoiceMessage(
      'select',
      'gender',
      [
        { identifier: 'male', value: new LiteralMessage('He') },
        { identifier: 'female', value: new LiteralMessage('She') },
        { identifier: 'other', value: new LiteralMessage('They') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)).toMatchInlineSnapshot(`
      "{gender, select,
        male {He}
        female {She}
        other {They}
      }"
    `);
  });

  it('should generate composite messages', () => {
    const message = new CompositeMessage(
      {},
      [],
      [],
      [new LiteralMessage('Hello, '), new ArgumentMessage('name', dummy), new LiteralMessage('!')],
      dummy,
    );
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"Hello, {name}!"');
  });

  it('should normalise jsx related whitespace', () => {
    const message = new CompositeMessage(
      {},
      [],
      [],
      [
        new LiteralMessage('\n  Hello, '),
        new ArgumentMessage('name', dummy),
        new LiteralMessage('!\n'),
      ],
      dummy,
    );
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"Hello, {name}!"');
  });

  it('throws for an unknown message type', () => {
    expect(() => convertMessageToIcu({} as never)).toThrow('Unknown message type');
  });
});
