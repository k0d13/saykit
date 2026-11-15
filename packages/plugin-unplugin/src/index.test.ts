import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'saykit-unplugin-'));

const config = {
  locales: ['en', 'fr'],
  buckets: [
    {
      match: (id: string) => id.endsWith('.ts'),
      output: Object.assign(join(dir, '{locale}', 'messages.{extension}'), {
        match: (id: string) => id.endsWith('messages.json'),
      }),
      transformer: { transform: (code: string) => code.replace('say', 'SAY') },
      formatter: {
        extension: '.json',
        parse: (content: string) =>
          JSON.parse(content) as {
            message: string;
            translation?: string;
            id?: string;
            context?: string;
          }[],
      },
    },
  ],
};

vi.mock('@saykit/config/features/loader', () => ({ resolveConfig: () => config }));

const { default: unplugin } = await import('./index.js');
const plugin = unplugin.raw(undefined, { framework: 'rollup' } as never) as {
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
    expect(plugin.transform.handler('say`Hi`', join(process.cwd(), 'src/app.ts'))).toBe('SAY`Hi`');
  });

  it('leaves code untouched when no bucket matches', () => {
    expect(plugin.transform.handler('say`Hi`', join(process.cwd(), 'src/app.css'))).toBe('say`Hi`');
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

    plugin.watchChange(join(process.cwd(), 'src/app.ts'));

    expect(read('en')).toBe(before);
  });
});
