import { describe, expect, it } from 'vitest';
import { generateHash } from './hash.js';
import { ArgumentMessage, CompositeMessage, LiteralMessage } from './types.js';

describe('Base message helpers', () => {
  const message = new CompositeMessage(
    { context: 'nav' },
    [],
    [],
    [new LiteralMessage('Hello, '), new ArgumentMessage('name', null)],
    null,
  );

  it('toICUString converts the message to ICU text', () => {
    expect(message.toICUString()).toBe('Hello, {name}');
  });

  it('toHashString hashes the ICU text with the composite context', () => {
    expect(message.toHashString()).toBe(generateHash('Hello, {name}', 'nav'));
  });

  it('toHashString omits context for non-composite messages', () => {
    const literal = new LiteralMessage('Hello');
    expect(literal.toHashString()).toBe(generateHash('Hello', undefined));
  });
});
