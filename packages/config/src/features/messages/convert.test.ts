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

  it('should generate element messages', () => {
    const message = new ElementMessage('0', [new LiteralMessage('Hello world!')], dummy);
    expect(convertMessageToIcu(message)) //
      .toMatchInlineSnapshot('"<0>Hello world!</0>"');
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
});
