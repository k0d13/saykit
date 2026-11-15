import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'saykit-unplugin-'));

writeFileSync(
  join(dir, 'saykit.config.cjs'),
  `module.exports = {
    locales: ['en', 'fr'],
    buckets: [{
      include: ['**/*.ts'],
      output: '{locale}/messages.{extension}',
      formatter: {
        extension: '.json',
        parse: (content) => JSON.parse(content),
        stringify: () => '[]',
      },
      transformer: {
        match: (id) => id.endsWith('.ts'),
        extract: () => [],
        transform: (code) => code.replace('say', 'SAY'),
      },
    }],
  };`,
);
vi.spyOn(process, 'cwd').mockReturnValue(dir);

const { default: unplugin } = await import('./index.js');
const plugin = unplugin.raw(undefined, { framework: 'rollup' } as never) as unknown as {
  buildStart: (this: { addWatchFile: (path: string) => void }) => void;
  watchChange: (id: string) => void;
  transform: { handler: (code: string, id: string) => string };
};

function write(locale: string, content: unknown) {
  const file = join(dir, locale, 'messages.json');
  mkdirSync(join(dir, locale), { recursive: true });
  writeFileSync(file, JSON.stringify(content));
  return file;
}

const read = (locale: string) => readFileSync(join(dir, locale, 'messages.js'), 'utf8');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('unplugin transform', () => {
  it('transforms code for a matching bucket', () => {
    expect(plugin.transform.handler('say`Hi`', join(dir, 'src/app.ts'))).toBe('SAY`Hi`');
  });

  it('leaves code untouched when no bucket matches', () => {
    expect(plugin.transform.handler('say`Hi`', join(dir, 'src/app.css'))).toBe('say`Hi`');
  });
});

describe('unplugin compile', () => {
  it('compiles every locale when the build starts, and watches the catalogues', () => {
    const en = write('en', [{ message: 'Hello', translation: 'Hello', id: 'greeting' }]);
    write('fr', [{ message: 'Hello', translation: 'Bonjour', id: 'greeting' }]);

    const watched: string[] = [];
    plugin.buildStart.call({ addWatchFile: (path) => watched.push(path) });

    expect(read('fr')).toContain('"greeting": "Bonjour"');
    expect(existsSync(join(dir, 'fr', 'messages.d.ts'))).toBe(true);
    expect(watched).toContain(en);
  });

  it('recompiles the locales that fall back to a changed catalogue', () => {
    write('fr', []);
    const en = write('en', [{ message: 'Hello', translation: 'Hi', id: 'greeting' }]);

    plugin.watchChange(en);

    expect(read('fr')).toContain('"greeting": "Hi"');
  });

  it('ignores changes to anything that is not a catalogue', () => {
    const before = read('en');
    write('en', [{ message: 'Hello', translation: 'Hey', id: 'greeting' }]);

    plugin.watchChange(join(dir, 'src/app.ts'));

    expect(read('en')).toBe(before);
  });
});
