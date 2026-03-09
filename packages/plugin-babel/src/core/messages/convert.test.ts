import type { Expression } from '@babel/types';
import { describe, expect, it } from 'vitest';
import { convertMessageToIcu } from './convert.js';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
} from './types.js';

const dummy = undefined as unknown as Expression;

describe('convertMessageToIcu', () => {
  it('should generate literal messages', () => {
    const msg = new LiteralMessage('Hello');
    expect(convertMessageToIcu(msg)) //
      .toMatchInlineSnapshot('"Hello"');
  });

  it('should generate argument messages', () => {
    const msg = new CompositeMessage(
      {},
      [],
      [],
      [new LiteralMessage('Hello'), new LiteralMessage(' world!')],
      dummy,
    );
    expect(convertMessageToIcu(msg)) //
      .toMatchInlineSnapshot('"Hello world!"');
  });

  it('should generate argument messages', () => {
    const msg = new ArgumentMessage('name', undefined as unknown as Expression);
    expect(convertMessageToIcu(msg)) //
      .toMatchInlineSnapshot('"{name}"');
  });

  it('should generate element messages', () => {
    const msg = new ElementMessage('0', [new LiteralMessage('Hello world!')], dummy);
    expect(convertMessageToIcu(msg)) //
      .toMatchInlineSnapshot('"<0>Hello world!</0>"');
  });

  it('should generate choice messages with numeric keys as `=n`', () => {
    const msg = new ChoiceMessage(
      'plural',
      'count',
      [
        { key: '0', value: new LiteralMessage('none') },
        { key: 'one', value: new LiteralMessage('one') },
        { key: 'other', value: new LiteralMessage('many') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(msg)).toMatchInlineSnapshot(`
      "{count, plural,
        =0 {none}
        one {one}
        other {many}
      }"
    `); //
  });

  it('should generate choice messages with ordinal kind', () => {
    const msg = new ChoiceMessage(
      'ordinal',
      'place',
      [
        { key: '1', value: new LiteralMessage('first') },
        { key: '2', value: new LiteralMessage('second') },
        { key: '3', value: new LiteralMessage('third') },
        { key: 'other', value: new LiteralMessage('other') },
      ],
      dummy,
    );
    expect(convertMessageToIcu(msg)).toMatchInlineSnapshot(`
      "{place, selectordinal,
        =1 {first}
        =2 {second}
        =3 {third}
        other {other}
      }"
    `); //
  });

  it('should normalise jsx related whitespace', () => {
    const msg = new CompositeMessage(
      {},
      [],
      [],
      [
        new LiteralMessage('\n  Hello, '),
        new ArgumentMessage('name', undefined as unknown as Expression),
        new LiteralMessage('!\n'),
      ],
      dummy,
    );
    expect(convertMessageToIcu(msg)) //
      .toMatchInlineSnapshot('"Hello, {name}!"');
  });
});
