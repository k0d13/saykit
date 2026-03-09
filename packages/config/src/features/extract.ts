import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { collectMessages, generateHash } from '@saykit/babel-plugin/core';
import type { Bucket, Message } from '~/shapes.js';

//

export async function extractMessages(path: string): Promise<Message[]> {
  const content = await readFile(path, 'utf8').catch(() => '');
  const messages = collectMessages(path, content);
  return messages.map((m) => ({
    message: m.toICUString(),
    translation: m.toICUString(),
    id: m.descriptor.id,
    context: m.descriptor.context,
    comments: m.comments,
    references: m.references //
      .map((r) => relative(process.cwd(), r).replaceAll('\\', '/')),
  }));
}

function mergeUnique<T>(...items: T[]) {
  return Array.from(new Set(items.flat()));
}

export function mergeMessages(messages: Message[]) {
  const mergedMessages = messages.reduce((map, message) => {
    const key = message.id ?? generateHash(message.message, message.context);
    const existing = map.get(key) ?? message;
    map.set(key, {
      ...existing,
      comments: mergeUnique(...existing.comments, ...message.comments),
      references: mergeUnique(...existing.references, ...message.references),
    });
    return map;
  }, new Map<string, Message>());

  return Array.from(mergedMessages.values());
}

export function reconcileMessages(existingMessages: Message[], newMessages: Message[]) {
  const existingMessagesMap = existingMessages.reduce((map, message) => {
    const key = message.id ?? generateHash(message.message, message.context);
    map.set(key, message);
    return map;
  }, new Map<string, Message>());

  const updatedMessagesMap = newMessages.reduce((map, message) => {
    const key = message.id ?? generateHash(message.message, message.context);
    const existingMessage = existingMessagesMap.get(key);
    map.set(key, {
      message: message.message,
      translation: undefined,
      ...existingMessage,
      id: message.id,
      context: message.context,
      comments: message.comments,
      references: message.references,
    });
    return map;
  }, new Map<string, Message>());

  return Array.from(updatedMessagesMap.values());
}

//

export function expandOutputPath(
  bucket: Bucket,
  locale: string,
  extension = bucket.formatter.extension,
) {
  const outputMessageTemplate = bucket.output
    .replaceAll('{locale}', locale)
    .replaceAll('{extension}', extension);
  return resolve(outputMessageTemplate);
}

export async function readMessagesFromDisk(
  bucket: Bucket,
  locale: string,
  path = expandOutputPath(bucket, locale),
) {
  const content = await readFile(path, 'utf8').catch(() => '');
  if (!content) return [];
  const messages = await bucket.formatter.parse(content, { locale });
  return messages;
}

export async function writeMessagesToDisk(
  bucket: Bucket,
  locale: string,
  messages: Message[],
  path = expandOutputPath(bucket, locale),
) {
  const content = await bucket.formatter.stringify(messages, { locale });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
