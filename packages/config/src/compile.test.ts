import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { project } from './fixture.js';

const entry = (message: string, translation: string | undefined, id: string, extra = {}) => ({
  message,
  translation,
  id,
  ...extra,
});

describe('compile', () => {
  it('compiles every locale, then writes nothing when nothing changed', () => {
    const { config, write, read } = project();
    write('l/en/m.json', [entry('Hello', 'Hello', 'greeting')]);
    write('l/fr/m.json', [entry('Hello', 'Bonjour', 'greeting')]);

    const first = config.compile();
    expect(first.map((m) => [m.locale, m.written])).toEqual([
      ['en', true],
      ['fr', true],
      ['de', true],
    ]);
    expect(first[1]!.path).toBe(join(config.root, 'l', 'fr', 'm.js'));
    expect(first[1]!.sources).toEqual([
      join(config.root, 'l', 'fr', 'm.json'),
      join(config.root, 'l', 'en', 'm.json'),
    ]);
    expect(read('l/fr/m.js')).toContain('"greeting": "Bonjour"');
    expect(read('l/fr/m.d.ts')).toContain('export default messages');

    const { mtimeMs } = statSync(first[1]!.path);
    expect(config.compile().map((m) => m.written)).toEqual([false, false, false]);
    expect(statSync(first[1]!.path).mtimeMs).toBe(mtimeMs);
  });

  it('hashes a key when a message carries no id', () => {
    const { config, write, read } = project();
    write('l/en/m.json', [{ message: 'Bye', translation: 'Bye' }]);

    const [en] = config.compile();
    expect(en!.count).toBe(1);
    expect(read('l/en/m.js')).toMatch(/\/\/ Bye\n {2}"[\w-]{6}": /);
  });

  it('falls back to the source string for keys untranslated or missing in a locale', () => {
    const { config, write, read } = project();
    write('l/en/m.json', [
      entry('Hello', undefined, 'greeting'),
      entry('Bye', undefined, 'farewell'),
    ]);
    write('l/fr/m.json', [entry('Hello', 'Bonjour', 'greeting')]);
    write('l/de/m.json', '');

    config.compile();
    expect(read('l/fr/m.js')).toContain('"greeting": "Bonjour"');
    expect(read('l/fr/m.js')).toContain('"farewell": "Bye"');
    expect(read('l/de/m.js')).toContain('"greeting": "Hello"');
  });

  it('resolves a configured fallback chain, a string or an array, before the source locale', () => {
    for (const fallback of [`['en-GB']`, `'en-GB'`]) {
      const { config, write, read } = project({
        config: `{ locales: ['en', 'en-GB', 'en-NZ'], fallbackLocales: { 'en-NZ': ${fallback} } }`,
      });
      write('l/en/m.json', [entry('A', 'A', 'a'), entry('B', 'B', 'b'), entry('C', 'C', 'c')]);
      write('l/en-GB/m.json', [entry('B', 'B-GB', 'b'), entry('C', 'C-GB', 'c')]);
      write('l/en-NZ/m.json', [entry('C', 'C-NZ', 'c')]);

      const nz = config.compile().find((m) => m.locale === 'en-NZ')!;
      const module = read('l/en-NZ/m.js');
      expect(module).toContain('"a": "A"');
      expect(module).toContain('"b": "B-GB"');
      expect(module).toContain('"c": "C-NZ"');
      expect(nz.sources.map((s) => s.slice(config.root.length + 1).replaceAll('\\', '/'))).toEqual([
        'l/en-NZ/m.json',
        'l/en-GB/m.json',
        'l/en/m.json',
      ]);
    }
  });

  it('lets a more specific translation win, and skips an empty fallback file', () => {
    const { config, write, read } = project({
      config: `{ locales: ['en', 'en-GB', 'en-NZ'], fallbackLocales: { 'en-NZ': ['en-GB'] } }`,
    });
    write('l/en/m.json', [entry('A', 'A', 'a'), entry('C', 'C-source', 'c')]);
    write('l/en-GB/m.json', '');
    write('l/en-NZ/m.json', [entry('C', 'C-NZ', 'c')]);

    config.compile();
    expect(read('l/en-NZ/m.js')).toContain('"c": "C-NZ"');
  });

  it('keeps a fallback translation when the more specific locale is untranslated', () => {
    // PO carries the source text in `msgid` even when `msgstr` is empty, so an untranslated en-NZ
    // entry must not displace the en-GB translation. JSON reports a missing key as entirely empty
    const { config, write, read } = project({
      config: `{ locales: ['en', 'en-GB', 'en-NZ'], fallbackLocales: { 'en-NZ': ['en-GB'] } }`,
    });
    write('l/en/m.json', [entry('Hello', 'Hello', 'greeting'), entry('Bye', 'Bye', 'bye')]);
    write('l/en-GB/m.json', [entry('Hello', 'Hi mate', 'greeting')]);
    write('l/en-NZ/m.json', [entry('Hello', '', 'greeting'), entry('', '', 'bye')]);

    config.compile();
    expect(read('l/en-NZ/m.js')).toContain('"greeting": "Hi mate"');
    expect(read('l/en-NZ/m.js')).toContain('"bye": "Bye"');
  });

  it('treats a fuzzy translation as untranslated', () => {
    const { config, write, read } = project({ config: `{ locales: ['en', 'fr'] }` });
    write('l/en/m.json', [entry('Hello', 'Hello', 'greeting'), entry('Bye', 'Bye', 'farewell')]);
    write('l/fr/m.json', [
      entry('Hello', 'Salut', 'greeting', { flags: ['fuzzy'] }),
      entry('Bye', 'Au revoir', 'farewell'),
    ]);

    config.compile();
    expect(read('l/fr/m.js')).toContain('"greeting": "Hello"');
    expect(read('l/fr/m.js')).toContain('"farewell": "Au revoir"');
  });

  it('refuses a catalogue that is where its module would be written', () => {
    const { config } = project({
      bucket: `{ formatter: { ...bucket.formatter, extension: '.js' } }`,
    });
    expect(() => config.compile()).toThrow(/compiled module would be written/);
  });
});

