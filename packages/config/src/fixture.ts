import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach } from 'vitest';
import { loadConfig } from './index.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A temporary project with a `saykit.config.cjs`: three locales and one bucket whose formatter
 * reads and writes JSON, and whose source files are JSON arrays of messages. `config` and
 * `bucket` are JS object literals spread over the defaults.
 */
export function project({ config = '{}', bucket = '{}' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'saykit-'));
  dirs.push(dir);

  const write = (path: string, content: unknown) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content));
  };
  write(
    'saykit.config.cjs',
    `const bucket = {
      include: ['src/**/*.ts'],
      output: 'l/{locale}/m.{extension}',
      formatter: {
        extension: '.json',
        parse: (content) => (content ? JSON.parse(content) : []),
        stringify: (messages) => JSON.stringify(messages),
      },
      transformer: {
        match: (id) => id.endsWith('.ts'),
        extract: (code) => JSON.parse(code).map((m) => ({ comments: [], references: [], ...m })),
        transform: (code, id) => code + '/' + id,
      },
    };
    module.exports = { locales: ['en', 'fr', 'de'], buckets: [{ ...bucket, ...${bucket} }], ...${config} };`,
  );

  return {
    dir,
    config: loadConfig({ cwd: dir }),
    write,
    read: (path: string) => readFileSync(join(dir, path), 'utf8'),
    readJson: (path: string) => JSON.parse(readFileSync(join(dir, path), 'utf8')),
    exists: (path: string) => existsSync(join(dir, path)),
  };
}
