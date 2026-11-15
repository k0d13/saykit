import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'saykit-prepare-'));

const config = {
  locales: ['en', 'fr'],
  buckets: [
    {
      output: Object.assign(join(dir, '{locale}.{extension}'), {
        match: (id: string) => id.endsWith('.json'),
      }),
      formatter: {
        extension: '.json',
        parse: (content: string) =>
          JSON.parse(content) as { message: string; translation?: string; id?: string }[],
      },
    },
  ],
};

vi.mock('@saykit/config/features/loader', () => ({ resolveConfig: () => config }));

const { withSayKit: withNext } = await import('./next.js');
const { withSayKit: withMetro } = await import('./metro.js');

const MARKER = 'SAYKIT_CATALOGUES_PREPARED';
const NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  delete process.env[MARKER];
  // Production, so no watcher is left behind by a test
  process.env.NODE_ENV = 'production';
  rmSync(join(dir, 'en.js'), { force: true });
  writeFileSync(join(dir, 'en.json'), JSON.stringify([{ message: 'Hi', translation: 'Hi' }]));
});

afterAll(() => {
  delete process.env[MARKER];
  process.env.NODE_ENV = NODE_ENV;
  rmSync(dir, { recursive: true, force: true });
});

describe.each([
  ['next', withNext],
  ['metro', withMetro],
])('withSayKit (%s)', (_, withSayKit) => {
  it('compiles catalogues and returns the config untouched', () => {
    const input = { reactStrictMode: true };
    expect(withSayKit(input)).toBe(input);
    expect(readFileSync(join(dir, 'en.js'), 'utf8')).toContain('Hi');
    expect(process.env[MARKER]).toBe(String(process.pid));
  });

  it('leaves compiling to the process that already did it', () => {
    process.env[MARKER] = '1';
    withSayKit({});
    expect(existsSync(join(dir, 'en.js'))).toBe(false);
  });
});
