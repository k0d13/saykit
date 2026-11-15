import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  LiteralMessage,
} from '@saykit/config/messages';
import { describe, expect, it } from 'vitest';
import { generateSayCallExpression } from './generator.js';

function callKeys(node: t.CallExpression) {
  const object = node.arguments[0] as t.ObjectExpression;
  return object.properties.map((p) => ((p as t.ObjectProperty).key as t.Identifier).name);
}

describe('generateSayCallExpression', () => {
  it('builds a `.call` on the accessor with the descriptor id', () => {
    const message = new CompositeMessage(
      { id: 'greeting' },
      [],
      [],
      [new LiteralMessage('Hello')],
      t.identifier('say'),
    );

    const result = generateSayCallExpression(message);

    expect(t.isCallExpression(result)).toBe(true);
    const callee = result.callee as t.MemberExpression;
    expect((callee.object as t.Identifier).name).toBe('say');
    expect((callee.property as t.Identifier).name).toBe('call');
    const id = (result.arguments[0] as t.ObjectExpression).properties[0] as t.ObjectProperty;
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

    const result = generateSayCallExpression(message);
    const id = (result.arguments[0] as t.ObjectExpression).properties[0] as t.ObjectProperty;
    expect((id.value as t.StringLiteral).value).toBe(message.toHashString());
    expect((id.value as t.StringLiteral).value).not.toBe('');
  });

  it('flattens argument, element, choice and nested composite children', () => {
    const message = new CompositeMessage(
      { id: 'x' },
      [],
      [],
      [
        new LiteralMessage('literal is ignored'),
        new ArgumentMessage('name', t.identifier('name')),
        new ElementMessage(
          '0',
          [new ArgumentMessage('inner', t.identifier('inner'))],
          t.identifier('el'),
        ),
        new ChoiceMessage(
          'plural',
          'count',
          [
            {
              identifier: 'one',
              value: new ArgumentMessage('choiceArg', t.identifier('choiceArg')),
            },
          ],
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

    const result = generateSayCallExpression(message);

    // id, then one key per non-literal child (elements/choices also emit their
    // own children), every value behind an underscore
    expect(callKeys(result)).toEqual([
      'id',
      '_name',
      '_0',
      '_inner',
      '_count',
      '_choiceArg',
      '_deep',
    ]);
  });

  it('keeps a value named after the descriptor id out of its way', () => {
    const message = new CompositeMessage(
      { id: 'x' },
      [],
      [],
      [new ArgumentMessage('id', t.identifier('id'))],
      t.identifier('say'),
    );

    // Without the prefix both would be `id` and the later one would win,
    // leaving the descriptor pointing at a value rather than at a message
    expect(callKeys(generateSayCallExpression(message))).toEqual(['id', '_id']);
  });

  it('emits one property for a repeated identifier', () => {
    const message = new CompositeMessage(
      { id: 'x' },
      [],
      [],
      [
        new ArgumentMessage('name', t.identifier('name')),
        new LiteralMessage(' and '),
        new ArgumentMessage('name', t.identifier('name')),
      ],
      t.identifier('say'),
    );

    expect(callKeys(generateSayCallExpression(message))).toEqual(['id', '_name']);
  });
});
