import { describe, expect, it } from 'vitest';
import { project } from './fixture.js';

const entry = (id: string, translation?: string, extra = {}) => ({
  message: id,
  id,
  translation,
  comments: [],
  references: [],
  ...extra,
});

describe('clean', () => {
  it('keeps translated entries exactly as they are on disk', () => {
    const { config, write, readJson } = project();
    write('l/en/m.json', [entry('greeting', 'Hello', { context: 'top' })]);
    const existing = entry('greeting', 'Bonjour', { comments: ['old'], references: ['z.ts:9'] });
    write('l/fr/m.json', [existing]);

    expect(config.clean().find((r) => r.locale === 'fr')!.removed).toBe(0);
    expect(readJson('l/fr/m.json')).toEqual([existing]);
  });

  it('drops entries missing from the source and entries with no translation', () => {
    const { config, write, readJson } = project();
    write('l/en/m.json', [entry('greeting', 'Hello'), entry('fresh', 'New string')]);
    write('l/fr/m.json', [
      entry('greeting', 'Bonjour'),
      entry('orphan', 'Parti'),
      entry('fresh', ''),
      entry('missing'),
    ]);

    const [fr] = config.clean();
    expect(fr!.removed).toBe(3);
    expect(readJson('l/fr/m.json').map((e: { id: string }) => e.id)).toEqual(['greeting']);
  });

  it('never adds source keys the locale does not already have, nor touches the source', () => {
    const { config, write, read, readJson } = project();
    write('l/en/m.json', [entry('greeting', 'Hello')]);
    const source = read('l/en/m.json');

    config.clean();

    expect(readJson('l/fr/m.json')).toEqual([]);
    expect(read('l/en/m.json')).toBe(source);
  });
});
