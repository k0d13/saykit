import { messageKey, readCatalogue, writeCatalogue } from './catalogue/index.js';
import type { Bucket, Resolved } from './config/resolve.js';
import { logger } from './logger.js';

export interface CleanResult {
  bucket: Bucket;
  locale: string;
  removed: number;
}

/**
 * Cleaning only ever subtracts. Entries are dropped when the source no longer has the key
 * (orphans) or when they carry no translation (dead weight, the loader falls back to the source
 * string anyway). Source keys missing from a locale are deliberately *not* added, that's the
 * TMS's job
 */
export function clean(config: Resolved): CleanResult[] {
  return config.buckets.flatMap((bucket) => {
    const keys = new Set(readCatalogue(bucket, config.sourceLocale).map(messageKey));
    return config.locales.slice(1).map((locale) => {
      const existing = readCatalogue(bucket, locale);
      const kept = existing.filter((m) => keys.has(messageKey(m)) && m.translation);
      writeCatalogue(bucket, locale, kept);
      const removed = existing.length - kept.length;
      logger().step(`Removed ${removed} entries from ${locale}`);
      return { bucket, locale, removed };
    });
  });
}
