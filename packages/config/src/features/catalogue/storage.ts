import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Bucket, Message } from '#/shapes.js';
import { declarationPathFor, expandBucketOutputPath } from './path.js';

const DECLARATION_CONTENT = `
declare const messages: Record<string, string>;
export default messages;
`.trimStart();

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
  const declarationPath = declarationPathFor(path);

  await mkdir(dirname(path), { recursive: true });
  await Promise.all([
    writeFile(path, catalogueContent),
    writeFile(declarationPath, DECLARATION_CONTENT),
  ]);
}
