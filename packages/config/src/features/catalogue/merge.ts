import { generateHash } from '~/features/messages/hash.js';
import type { Message } from '~/shapes.js';

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

export function reconcileLocaleMessages(existingMessages: Message[], nextMessages: Message[]) {
  const existingMessagesByKey = existingMessages.reduce((map, message) => {
    map.set(getMessageKey(message), message);
    return map;
  }, new Map<string, Message>());

  const reconciledMessages = nextMessages.reduce((map, message) => {
    const key = getMessageKey(message);
    const existingMessage = existingMessagesByKey.get(key);

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

  return Array.from(reconciledMessages.values());
}