describe('fileChanged', () => {
  it('recompiles the buckets that read a catalogue, and nothing for anything else', () => {
    const { config, write, read } = project();
    write('l/en/m.json', [entry('Hello', 'Hello', 'greeting')]);
    config.compile();

    write('l/en/m.json', [entry('Hello', 'Hey', 'greeting')]);
    const modules = config.fileChanged(join(config.root, 'l', 'en', 'm.json?x'));
    expect(modules).toHaveLength(3);
    expect(read('l/fr/m.js')).toContain('"greeting": "Hey"');

    expect(config.fileChanged('l/en/m.js')).toEqual([]);
    expect(config.fileChanged('src/app.ts')).toEqual([]);
  });
});

describe('watch', () => {
  it('recompiles a locale when the catalogue it falls back to changes, then stops', async () => {
    const { config, write, read } = project();
    write('l/en/m.json', [entry('Hello', 'Hello', 'greeting'), entry('Bye', 'Bye', 'farewell')]);
    write('l/fr/m.json', [entry('Hello', 'Bonjour', 'greeting')]);
    config.compile();

    const stop = config.watch();
    try {
      write('l/en/m.json', [
        entry('Hello', 'Hello', 'greeting'),
        entry('Bye', 'Goodbye', 'farewell'),
      ]);

      // fr has no translation of its own, so it falls back to the edited source
      await vi.waitFor(() => expect(read('l/fr/m.js')).toContain('"farewell": "Goodbye"'), {
        timeout: 3000,
      });
    } finally {
      stop();
    }

    write('l/en/m.json', [entry('Bye', 'Later', 'farewell')]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(read('l/fr/m.js')).toContain('"farewell": "Goodbye"');
  });
});
