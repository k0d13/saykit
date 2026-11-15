import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { project } from '../fixture.js';
import { defineConfig } from '../index.js';

const matching = (suffix: string) => `{
  match: (id) => id.endsWith('.${suffix}'),
  extract: (_code, id) => [{ message: 'from-${suffix}:' + id.split(/[\\\\/]/).pop(), comments: [], references: [] }],
  transform: (code) => code + '/${suffix}',
}`;

describe('defineConfig', () => {
  it('returns its input untouched, without validating', () => {
    const input = { locales: [] as never, buckets: [] };
    expect(defineConfig(input)).toBe(input);
  });
});

describe('bucket', () => {
  it('matches includes and excludes against the config folder, not the cwd', () => {
    const { config, dir } = project({ bucket: `{ exclude: ['src/ignore/**'] }` });
    const [bucket] = config.buckets;

    expect(bucket!.includes('src/app.ts')).toBe(true);
    expect(bucket!.includes(join(dir, 'src', 'app.ts'))).toBe(true);
    expect(bucket!.includes('src/app.ts?v=1')).toBe(true);
    expect(bucket!.includes('src/ignore/x.ts')).toBe(false);
    expect(bucket!.includes('README.md')).toBe(false);
  });

  it('resolves catalogue paths against the config folder and recognises them', () => {
    const { config, dir } = project();
    const [bucket] = config.buckets;

    expect(bucket!.cataloguePath('fr')).toBe(join(dir, 'l', 'fr', 'm.json'));
    expect(bucket!.isCatalogue(join(dir, 'l', 'fr', 'm.json'))).toBe(true);
    expect(bucket!.isCatalogue('l/fr/m.json')).toBe(true);
    expect(bucket!.isCatalogue('l/fr/other.json')).toBe(false);
    expect(bucket!.isCatalogue('l/fr/m.js')).toBe(false);
  });

  it('normalises declared messages into catalogue entries', () => {
    const { config } = project({
      bucket: `{
        messages: {
          extensionName: 'Reading Time',
          extensionDescription: {
            message: 'Estimate how long a page will take to read.',
            context: 'store',
            comments: ['The one-line store description.'],
          },
        },
      }`,
    });

    expect(config.buckets[0]!.messages).toEqual([
      {
        id: 'extensionName',
        message: 'Reading Time',
        translation: 'Reading Time',
        context: undefined,
        comments: [],
        references: [],
      },
      {
        id: 'extensionDescription',
        message: 'Estimate how long a page will take to read.',
        translation: 'Estimate how long a page will take to read.',
        context: 'store',
        comments: ['The one-line store description.'],
        references: [],
      },
    ]);
  });

  it('declares no messages when the field is omitted', () => {
    expect(project().config.buckets[0]!.messages).toEqual([]);
  });

  it('combines an array of transformers, skipping non-matching ones', () => {
    const { config } = project({
      bucket: `{ include: ['**/*'], transformer: [${matching('ts')}, ${matching('js')}] }`,
    });
    const { transformer } = config.buckets[0]!;

    expect(transformer.match('a.ts')).toBe(true);
    expect(transformer.match('a.css')).toBe(false);
    expect(transformer.extract('code', 'a.ts')).toMatchObject([{ message: 'from-ts:a.ts' }]);
    expect(transformer.extract('code', 'a.css')).toEqual([]);
    expect(transformer.transform('code', 'a.ts')).toBe('code/ts');
    expect(transformer.transform('code', 'a.css')).toBe('code');
  });
});

describe('transform', () => {
  it('transforms a file a bucket includes, by absolute or root-relative path', () => {
    const { config, dir } = project();
    const file = join(dir, 'src', 'app.ts');

    expect(config.transform('x', file)).toBe(`x/${file}`);
    expect(config.transform('x', 'src/app.ts')).toBe(`x/${file}`);
  });

  it('strips a query before matching and before handing the id on', () => {
    const { config, dir } = project();
    expect(config.transform('x', 'src/app.ts?macro')).toBe(`x/${join(dir, 'src', 'app.ts')}`);
  });

  it('gives undefined when no bucket includes the file', () => {
    expect(project().config.transform('x', 'README.md')).toBeUndefined();
  });
});
