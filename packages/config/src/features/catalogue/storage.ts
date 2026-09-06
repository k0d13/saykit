import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Bucket, Message } from '#/shapes.js';
import { expandBucketOutputPath } from './path.js';

export async function readCatalogueMessages(
  bucket: Bucket,
  locale: string,
  path = expandBucketOutputPath(bucket, locale),
) {
  const content = await readFile(path, 'utf8').catch(() => '');
  if (!content) return [];
  return bucket.formatter.parse(content);
}

export async function writeCatalogueMessages(
  bucket: Bucket,
  locale: string,
  messages: Message[],
  path = expandBucketOutputPath(bucket, locale),
) {
  const existingContent = await readFile(path, 'utf8').catch(() => undefined);
  const catalogueContent = bucket.formatter.stringify(messages, { locale, existingContent });

  // No declaration beside it: a catalogue is what a translator edits, not what
  // the app imports. The generated module carries that, and its own `.d.ts`
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, catalogueContent);
}
