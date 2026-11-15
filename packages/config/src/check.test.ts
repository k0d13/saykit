import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { project } from './fixture.js';

const msg = (message: string, extra = {}) => ({ message, comments: [], references: [], ...extra });
const ids = (entries: { id?: string }[]) => entries.map((e) => e.id);

describe('check', () => {
  it('passes once extraction has run, and writes nothing itself', async () => {
    const { config, write, exists } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);

    expect(await config.check()).not.toEqual([]);
    expect(exists('l/en/m.json')).toBe(false);
    expect(exists('l/en/m.js')).toBe(false);

    await config.extract();
    expect(await config.check()).toEqual([]);
  });

  it('lists the source messages extraction would add, remove and update', async () => {
    const { config, write } = project();
    write('src/app.ts', [
      msg('Hello', { id: 'greeting' }),
      msg('Bye', { id: 'farewell' }),
      msg('Thanks', { id: 'thanks' }),
    ]);
    await config.extract();
    write('src/app.ts', [
      msg('Hello', { id: 'greeting' }),
      msg('See ya', { id: 'farewell' }),
      msg('Welcome', { id: 'welcome' }),
    ]);

    const [en, ...rest] = await config.check();
    expect(rest).toEqual([]);
    expect(en!.locale).toBe('en');
    expect(en!.stale).toBe(true);
    expect(ids(en!.added)).toEqual(['welcome']);
    expect(ids(en!.removed)).toEqual(['thanks']);
    expect(ids(en!.updated)).toEqual(['farewell']);
  });

  it('ignores fields the formatter does not keep when listing updates', async () => {
    // Drops comments and references, like the plain JSON layout or PO without references
    const { config, write } = project({
      bucket: `{ formatter: {
        extension: '.json',
        parse: (content) => (content ? JSON.parse(content) : []).map((m) => ({ ...m, comments: [], references: [] })),
        stringify: (messages) => JSON.stringify(messages.map(({ comments, references, ...m }) => m)),
      } }`,
    });
    write('src/app.ts', [
      msg('Hello', { id: 'greeting', comments: ['Shown on load'], references: ['src/app.ts:1'] }),
      msg('Bye', { id: 'farewell', references: ['src/app.ts:2'] }),
    ]);
    await config.extract();
    write('src/app.ts', [
      msg('Hello', { id: 'greeting', comments: ['Shown on load'], references: ['src/app.ts:1'] }),
      msg('See ya', { id: 'farewell', references: ['src/app.ts:2'] }),
      msg('Welcome', { id: 'welcome', references: ['src/app.ts:3'] }),
    ]);

    const [en] = await config.check();
    expect(ids(en!.added)).toEqual(['welcome']);
    expect(ids(en!.updated)).toEqual(['farewell']);
  });

  it('reports a missing non-source locale file, but not edits to an existing one', async () => {
    const { config, write, dir } = project();
    const rm = (path: string) => rmSync(join(dir, path));
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);
    await config.extract();
    write('l/fr/m.json', [msg('Old', { id: 'orphan', translation: 'Vieux' })]);
    expect(await config.check()).toEqual([]);

    rm('l/de/m.json');
    const results = await config.check();
    expect(results.map((r) => [r.locale, r.stale])).toEqual([['de', true]]);
  });

  it('flags untranslated and orphaned entries only when asked', async () => {
    const { config, write } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' }), msg('Bye', { id: 'farewell' })]);
    await config.extract();
    write('l/fr/m.json', [
      msg('Hello', { id: 'greeting', translation: 'Bonjour' }),
      msg('Bye', { id: 'farewell', translation: 'Salut', flags: ['fuzzy'] }),
      msg('Old', { id: 'orphan', translation: 'Vieux' }),
    ]);

    expect(await config.check()).toEqual([]);

    const results = await config.check({ untranslated: true, orphaned: true });
    const fr = results.find((r) => r.locale === 'fr')!;
    expect(fr.stale).toBe(false);
    expect(ids(fr.untranslated)).toEqual(['farewell']);
    expect(ids(fr.orphaned)).toEqual(['orphan']);
    const de = results.find((r) => r.locale === 'de')!;
    expect(ids(de.untranslated)).toEqual(['greeting', 'farewell']);
    expect(results.find((r) => r.locale === 'en')).toBeUndefined();
  });
});
