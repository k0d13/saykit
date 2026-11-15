import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformSync } from '@babel/core';
import { afterAll, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'saykit-babel-'));

writeFileSync(
  join(dir, 'saykit.config.cjs'),
  `module.exports = {
    locales: ['en'],
    buckets: [{
      include: ['**/*.ts'],
      output: 'l/{locale}.{extension}',
      formatter: { extension: '.json', parse: () => [], stringify: () => '[]' },
      transformer: {
        match: () => true,
        extract: () => [],
        transform: (code) => code.replace('MARK', 'DONE'),
      },
    }],
  };`,
);
vi.spyOn(process, 'cwd').mockReturnValue(dir);

const { default: plugin } = await import('./index.js');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (code: string, filename: string) =>
  transformSync(code, {
    filename,
    plugins: [plugin],
    babelrc: false,
    configFile: false,
  })!.code!;

describe('plugin-babel parserOverride', () => {
  it('runs the bucket transformer over matching source files', () => {
    const out = run('const x = "MARK";', join(dir, 'app.ts'));
    expect(out).toContain('DONE');
  });

  it('skips files inside node_modules', () => {
    const out = run('const x = "MARK";', join(dir, 'node_modules', 'dep', 'index.ts'));
    expect(out).toContain('MARK');
  });

  it('leaves source files that match no bucket unchanged', () => {
    const out = run('const x = "MARK";', join(dir, 'app.js'));
    expect(out).toContain('MARK');
  });
});
