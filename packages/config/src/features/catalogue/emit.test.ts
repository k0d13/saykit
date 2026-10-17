import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compileMessage } from 'saykit';
import { afterAll, describe, expect, it } from 'vitest';
import { generateHash } from '#/features/messages/hash.js';
import type { Bucket, Config } from '#/shapes.js';
import { emitCatalogueModule, generateCatalogueModule, modulePathFor } from './emit.js';

const dir = mkdtempSync(join(tmpdir(), 'saykit-emit-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A bucket whose formatter reads the JSON the fixtures are written as. */
const bucket = {
  output: Object.assign(join(dir, '{locale}', 'messages.{extension}'), { match: () => true }),
  formatter: {
    extension: '.json',
    parse: (content: string) => (content ? JSON.parse(content) : []),
  },
} as unknown as Bucket;

const config = {
  locales: ['en', 'en-GB', 'en-NZ', 'fr'],
  fallbackLocales: { 'en-NZ': ['en-GB'] },
  buckets: [bucket],
} as unknown as Config;

function write(locale: string, content: unknown) {
  const file = join(dir, locale, 'messages.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

/** Load an emitted module the way a bundler would, and read it as a view does. */
async function load(locale: string) {
  const source = readFileSync(modulePathFor(bucket, locale), 'utf8');
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  const messages = module.default as Record<string, Parameters<typeof compileMessage>[0]>;
  return (id: string, values: Record<string, unknown> = {}) =>
    compileMessage(messages[id]!, locale)(values);
}

describe('generateCatalogueModule', () => {
  it('emits data, with the message it came from beside it', () => {
    const source = generateCatalogueModule({
      greeting: 'Bonjour',
      items: '{count, plural, one {# article} other {# articles}}',
    });

    // Nothing imported and no locale bound in: a view compiles what it reads,
    // and the module is the same JSON on either side of a boundary
    expect(source).not.toContain('import');
    expect(source).not.toContain('=>');
    expect(source).toContain('"greeting": "Bonjour"');
    // The message it came from, so the file can be read and reviewed
    expect(source).toContain('// Bonjour');
  });

  it('keeps a message on any line terminator inside its comment', async () => {
    for (const terminator of ['\n', '\r', '\u2028', '\u2029']) {
      const source = generateCatalogueModule({
        a: `Hi${terminator}globalThis.pwned = true; //`,
      });
      await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
      expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
    }
  });

  // In an object literal, a plain `__proto__` key sets the prototype instead
  it('keeps a key named __proto__ on import', async () => {
    const source = generateCatalogueModule(
      Object.fromEntries([
        ['__proto__', 'Hi'],
        ['a', '{g, select, __proto__ {A} other {B}}'],
      ]),
    );
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    );
    expect(Object.hasOwn(module.default, '__proto__')).toBe(true);
    expect(compileMessage(module.default.a, 'en')({ _g: '__proto__' })).toBe('A');
  });
});

describe('emitCatalogueModule', () => {
  it('refuses a catalogue that is where its module would be written', () => {
    const colliding = { ...bucket, formatter: { ...bucket.formatter, extension: '.js' } } as Bucket;
    expect(() => modulePathFor(colliding, 'en')).toThrow(/compiled module would be written/);
  });

  it('compiles the source locale, hashing a key when a message carries no id', async () => {
    write('en', [
      { message: 'Hello', translation: 'Hello', id: 'greeting' },
      { message: 'Bye', translation: 'Bye' },
    ]);

    const { path, count } = await emitCatalogueModule(config, bucket, 'en');
    expect(path.endsWith('.js')).toBe(true);
    expect(count).toBe(2);

    const messages = await load('en');
    expect(messages('greeting')).toBe('Hello');
    expect(messages(generateHash('Bye', undefined))).toBe('Bye');
  });

  it('writes a declaration beside the module, so tsc needs no codegen', async () => {
    write('en', [{ message: 'Hello', id: 'greeting' }]);
    const { path } = await emitCatalogueModule(config, bucket, 'en');

    const declaration = path.replace(/\.js$/, '.d.ts');
    expect(existsSync(declaration)).toBe(true);
    expect(readFileSync(declaration, 'utf8')).toContain('export default messages');
  });

  it('falls back to the source string for keys untranslated in a non-source locale', async () => {
    write('en', [
      { message: 'Hello', id: 'greeting' },
      { message: 'Bye', id: 'farewell' },
    ]);
    write('fr', [{ message: 'Hello', translation: 'Bonjour', id: 'greeting' }]);

    await emitCatalogueModule(config, bucket, 'fr');
    const messages = await load('fr');
    expect(messages('greeting')).toBe('Bonjour'); // real translation wins
    expect(messages('farewell')).toBe('Bye'); // untranslated -> source fallback
  });

  it('resolves an empty non-source locale entirely to source strings', async () => {
    write('en', [{ message: 'Hello', id: 'greeting' }]);
    write('fr', '');

    await emitCatalogueModule(config, bucket, 'fr');
    expect((await load('fr'))('greeting')).toBe('Hello');
  });

  it('resolves a configured fallback chain before the source locale', async () => {
    write('en', [
      { message: 'A', id: 'a' },
      { message: 'B', id: 'b' },
      { message: 'C', id: 'c' },
    ]);
    write('en-GB', [
      { message: 'B', translation: 'B-GB', id: 'b' },
      { message: 'C', translation: 'C-GB', id: 'c' },
    ]);
    write('en-NZ', [{ message: 'C', translation: 'C-NZ', id: 'c' }]);

    await emitCatalogueModule(config, bucket, 'en-NZ');
    const messages = await load('en-NZ');
    expect(messages('a')).toBe('A'); // only in the source
    expect(messages('b')).toBe('B-GB'); // from the en-GB fallback
    expect(messages('c')).toBe('C-NZ'); // en-NZ wins over en-GB and the source
  });
});
