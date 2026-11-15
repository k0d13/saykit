import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateHash } from '@saykit/config/messages';
import { describe, expect, it } from 'vitest';
import createJsonFormatter from './formatter.js';

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');

describe('createJsonFormatter', () => {
  it('uses the .json extension', () => {
    expect(createJsonFormatter().extension).toBe('.json');
  });

  describe('parse', () => {
    const messages = createJsonFormatter().parse(fixture('messages.json'));

    it('reads every entry from the file', () => {
      expect(messages).toHaveLength(2);
    });

    it('uses the key as the id and the value as message and translation', () => {
      const greeting = messages.find((m) => m.id === 'greeting')!;
      expect(greeting.message).toBe('Bonjour');
      expect(greeting.translation).toBe('Bonjour');
      expect(greeting.comments).toEqual([]);
      expect(greeting.references).toEqual([]);
    });

    it('ignores non-string values', () => {
      const parsed = createJsonFormatter().parse('{"a":"x","b":123,"c":null}');
      expect(parsed.map((m) => m.id)).toEqual(['a']);
    });
  });

  describe('stringify', () => {
    const message = {
      id: 'greeting',
      message: 'Hello',
      translation: 'Bonjour',
      comments: [],
      references: [],
    };

    it('writes a pretty-printed flat object keyed by id, with a trailing newline', () => {
      const out = createJsonFormatter().stringify([message], { locale: 'fr' });
      expect(out).toBe('{\n  "greeting": "Bonjour"\n}\n');
    });

    it('falls back to a content hash for the key when there is no id', () => {
      const out = createJsonFormatter().stringify(
        [{ message: 'Hello', translation: 'Bonjour', comments: [], references: [] }],
        { locale: 'fr' },
      );
      expect(JSON.parse(out)).toEqual({ [generateHash('Hello')]: 'Bonjour' });
    });

    it('hashes message and context together, keeping same text under different contexts distinct', () => {
      const out = createJsonFormatter().stringify(
        [
          {
            message: 'Post',
            translation: 'Publier',
            context: 'verb',
            comments: [],
            references: [],
          },
          {
            message: 'Post',
            translation: 'Article',
            context: 'noun',
            comments: [],
            references: [],
          },
        ],
        { locale: 'fr' },
      );
      expect(JSON.parse(out)).toEqual({
        [generateHash('Post', 'verb')]: 'Publier',
        [generateHash('Post', 'noun')]: 'Article',
      });
    });

    it('defaults the value to an empty string', () => {
      const out = createJsonFormatter().stringify(
        [{ message: 'Hi', comments: [], references: [] }],
        {
          locale: 'de',
        },
      );
      expect(JSON.parse(out)).toEqual({ [generateHash('Hi')]: '' });
    });

    it('sorts keys for stable output', () => {
      const out = createJsonFormatter().stringify(
        [
          { id: 'banana', message: 'Banana', translation: 'Banane', comments: [], references: [] },
          { id: 'apple', message: 'Apple', translation: 'Pomme', comments: [], references: [] },
        ],
        { locale: 'fr' },
      );
      expect(out.indexOf('apple')).toBeLessThan(out.indexOf('banana'));
    });

    it('preserves ICU MessageFormat strings as JSON string values', () => {
      const icu = '{count, plural, one {# item} other {# items}}';
      const out = createJsonFormatter().stringify(
        [{ id: 'items', message: icu, translation: icu, comments: [], references: [] }],
        { locale: 'en' },
      );
      expect(JSON.parse(out).items).toBe(icu);
    });

    it('round-trips through parse', () => {
      const formatter = createJsonFormatter();
      const out = formatter.stringify([message], { locale: 'fr' });
      const [parsed] = formatter.parse(out);
      expect(parsed).toMatchObject({
        id: 'greeting',
        translation: 'Bonjour',
        comments: [],
        references: [],
      });
    });

    it('writes an empty object for an empty catalogue', () => {
      const out = createJsonFormatter().stringify([], { locale: 'de' });
      expect(JSON.parse(out)).toEqual({});
    });
  });

  const withMeta = {
    id: 'greeting',
    message: 'Hello',
    translation: 'Bonjour',
    context: 'formal',
    comments: ['A friendly hello'],
    references: ['src/app.ts:10'],
  };

  describe("dialect: 'arb'", () => {
    const formatter = createJsonFormatter({ dialect: 'arb' });

    it('keeps strings flat with metadata in a sibling @key object', () => {
      const out = JSON.parse(formatter.stringify([withMeta], { locale: 'fr' }));
      expect(out).toEqual({
        '@@locale': 'fr',
        greeting: 'Bonjour',
        '@greeting': {
          description: 'A friendly hello',
          'x-saykit-context': 'formal',
          'x-saykit-references': ['src/app.ts:10'],
        },
      });
    });

    it('omits the @key object when a message has no metadata', () => {
      const out = JSON.parse(
        formatter.stringify(
          [{ id: 'hi', message: 'Hi', translation: 'Salut', comments: [], references: [] }],
          { locale: 'fr' },
        ),
      );
      expect(out).toEqual({ '@@locale': 'fr', hi: 'Salut' });
    });

    it('parses strings and their sibling metadata, skipping @-prefixed keys', () => {
      const messages = formatter.parse(fixture('messages.arb.json'));
      expect(messages.map((m) => m.id).sort()).toEqual(['farewell', 'greeting']);
      const greeting = messages.find((m) => m.id === 'greeting')!;
      expect(greeting).toMatchObject({
        translation: 'Bonjour',
        context: 'formal',
        comments: ['A friendly hello'],
        references: ['src/app.ts:10'],
      });
    });

    it('round-trips metadata through parse', () => {
      const [parsed] = formatter.parse(formatter.stringify([withMeta], { locale: 'fr' }));
      expect(parsed).toMatchObject({
        id: 'greeting',
        translation: 'Bonjour',
        context: 'formal',
        comments: ['A friendly hello'],
        references: ['src/app.ts:10'],
      });
    });
  });

  describe("dialect: 'webextension'", () => {
    const formatter = createJsonFormatter({ dialect: 'webextension' });

    it('maps each key to a { message, description } object', () => {
      const out = JSON.parse(formatter.stringify([withMeta], { locale: 'fr' }));
      expect(out).toEqual({
        greeting: {
          message: 'Bonjour',
          description: 'A friendly hello',
          'x-saykit-context': 'formal',
          'x-saykit-references': ['src/app.ts:10'],
        },
      });
    });

    it('parses the message field and its metadata', () => {
      const messages = formatter.parse(fixture('messages.webext.json'));
      expect(messages.map((m) => m.id).sort()).toEqual(['farewell', 'greeting']);
      const greeting = messages.find((m) => m.id === 'greeting')!;
      expect(greeting).toMatchObject({
        translation: 'Bonjour',
        context: 'formal',
        comments: ['A friendly hello'],
        references: ['src/app.ts:10'],
      });
    });

    it('round-trips metadata through parse', () => {
      const [parsed] = formatter.parse(formatter.stringify([withMeta], { locale: 'fr' }));
      expect(parsed).toMatchObject({
        id: 'greeting',
        translation: 'Bonjour',
        context: 'formal',
        comments: ['A friendly hello'],
        references: ['src/app.ts:10'],
      });
    });
  });
});
