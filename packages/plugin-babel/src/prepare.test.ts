import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'saykit-prepare-'));

writeFileSync(
  join(dir, 'saykit.config.cjs'),
  `module.exports = {
    locales: ['en'],
    buckets: [{
      include: ['**/*.ts'],
      output: '{locale}.{extension}',
      formatter: { extension: '.json', parse: (c) => JSON.parse(c), stringify: () => '[]' },
      transformer: { match: () => true, extract: () => [], transform: (code) => code },
    }],
  };`,
);
vi.spyOn(process, 'cwd').mockReturnValue(dir);

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
