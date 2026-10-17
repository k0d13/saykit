import { describe, expect, it } from 'vitest';
import type { Message } from '#/shapes.js';
import { mergeExtractedMessages, pruneLocaleMessages } from './merge.js';

const msg = (m: Partial<Message> & { message: string }): Message => ({
  comments: [],
  references: [],
  ...m,
});

describe('mergeExtractedMessages', () => {
  it('dedupes by id and unions comments and references', () => {
    const merged = mergeExtractedMessages([
      msg({ message: 'Hello', id: 'greeting', comments: ['a'], references: ['x.ts:1'] }),
      msg({ message: 'Hello', id: 'greeting', comments: ['b'], references: ['y.ts:2'] }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.comments).toEqual(['a', 'b']);
    expect(merged[0]!.references).toEqual(['x.ts:1', 'y.ts:2']);
  });

  it('dedupes id-less messages by message and context hash', () => {
    const merged = mergeExtractedMessages([
      msg({ message: 'Save', context: 'button', comments: ['one'] }),
      msg({ message: 'Save', context: 'button', comments: ['two'] }),
      msg({ message: 'Save', context: 'menu' }),
    ]);

    expect(merged).toHaveLength(2);
    const button = merged.find((m) => m.context === 'button')!;
    expect(button.comments).toEqual(['one', 'two']);
  });
});

describe('pruneLocaleMessages', () => {
  const source = [
    msg({
      message: 'Hello',
      id: 'greeting',
      context: 'top',
      comments: ['new'],
      references: ['a.ts:1'],
    }),
    msg({ message: 'New string', id: 'fresh' }),
  ];

  it('keeps translated entries exactly as they are on disk', () => {
    const existing = [
      msg({
        message: 'Hello (old)',
        id: 'greeting',
        translation: 'Bonjour',
        comments: ['old'],
        references: ['z.ts:9'],
      }),
    ];

    const pruned = pruneLocaleMessages(existing, source);

    expect(pruned).toEqual(existing);
  });

  it('never adds source keys the locale does not already have', () => {
    expect(pruneLocaleMessages([], source)).toEqual([]);
  });

  it('drops entries that no longer exist in the source', () => {
    const existing = [msg({ message: 'Gone', id: 'orphan', translation: 'Parti' })];

    const pruned = pruneLocaleMessages(existing, source);

    expect(pruned.some((m) => m.id === 'orphan')).toBe(false);
  });

  it('drops entries with no translation', () => {
    const existing = [
      msg({ message: 'Hello', id: 'greeting' }),
      msg({ message: 'New string', id: 'fresh', translation: '' }),
    ];

    expect(pruneLocaleMessages(existing, source)).toEqual([]);
  });
});
