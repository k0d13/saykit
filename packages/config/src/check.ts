import { messageKey, readCatalogue, readText } from './catalogue/index.js';
import type { Bucket, Resolved } from './config/resolve.js';
import type { Message } from './config/schema.js';
import { bucketExtractor } from './extract.js';

export interface CheckOptions {
  /** Also fail on source messages a non-source locale has no translation for */
  untranslated?: boolean;
  /** Also fail on non-source entries the source no longer has, which `clean` would remove */
  orphaned?: boolean;
}

/** A catalogue that is out of date. Lists that do not apply to its locale are empty. */
export interface CheckResult {
  bucket: Bucket;
  locale: string;
  /** The catalogue file */
  path: string;
  /** Extraction would write the file: create it, or rewrite the source locale's */
  stale: boolean;
  /** Source messages extraction would add */
  added: Message[];
  /** Source messages extraction would remove */
  removed: Message[];
  /** Source messages kept under the same key whose text or metadata would change */
  updated: Message[];
  /** With `untranslated`: source messages missing, empty or fuzzy in this locale */
  untranslated: Message[];
  /** With `orphaned`: entries in this locale whose key the source no longer has */
  orphaned: Message[];
}

const byKey = (messages: Message[]) => new Map(messages.map((m) => [messageKey(m), m]));

/** What a catalogue round-trip is expected to keep, for spotting an updated entry. */
const fingerprint = (m: Message) =>
  JSON.stringify([
    m.message,
    m.context,
    [...(m.comments ?? [])].sort(),
    [...(m.references ?? [])].sort(),
  ]);

const isTranslated = (m: Message | undefined) =>
  Boolean(m?.translation) && !m!.flags?.includes('fuzzy');

/**
 * Extract in memory and compare against the catalogues on disk, writing nothing. Non-source
 * locales are judged against the freshly extracted source, as they would be after `extract`.
 *
 * @returns Only the catalogues that are out of date, so an empty array means all is well
 */
export async function check(config: Resolved, options: CheckOptions = {}): Promise<CheckResult[]> {
  const perBucket = await Promise.all(
    config.buckets.map(async (bucket) => {
      const extractor = bucketExtractor(config, bucket);
      await extractor.scan();
      const source = extractor.messages();
      const sourceKeys = byKey(source);

      return config.locales.map((locale): CheckResult => {
        const path = bucket.cataloguePath(locale);
        const content = readText(path);
        const existing = readCatalogue(bucket, locale);
        const existingKeys = byKey(existing);
        const result: CheckResult = {
          bucket,
          locale,
          path,
          stale: false,
          added: [],
          removed: [],
          updated: [],
          untranslated: [],
          orphaned: [],
        };

        if (locale === config.sourceLocale) {
          const expected = bucket.formatter.stringify(source, {
            locale,
            existingContent: content,
          });
          result.stale = content !== expected;
          if (!result.stale) return result;
          // Compare what the file would hold, not the raw extraction, since a formatter may drop
          // comments or references and every kept entry would otherwise look updated
          const written = byKey(bucket.formatter.parse(expected));
          for (const [key, message] of sourceKeys) {
            const before = existingKeys.get(key);
            const after = written.get(key) ?? message;
            if (!before) result.added.push(message);
            else if (fingerprint(before) !== fingerprint(after)) result.updated.push(message);
          }
          result.removed = existing.filter((m) => !sourceKeys.has(messageKey(m)));
          return result;
        }

        // Extraction only creates a missing non-source file, never edits one
        result.stale = content === undefined;
        if (options.untranslated)
          result.untranslated = source.filter(
            (m) => !isTranslated(existingKeys.get(messageKey(m))),
          );
        if (options.orphaned)
          result.orphaned = existing.filter((m) => !sourceKeys.has(messageKey(m)));
        return result;
      });
    }),
  );

  return perBucket
    .flat()
    .filter((r) => r.stale || r.untranslated.length > 0 || r.orphaned.length > 0);
}
