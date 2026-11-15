import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { assembleRecord, readText, writeFileIfChanged } from './catalogue/index.js';
import { DECLARATION, generateModule, modulePath } from './catalogue/module.js';
import { type Bucket, type Resolved, toId } from './config/resolve.js';
import { logger } from './logger.js';

export interface CompiledModule {
  bucket: Bucket;
  locale: string;
  /** The generated `.js` module */
  path: string;
  /** Catalogue files read for it, most specific first, for a bundler's `addWatchFile` */
  sources: string[];
  count: number;
  written: boolean;
}

/**
 * Compile one locale's catalogue, and its fallbacks, into a module on disk.
 *
 * The fallback chain is merged here, so the app still imports one module per locale. Synchronous,
 * so a bundler config can compile while it is evaluated, before the bundler asks for the module.
 */
function compileLocale(config: Resolved, bucket: Bucket, locale: string): CompiledModule {
  const sources = config.fallbackChain(locale).map((l) => bucket.cataloguePath(l));
  const record = assembleRecord(bucket, sources.map(readText));
  const path = modulePath(bucket, locale);

  mkdirSync(dirname(path), { recursive: true });
  const written = writeFileIfChanged(path, generateModule(record));
  writeFileIfChanged(path.replace(/\.js$/, '.d.ts'), DECLARATION);

  const count = Object.keys(record).length;
  const file = toId(config.root, path);
  logger().step(written ? `Wrote ${count} message(s) to ${file}` : `${file} is up to date`);
  return { bucket, locale, path, sources, count, written };
}

/** Every locale of a bucket, since each one merges its fallbacks and so all are redone. */
export const compileBucket = (config: Resolved, bucket: Bucket) =>
  config.locales.map((locale) => compileLocale(config, bucket, locale));

export const compile = (config: Resolved) =>
  config.buckets.flatMap((bucket) => compileBucket(config, bucket));

export const fileChanged = (config: Resolved, path: string) =>
  config.buckets.filter((b) => b.isCatalogue(path)).flatMap((b) => compileBucket(config, b));
