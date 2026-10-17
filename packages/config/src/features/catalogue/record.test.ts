import { describe, expect, it } from 'vitest';
import type { Bucket, Config } from '#/shapes.js';
import { assembleCatalogueRecord, resolveFallbackChain } from './record.js';

const config = (fallbackLocales?: Config['fallbackLocales']) =>
  ({ locales: ['en', 'en-GB', 'en-NZ', 'fr'], fallbackLocales, buckets: [] }) as unknown as Config;

describe('resolveFallbackChain', () => {
  it('always ends at the source locale', () => {
    expect(resolveFallbackChain(config(), 'fr')).toEqual(['fr', 'en']);
  });

  it('expands a configured chain, most specific first, then the source', () => {
    expect(resolveFallbackChain(config({ 'en-NZ': ['en-GB'] }), 'en-NZ')).toEqual([
      'en-NZ',
      'en-GB',
      'en',
    ]);
  });

  it('accepts a single fallback locale as a string', () => {
    expect(resolveFallbackChain(config({ 'en-NZ': 'en-GB' }), 'en-NZ')).toEqual([
      'en-NZ',
      'en-GB',
      'en',
    ]);
  });

  it('dedupes when the locale is already the source', () => {
    expect(resolveFallbackChain(config(), 'en')).toEqual(['en']);
  });
});

describe('assembleCatalogueRecord', () => {
  const bucket = {
    formatter: { parse: (content: string) => JSON.parse(content) },
  } as unknown as Bucket;

  it('lets more specific locales win, skips empty files, and falls back to source text', () => {
    // Contents are most-specific first, matching `resolveCatalogueSources`
    const record = assembleCatalogueRecord(bucket, [
      JSON.stringify([{ message: 'C', translation: 'C-NZ', id: 'c' }]),
      '', // a fallback locale with no file yet
      JSON.stringify([
        { message: 'A', id: 'a' },
        { message: 'C', translation: 'C-source', id: 'c' },
      ]),
    ]);

    expect(record).toEqual({ a: 'A', c: 'C-NZ' });
  });

  it('keeps a fallback translation when the more specific locale is untranslated', () => {
    // PO carries the source text in `msgid` even when `msgstr` is empty, so an
    // untranslated en-NZ entry must not displace the en-GB translation
    const record = assembleCatalogueRecord(bucket, [
      JSON.stringify([{ message: 'Hello', translation: '', id: 'greeting' }]),
      JSON.stringify([{ message: 'Hello', translation: 'Hi mate', id: 'greeting' }]),
      JSON.stringify([{ message: 'Hello', translation: 'Hello', id: 'greeting' }]),
    ]);

    expect(record).toEqual({ greeting: 'Hi mate' });
  });

  it('keeps the fallback when a locale reports a key as entirely empty', () => {
    // Single-value formats (JSON) surface an untranslated key as an empty
    // message and translation, which must not blank out the source string
    const record = assembleCatalogueRecord(bucket, [
      JSON.stringify([{ message: '', translation: '', id: 'greeting' }]),
      JSON.stringify([{ message: 'Hello', translation: 'Hello', id: 'greeting' }]),
    ]);

    expect(record).toEqual({ greeting: 'Hello' });
  });
});
