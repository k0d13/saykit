import { generateHash } from '#/features/messages/hash.js';
import type { Message } from '#/shapes.js';

function mergeUnique<T>(...items: T[]) {
  return Array.from(new Set(items.flat()));
}

function getMessageKey(message: Message) {
  return message.id ?? generateHash(message.message, message.context);
}

export function mergeExtractedMessages(messages: Message[]) {
  const mergedMessages = messages.reduce((map, message) => {
    const key = getMessageKey(message);
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

export function pruneLocaleMessages(existingMessages: Message[], sourceMessages: Message[]) {
  const sourceKeys = new Set(sourceMessages.map(getMessageKey));

  // Cleaning only ever subtracts. Entries are dropped when the source no longer
  // has the key (orphans) or when they carry no translation (dead weight, the
  // loader falls back to the source string anyway). Source keys missing from
  // this locale are deliberately *not* added, that's the TMS's job
  return existingMessages.filter(
    (message) => sourceKeys.has(getMessageKey(message)) && Boolean(message.translation),
  );
}
