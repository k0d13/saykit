import { mkdtempSync, rmSync } from 'node:fs';
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
  transform: { handler: (code: string, id: string) => string };
};

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('unplugin transform', () => {
  it('transforms code for a matching bucket', () => {
    expect(plugin.transform.handler('say`Hi`', join(process.cwd(), 'src/app.ts'))).toBe('SAY`Hi`');
  });

  it('leaves code untouched when no bucket matches', () => {
    expect(plugin.transform.handler('say`Hi`', join(process.cwd(), 'src/app.css'))).toBe('say`Hi`');
  });
});
