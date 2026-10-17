import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import nodeModule from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ts } from './module';

const roots: string[] = [];

function createProject(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'saykit-loader-'));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const file = join(root, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('ts loader', () => {
  it('loads a TypeScript config', () => {
    const root = createProject({
      'saykit.config.ts': `
        type Config = { locales: string[] };
        const config: Config = { locales: ['en'] };
        export default config;
      `,
    });

    expect(ts(join(root, 'saykit.config.ts'))).toEqual({ locales: ['en'] });
  });

  it('loads a CommonJS config', () => {
    const root = createProject({
      'saykit.config.cts': `
        const config: { locales: string[] } = { locales: ['en'] };
        module.exports = config;
      `,
    });

    expect(ts(join(root, 'saykit.config.cts'))).toEqual({ locales: ['en'] });
  });

  it('defers to a registered .ts require hook', () => {
    const root = createProject({
      'saykit.config.ts': `
        const config: { locales: string[] } = { locales: ['en'] };
        module.exports = config;
      `,
    });

    // Stands in for tsx/ts-node, which register a handler for '.ts' the same way
    const hooks = nodeModule.createRequire(import.meta.url).extensions;
    const previous = hooks['.ts'];
    hooks['.ts'] = (module, filename) => {
      const source = nodeModule.stripTypeScriptTypes(readFileSync(filename, 'utf8'), {
        mode: 'strip',
      });
      (module as unknown as { _compile: (code: string, filename: string) => void })._compile(
        source,
        filename,
      );
    };

    try {
      expect(ts(join(root, 'saykit.config.ts'))).toEqual({ locales: ['en'] });
    } finally {
      if (previous) hooks['.ts'] = previous;
      else delete hooks['.ts'];
    }
  });

  it('resolves a relative import against the config’s own directory', () => {
    const root = createProject({
      'formatter.ts': `export const locales: string[] = ['en', 'fr'];`,
      'saykit.config.ts': `
        import { locales } from './formatter.ts';
        export default { locales };
      `,
    });

    expect(ts(join(root, 'saykit.config.ts'))).toEqual({ locales: ['en', 'fr'] });
  });

  it('resolves a nested relative import', () => {
    const root = createProject({
      'saykit/formatter.ts': `export { locales } from './locales.ts';`,
      'saykit/locales.ts': `export const locales: string[] = ['de'];`,
      'saykit.config.ts': `
        import { locales } from './saykit/formatter.ts';
        export default { locales };
      `,
    });

    expect(ts(join(root, 'saykit.config.ts'))).toEqual({ locales: ['de'] });
  });

  it('reads a file next to the config', () => {
    const root = createProject({
      'locales.json': JSON.stringify(['ja']),
      'saykit.config.ts': `
        import { readFileSync } from 'node:fs';
        import { join } from 'node:path';

        const here: string = import.meta.dirname;
        export default { locales: JSON.parse(readFileSync(join(here, 'locales.json'), 'utf8')) };
      `,
    });

    expect(ts(join(root, 'saykit.config.ts'))).toEqual({ locales: ['ja'] });
  });

  it('leaves nothing behind on disk', () => {
    const root = createProject({
      'saykit.config.ts': `export default { locales: ['en'] };`,
    });

    ts(join(root, 'saykit.config.ts'));

    expect(readdirSync(root)).toEqual(['saykit.config.ts']);
  });

  it('surfaces an error thrown by the config itself', () => {
    const root = createProject({ 'saykit.config.ts': `throw new Error('boom');` });

    try {
      ts(join(root, 'saykit.config.ts'));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe('Failed to import module');
      expect((error as Error).cause).toMatchObject({ message: 'boom' });
    }
  });

  it('explains non-erasable syntax', () => {
    const root = createProject({
      'saykit.config.ts': `
        enum Locale { En = 'en' }
        export default { locales: [Locale.En] };
      `,
    });

    expect(() => ts(join(root, 'saykit.config.ts'))).toThrow('not erasable');
  });

  it('explains top-level await', () => {
    const root = createProject({
      'saykit.config.ts': `
        await Promise.resolve();
        export default { locales: ['en'] };
      `,
    });

    expect(() => ts(join(root, 'saykit.config.ts'))).toThrow('top-level await');
  });

  it('does not blame TypeScript for a syntax error in a JavaScript config', () => {
    const root = createProject({ 'saykit.config.js': `export default { locales: [ };` });

    try {
      ts(join(root, 'saykit.config.js'));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe('Failed to import module');
      expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it('does not blame the runtime for a syntax error in a TypeScript config', () => {
    const root = createProject({ 'saykit.config.ts': `export default { locales: [ };` });

    expect(() => ts(join(root, 'saykit.config.ts'))).toThrow(/^Failed to import module$/);
  });
});
