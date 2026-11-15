import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Bucket } from '#/config/resolve.js';
import type { Message } from '#/config/schema.js';
import { generateHash } from '#/messages/hash.js';

/** The key a message is stored under: its id, or a hash of what makes it unique. */
export function messageKey(message: Pick<Message, 'id' | 'message' | 'context'>) {
  return message.id ?? generateHash(message.message, message.context);
}

export function readText(path: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

export function readCatalogue(bucket: Bucket, locale: string) {
  const content = readText(bucket.cataloguePath(locale));
  return content ? bucket.formatter.parse(content) : [];
}

/** @returns Whether the catalogue changed on disk */
export function writeCatalogue(bucket: Bucket, locale: string, messages: Message[]) {
  const path = bucket.cataloguePath(locale);
  const existingContent = readText(path);
  mkdirSync(dirname(path), { recursive: true });
  // No `.d.ts` here: the app imports the generated module, not the catalogue
  return writeFileIfChanged(
    path,
    bucket.formatter.stringify(messages, { locale, existingContent }),
  );
}

/**
 * Assemble a `{ key: string }` record from catalogue file contents, most specific locale first:
 * more specific locales override their fallbacks, and any key still untranslated falls back to
 * its source message.
 */
export function assembleRecord(bucket: Bucket, contents: (string | undefined)[]) {
  const record: Record<string, string> = {};

  // Apply least specific first so the most specific locale wins each key
  for (const content of [...contents].reverse()) {
    if (!content) continue;
    for (const message of bucket.formatter.parse(content)) {
      const key = messageKey(message);

      // A real translation always wins, so the most specific locale that has
      // one decides the key. A fuzzy one is a guess awaiting review, so, as
      // gettext's own tools do, it counts as untranslated
      if (message.translation && !message.flags?.includes('fuzzy')) {
        record[key] = message.translation;
        continue;
      }

      // Otherwise this locale is untranslated for the key. PO still carries the
      // source text in `msgid`, and JSON reports the key as empty entirely, but
      // neither may displace a translation already applied from a less specific
      // locale, only fill a key nothing has answered yet
      if (!record[key] && message.message) record[key] = message.message;
    }
  }

  return record;
}

/**
 * Write a file only if its content would change, and never leave it half written.
 *
 * Skipping an unchanged write keeps a dev server and `extract --watch` from reloading each other.
 * Writing through a rename means two processes compiling at once, as Next's workers do, never
 * hand a bundler a truncated module.
 *
 * @returns Whether the file was written
 */
export function writeFileIfChanged(path: string, content: string) {
  if (readText(path) === content) return false;

  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(temporary, content);

  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temporary, path);
      return true;
    } catch (error) {
      // Windows refuses to replace a file another process has open. If that process wrote the
      // same content, there is nothing left to do
      if (readText(path) === content) {
        rmSync(temporary, { force: true });
        return false;
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(code!)) {
        rmSync(temporary, { force: true });
        throw error;
      }
      // Block for a few milliseconds, since the retry has to stay synchronous
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * 2 ** attempt);
    }
  }
}
