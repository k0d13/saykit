import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Bucket } from '#/shapes.js';
import { readCatalogueMessages, writeCatalogueMessages } from './storage.js';

const dir = mkdtempSync(join(tmpdir(), 'saykit-storage-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// A bucket with a JSON formatter; every test passes an explicit path
const bucket = {
  formatter: {
    parse: (content: string) => (content ? JSON.parse(content) : []),
    stringify: (messages: unknown) => JSON.stringify(messages),
  },
} as unknown as Bucket;

const message = {
  message: 'Hello',
  translation: 'Bonjour',
  id: 'greeting',
  context: undefined,
  comments: [],
  references: [],
};

describe('writeCatalogueMessages / readCatalogueMessages', () => {
  it('writes the catalogue and its .d.ts declaration', async () => {
    const path = join(dir, 'fr.json');
    const declaration = join(dir, 'fr.d.json.ts');
    await writeCatalogueMessages(bucket, 'fr', [message], path);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(declaration)).toBe(true);
    expect(readFileSync(declaration, 'utf8')).toContain('export default messages');
  });

  it('round-trips through read', async () => {
    const path = join(dir, 'de.json');
    await writeCatalogueMessages(bucket, 'de', [message], path);
    const read = await readCatalogueMessages(bucket, 'de', path);
    expect(read).toContainEqual(expect.objectContaining({ id: 'greeting' }));
  });

  it('passes existing content to the formatter when the file already exists', async () => {
    const path = join(dir, 'existing.json');
    await writeCatalogueMessages(bucket, 'en', [message], path);
    // Second write should read the existing file first (no throw)
    await expect(writeCatalogueMessages(bucket, 'en', [message], path)).resolves.toBeUndefined();
  });

  it('returns an empty array when the catalogue file is missing', async () => {
    expect(await readCatalogueMessages(bucket, 'zz', join(dir, 'missing.json'))).toEqual([]);
  });
});
