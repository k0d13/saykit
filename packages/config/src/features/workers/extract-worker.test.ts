import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Logger from '#/features/logger.js';
import type { Bucket, Config, Message } from '#/shapes.js';

vi.mock('../catalogue/extractor', () => ({ extractMessagesFromFile: vi.fn() }));

const { extractMessagesFromFile } = await import('../catalogue/extractor');
const { BucketExtractWorker } = await import('./extract-worker.js');

const msg = (m: Partial<Message> & { message: string }): Message => ({
  comments: [],
  references: [],
  ...m,
});

const logger = new Logger({ quiet: true });

let dir: string;
let bucket: Bucket;
let config: Config;

const localePath = (locale: string) => join(dir, locale, 'messages.json');
const readLocale = (locale: string) =>
  JSON.parse(readFileSync(localePath(locale), 'utf8')) as Message[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'saykit-extract-'));
  bucket = {
    include: ['src/**/*.ts'],
    messages: [],
    match: (id: string) => id.endsWith('.ts'),
    output: Object.assign(join(dir, '{locale}', 'messages.{extension}'), {
      match: (id: string) => id.endsWith('messages.json'),
    }),
    formatter: {
      extension: '.json',
      parse: (content: string) => JSON.parse(content) as Message[],
      stringify: (messages: Message[]) => JSON.stringify(messages),
    },
  } as unknown as Bucket;
  config = { locales: ['en', 'fr', 'de'], buckets: [bucket] } as unknown as Config;
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function extract(messages: Message[]) {
  vi.mocked(extractMessagesFromFile).mockResolvedValue(messages);
  const worker = new BucketExtractWorker(config, bucket, logger);
  // `update` indexes the (mocked) file then triggers `write`
  await worker.update(join(dir, 'src', 'app.ts'));
}

describe('BucketExtractWorker.write', () => {
  it('writes the extracted messages to the source locale', async () => {
    await extract([
      msg({ message: 'Hello', id: 'greeting' }),
      msg({ message: 'Bye', id: 'farewell' }),
    ]);

    expect(readLocale('en').map((m) => m.id)).toEqual(
      expect.arrayContaining(['greeting', 'farewell']),
    );
  });

  it('writes messages declared on the bucket even when no file yields them', async () => {
    bucket.messages = [msg({ id: 'extensionName', message: 'Reading Time' })];

    await extract([msg({ message: 'Hello', id: 'greeting' })]);

    expect(readLocale('en').map((m) => m.id)).toEqual(
      expect.arrayContaining(['extensionName', 'greeting']),
    );
  });

  it('keeps a declared message authoritative when source also extracts its id', async () => {
    bucket.messages = [
      msg({ id: 'extensionName', message: 'Reading Time', comments: ['The name'] }),
    ];

    await extract([
      msg({ id: 'extensionName', message: 'Extracted Name', references: ['src/app.ts:1'] }),
    ]);

    const entries = readLocale('en');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe('Reading Time');
    expect(entries[0]?.comments).toEqual(['The name']);
    // The call site still contributes its reference
    expect(entries[0]?.references).toEqual(['src/app.ts:1']);
  });

  it('creates a header-only file for a locale that does not exist yet', async () => {
    await extract([msg({ message: 'Hello', id: 'greeting' })]);

    expect(readLocale('de')).toEqual([]);
    expect(existsSync(join(dir, 'de', 'messages.d.json.ts'))).toBe(true);
  });

  it('leaves an existing non-source locale completely untouched', async () => {
    const frPath = localePath('fr');
    mkdirSync(dirname(frPath), { recursive: true });
    const original = JSON.stringify([
      { message: 'Old', id: 'orphan', translation: 'Vieux', comments: [], references: [] },
    ]);
    writeFileSync(frPath, original);

    await extract([msg({ message: 'Hello', id: 'greeting' })]);

    // No additions, and the orphaned string is not stripped
    expect(readFileSync(frPath, 'utf8')).toBe(original);
  });
});
