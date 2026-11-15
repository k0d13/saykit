import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
} from '@saykit/config/messages';
import { describe, expect, it } from 'vitest';
import { generateSayJSXElement } from './generator.js';

function attrNames(el: t.JSXElement) {
  return el.openingElement.attributes.map(
    (a) => ((a as t.JSXAttribute).name as t.JSXIdentifier).name,
  );
}

describe('generateSayJSXElement', () => {
  it('produces a self-closing Say element with an id attribute', () => {
    const message = new CompositeMessage(
      { id: 'greeting' },
      [],
      [],
      [new LiteralMessage('Hello')],
      t.identifier('say'),
    );

    const el = generateSayJSXElement(message);
    expect(el.openingElement.selfClosing).toBe(true);
    expect(attrNames(el)).toEqual(['id']);
    const id = el.openingElement.attributes[0] as t.JSXAttribute;
    expect((id.value as t.StringLiteral).value).toBe('greeting');
  });

  it('falls back to a hashed id when no descriptor id is given', () => {
    const message = new CompositeMessage(
      {},
      [],
      [],
      [new LiteralMessage('Hello')],
      t.identifier('say'),
    );
    const el = generateSayJSXElement(message);
    const id = el.openingElement.attributes[0] as t.JSXAttribute;
    expect((id.value as t.StringLiteral).value).toBe(message.toHashString());
  });

  it('omits the whitespace attribute when whitespace is undefined', () => {
    const message = new CompositeMessage({ id: 'x' }, [], [], [], t.identifier('say'));
    expect(attrNames(generateSayJSXElement(message))).toEqual(['id']);
  });

  it('emits a whitespace attribute when whitespace is set', () => {
    const message = new CompositeMessage({ id: 'x' }, [], [], [], t.identifier('say'), false);
    const el = generateSayJSXElement(message);
    expect(attrNames(el)).toEqual(['id', 'whitespace']);
    const ws = el.openingElement.attributes[1] as t.JSXAttribute;
    const expr = (ws.value as t.JSXExpressionContainer).expression as t.BooleanLiteral;
    expect(expr.value).toBe(false);
  });

  it('names every child key with a leading underscore', () => {
    const message = new CompositeMessage(
      { id: 'x' },
      [],
      [],
      [
        new ArgumentMessage('name', t.identifier('name')),
        new ElementMessage(
          '0',
          [new ArgumentMessage('inner', t.identifier('inner'))],
          t.identifier('el'),
        ),
        new ChoiceMessage(
          'plural',
          '1',
          [{ identifier: 'one', value: new ArgumentMessage('branch', t.identifier('branch')) }],
          t.identifier('count'),
        ),
        new CompositeMessage(
          {},
          [],
          [],
          [new ArgumentMessage('deep', t.identifier('deep'))],
          t.identifier('say'),
        ),
      ],
      t.identifier('say'),
    );

    // Values live behind an underscore, `Say`'s own props in front of it
    expect(attrNames(generateSayJSXElement(message))).toEqual([
      'id',
      '_name',
      '_0',
      '_inner',
      '_1',
      '_branch',
      '_deep',
    ]);
  });
});
