import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import type { Bucket, Message } from '~/shapes.js';

export async function extractMessagesFromFile(path: string, bucket: Bucket): Promise<Message[]> {
  const content = await readFile(path, 'utf8').catch(() => '');
  if (!content) return [];

  Error.stackTraceLimit = Infinity;
  const messages = await bucket.transformer.extract(path, content);
  return messages.map((message) => ({
    ...message,
    translation: message.translation ?? message.message,
    references: message.references.map((reference) =>
      relative(process.cwd(), reference).replaceAll('\\', '/'),
    ),
  }));
}
