import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Bucket, Config } from '#/shapes.js';
import {
  compileCataloguesSync,
  findCatalogueBuckets,
  listCataloguePaths,
  watchCatalogues,
} from './compile.js';
import { modulePathFor, writeFileIfChanged } from './emit.js';

const dir = mkdtempSync(join(tmpdir(), 'saykit-compile-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const bucket = {
  output: Object.assign(join(dir, '{locale}', 'messages.{extension}'), {
    match: (id: string) => id.endsWith('messages.json'),
  }),
  formatter: {
    extension: '.json',
    parse: (content: string) => (content ? JSON.parse(content) : []),
  },
} as unknown as Bucket;

const config = { locales: ['en', 'fr'], buckets: [bucket] } as unknown as Config;

function write(locale: string, content: unknown) {
  const file = join(dir, locale, 'messages.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(content));
}

describe('writeFileIfChanged', () => {
  it('writes new content and skips identical content', () => {
    const file = join(dir, 'plain.txt');

    expect(writeFileIfChanged(file, 'a')).toBe(true);
    const { mtimeMs } = statSync(file);

    expect(writeFileIfChanged(file, 'a')).toBe(false);
    expect(statSync(file).mtimeMs).toBe(mtimeMs);

    expect(writeFileIfChanged(file, 'b')).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('b');
  });
});

describe('compileCataloguesSync', () => {
  it('compiles every locale, then writes nothing when nothing changed', () => {
    write('en', [{ message: 'Hello', translation: 'Hello', id: 'greeting' }]);
    write('fr', [{ message: 'Hello', translation: 'Bonjour', id: 'greeting' }]);

    const first = compileCataloguesSync(config);
    expect(first.map((r) => r.written)).toEqual([true, true]);
    expect(readFileSync(modulePathFor(bucket, 'fr'), 'utf8')).toContain('"greeting": "Bonjour"');

    const second = compileCataloguesSync(config);
    expect(second.map((r) => r.written)).toEqual([false, false]);
  });
});

describe('findCatalogueBuckets', () => {
  it('finds the bucket a catalogue belongs to, and nothing for its compiled module', () => {
    const [en] = listCataloguePaths(config);
    expect(findCatalogueBuckets(config, en!)).toEqual([bucket]);
    expect(findCatalogueBuckets(config, modulePathFor(bucket, 'en'))).toEqual([]);
  });
});

describe('watchCatalogues', () => {
  it('recompiles a locale when the catalogue it falls back to changes', async () => {
    write('en', [
      { message: 'Hello', translation: 'Hello', id: 'greeting' },
      { message: 'Bye', translation: 'Bye', id: 'farewell' },
    ]);
    write('fr', [{ message: 'Hello', translation: 'Bonjour', id: 'greeting' }]);
    compileCataloguesSync(config);

    const stop = watchCatalogues(config, { delay: 10 });
    try {
      write('en', [
        { message: 'Hello', translation: 'Hello', id: 'greeting' },
        { message: 'Bye', translation: 'Goodbye', id: 'farewell' },
      ]);

      // fr has no translation of its own, so it falls back to the edited source
      await vi.waitFor(
        () =>
          expect(readFileSync(modulePathFor(bucket, 'fr'), 'utf8')).toContain(
            '"farewell": "Goodbye"',
          ),
        { timeout: 3000 },
      );
    } finally {
      stop();
    }
  });
});
