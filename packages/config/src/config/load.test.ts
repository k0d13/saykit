import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import nodeModule from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../index.js';

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

const locales = (root: string) => loadConfig({ cwd: root }).locales;

describe('loadConfig', () => {
  it('loads a TypeScript config, with or without defineConfig', () => {
    const root = createProject({
      'saykit.config.ts': `
        type Config = { locales: [string, ...string[]]; buckets: [] };
        const config: Config = { locales: ['en', 'fr'], buckets: [] };
        export default config;
      `,
    });

    const config = loadConfig({ cwd: root });
    expect(config.locales).toEqual(['en', 'fr']);
    expect(config.sourceLocale).toBe('en');
    expect(config.root).toBe(root);
    expect(config.file).toBe(join(root, 'saykit.config.ts'));
  });

  it('loads a CommonJS config', () => {
    const root = createProject({
      'saykit.config.cts': `
        const config: { locales: string[]; buckets: [] } = { locales: ['en'], buckets: [] };
        module.exports = config;
      `,
    });

    expect(locales(root)).toEqual(['en']);
  });

  it('defers to a registered .ts require hook', () => {
    const root = createProject({
      'saykit.config.ts': `
        const config: { locales: string[]; buckets: [] } = { locales: ['en'], buckets: [] };
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
      expect(locales(root)).toEqual(['en']);
    } finally {
      if (previous) hooks['.ts'] = previous;
      else delete hooks['.ts'];
    }
  });

  it('resolves relative imports, nested ones too, against the config’s own directory', () => {
    const root = createProject({
      'saykit/formatter.ts': `export { locales } from './locales.ts';`,
      'saykit/locales.ts': `export const locales: string[] = ['de', 'fr'];`,
      'saykit.config.ts': `
        import { locales } from './saykit/formatter.ts';
        export default { locales, buckets: [] };
      `,
    });

    expect(locales(root)).toEqual(['de', 'fr']);
  });

  it('reads a file next to the config', () => {
    const root = createProject({
      'locales.json': JSON.stringify(['ja']),
      'saykit.config.ts': `
        import { readFileSync } from 'node:fs';
        import { join } from 'node:path';

        const here: string = import.meta.dirname;
        export default { locales: JSON.parse(readFileSync(join(here, 'locales.json'), 'utf8')), buckets: [] };
      `,
    });

    expect(locales(root)).toEqual(['ja']);
  });

  it('leaves nothing behind on disk, and rereads the config on every call', () => {
    const root = createProject({
      'saykit.config.cjs': `module.exports = { locales: ['en'], buckets: [] };`,
    });

    expect(locales(root)).toEqual(['en']);
    writeFileSync(
      join(root, 'saykit.config.cjs'),
      `module.exports = { locales: ['de'], buckets: [] };`,
    );
    expect(locales(root)).toEqual(['de']);
    expect(readdirSync(root)).toEqual(['saykit.config.cjs']);
  });

  it('throws when no config file is found', () => {
    expect(() => locales(createProject({}))).toThrow('Could not find config file');
  });

  it('prefers the first supported extension', () => {
    const root = createProject({
      'saykit.config.js': `module.exports = { locales: ['js'], buckets: [] };`,
      'saykit.config.cjs': `module.exports = { locales: ['cjs'], buckets: [] };`,
    });

    expect(locales(root)).toEqual(['js']);
  });

  it('explains what is invalid, readably', () => {
    const root = createProject({
      'saykit.config.cjs': `module.exports = { locales: [], buckets: [] };`,
    });
    expect(() => locales(root)).toThrow(/Invalid config .*saykit\.config\.cjs[\s\S]*locales/);
  });

  it('throws when the default export is not an object', () => {
    const root = createProject({ 'saykit.config.cjs': `module.exports = 42;` });
    expect(() => locales(root)).toThrow('Invalid config');
  });

  it('surfaces an error thrown by the config itself', () => {
    const root = createProject({ 'saykit.config.ts': `throw new Error('boom');` });

    try {
      locales(root);
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
        export default { locales: [Locale.En], buckets: [] };
      `,
    });

    expect(() => locales(root)).toThrow('not erasable');
  });

  it('explains top-level await', () => {
    const root = createProject({
      'saykit.config.ts': `
        await Promise.resolve();
        export default { locales: ['en'], buckets: [] };
      `,
    });

    expect(() => locales(root)).toThrow('top-level await');
  });

  it('does not blame TypeScript for a syntax error in a JavaScript config', () => {
    const root = createProject({ 'saykit.config.js': `export default { locales: [ };` });

    try {
      locales(root);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe('Failed to import module');
      expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it('does not blame the runtime for a syntax error in a TypeScript config', () => {
    const root = createProject({ 'saykit.config.ts': `export default { locales: [ };` });

    expect(() => locales(root)).toThrow(/^Failed to import module$/);
  });
});
