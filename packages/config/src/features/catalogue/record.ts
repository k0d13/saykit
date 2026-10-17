import { resolve } from 'node:path';
import { generateHash } from '#/features/messages/hash.js';
import type { Bucket, Config } from '#/shapes.js';
import { expandBucketOutputPath } from './path.js';

/**
 * Resolve the fallback chain for a locale, most specific first. The source
 * locale (the first configured locale) is always the final fallback, so an
 * untranslated key ultimately resolves to the source string.
 */
export function resolveFallbackChain(config: Config, locale: string) {
  const source = config.locales[0];
  const configured = config.fallbackLocales?.[locale];
  const fallbacks = configured ? (Array.isArray(configured) ? configured : [configured]) : [];
  return Array.from(new Set([locale, ...fallbacks, source]));
}

/**
 * Resolve the catalogue files that contribute to a locale module, most specific
 * first. When the path does not map to a configured locale it is loaded on its
 * own.
 */
export function resolveCatalogueSources(config: Config, bucket: Bucket, path: string) {
  const resolved = resolve(path);
  const locale = config.locales.find((l) => expandBucketOutputPath(bucket, l) === resolved);
  const sources = locale
    ? resolveFallbackChain(config, locale).map((l) => expandBucketOutputPath(bucket, l))
    : [resolved];
  return { locale, sources };
}

/**
 * Assemble a `{ id: string }` record from catalogue file contents. `contents`
 * must be aligned with the `sources` returned by {@link resolveCatalogueSources}
 * (most specific first): more specific locales override their fallbacks, and any
 * key still untranslated falls back to its source message.
 */
export function assembleCatalogueRecord(bucket: Bucket, contents: string[]) {
  const record: Record<string, string> = {};

  // Apply least specific first so the most specific locale wins each key
  for (const content of [...contents].reverse()) {
    if (!content) continue;
    for (const message of bucket.formatter.parse(content)) {
      const key = message.id || generateHash(message.message, message.context);

      // A real translation always wins, so the most specific locale that has
      // one decides the key
      if (message.translation) {
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
