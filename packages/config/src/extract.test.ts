import { describe, expect, it, vi } from 'vitest';
import { project } from './fixture.js';
import { Logger, withLogger } from './logger.js';

const msg = (message: string, extra = {}) => ({ message, comments: [], references: [], ...extra });
const ids = (entries: { id?: string }[]) => entries.map((e) => e.id);

describe('extract', () => {
  it('writes the extracted messages to the source locale only, from a different cwd', async () => {
    const { config, write, readJson } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' }), msg('Bye', { id: 'farewell' })]);
    write('src/other.ts', [msg('Thanks', { id: 'thanks' })]);
    write('src/ignored.md', [msg('Nope', { id: 'nope' })]);

    await config.extract();

    expect(ids(readJson('l/en/m.json'))).toEqual(
      expect.arrayContaining(['greeting', 'farewell', 'thanks']),
    );
    expect(ids(readJson('l/en/m.json'))).not.toContain('nope');
    expect(readJson('l/en/m.json')[0].translation).toBeDefined();
  });

  it('writes messages declared on the bucket even when no file yields them', async () => {
    const { config, write, readJson } = project({
      bucket: `{ messages: { extensionName: 'Reading Time' } }`,
    });
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);

    await config.extract();

    expect(ids(readJson('l/en/m.json'))).toEqual(
      expect.arrayContaining(['extensionName', 'greeting']),
    );
  });

  it('keeps a declared message authoritative when source also extracts its id', async () => {
    const { config, write, readJson } = project({
      bucket: `{ messages: { extensionName: { message: 'Reading Time', comments: ['The name'] } } }`,
    });
    write('src/app.ts', [
      msg('Extracted Name', { id: 'extensionName', references: ['src/app.ts:1'] }),
    ]);

    await config.extract();

    const entries = readJson('l/en/m.json');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Reading Time');
    expect(entries[0].comments).toEqual(['The name']);
    // The call site still contributes its reference
    expect(entries[0].references).toEqual(['src/app.ts:1']);
  });

  it('merges by key, unioning comments and references, id-less messages by hash', async () => {
    const { config, write, readJson } = project();
    write('src/a.ts', [
      msg('Hello', { id: 'greeting', comments: ['a'], references: ['x.ts:1'] }),
      msg('Save', { context: 'button', comments: ['one'] }),
      msg('Save', { context: 'menu' }),
    ]);
    write('src/b.ts', [
      msg('Hello', { id: 'greeting', comments: ['b'], references: ['y.ts:2'] }),
      msg('Save', { context: 'button', comments: ['two'] }),
    ]);

    await config.extract();

    const entries = readJson('l/en/m.json');
    expect(entries).toHaveLength(3);
    const greeting = entries.find((e: { id?: string }) => e.id === 'greeting');
    expect(greeting.comments.sort()).toEqual(['a', 'b']);
    expect(greeting.references.sort()).toEqual(['x.ts:1', 'y.ts:2']);
    const button = entries.find((e: { context?: string }) => e.context === 'button');
    expect(button.comments.sort()).toEqual(['one', 'two']);
  });

  it('writes references relative to the config folder with forward slashes', async () => {
    const { config, write, readJson, dir } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting', references: [`${dir}/src/app.ts:3`] })]);

    await config.extract();

    expect(readJson('l/en/m.json')[0].references).toEqual(['src/app.ts:3']);
  });

  it('creates a header-only file for a locale that does not exist yet', async () => {
    const { config, write, readJson } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);

    await config.extract();

    expect(readJson('l/de/m.json')).toEqual([]);
  });

  it('compiles every locale into a module the app can import', async () => {
    const { config, write, read, exists } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);

    await config.extract();

    for (const locale of ['en', 'de']) {
      expect(exists(`l/${locale}/m.d.ts`)).toBe(true);
      // `de` has no translations, so it resolves to the source strings
      expect(read(`l/${locale}/m.js`)).toContain('"greeting": "Hello"');
    }
  });

  it('leaves an existing non-source locale completely untouched', async () => {
    const { config, write, read } = project();
    const original = JSON.stringify([
      { message: 'Old', id: 'orphan', translation: 'Vieux', comments: [], references: [] },
    ]);
    write('l/fr/m.json', original);
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);

    await config.extract();

    // No additions, and the orphaned string is not stripped
    expect(read('l/fr/m.json')).toBe(original);
  });

  it('reports to the enclosing logger, and stays silent otherwise', async () => {
    const { config, write } = project();
    write('src/app.ts', [msg('Hello', { id: 'greeting' })]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await config.extract();
      expect(log).not.toHaveBeenCalled();
      await withLogger(new Logger(), () => config.extract());
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
