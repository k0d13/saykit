import { type FSWatcher, mkdirSync, watch } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Bucket, Config } from '#/shapes.js';
import { emitCatalogueModuleSync } from './emit.js';
import { expandBucketOutputPath } from './path.js';

/** Every catalogue a config reads, one per bucket and locale, as absolute paths. */
export function listCataloguePaths(config: Config) {
  return config.buckets.flatMap((bucket) =>
    config.locales.map((locale) => expandBucketOutputPath(bucket, locale)),
  );
}

/** The buckets a path is a catalogue of, if any. */
export function findCatalogueBuckets(config: Config, path: string) {
  const id = relative(process.cwd(), resolve(path)).replaceAll('\\', '/');
  return config.buckets.filter((bucket) => bucket.output.match(id));
}

/** Compile every locale of one bucket. Each locale merges its fallbacks, so all of them are redone. */
export function compileBucketSync(config: Config, bucket: Bucket) {
  return config.locales.map((locale) => emitCatalogueModuleSync(config, bucket, locale));
}

/** Compile every bucket and locale into the modules the app imports, skipping unchanged writes. */
export function compileCataloguesSync(config: Config) {
  return config.buckets.flatMap((bucket) => compileBucketSync(config, bucket));
}

/**
 * The directory a bucket's catalogues all sit under: its output up to the first placeholder.
 *
 * `src/locales/{locale}.po` gives `src/locales`, and `_locales/{locale}/messages.json` gives
 * `_locales`, so one recursive watch covers every locale.
 */
function catalogueRoot(bucket: Bucket) {
  const prefix = bucket.output.slice(0, bucket.output.indexOf('{'));
  return resolve(/[\\/]$/.test(prefix) ? prefix : dirname(prefix));
}

export interface WatchCataloguesOptions {
  /** Called when a recompile fails, a catalogue mid-edit, say. Defaults to `console.error`. */
  onError?: (error: unknown) => void;
  /** Milliseconds of quiet after a change before recompiling. */
  delay?: number;
}

/**
 * Recompile a bucket whenever one of its catalogues changes, so editing `en.po` rewrites `fr.js`
 * and the bundler sees an ordinary module change.
 *
 * The watchers are unreferenced, so they never keep a process alive on their own.
 *
 * @returns A function that stops watching
 */
export function watchCatalogues(config: Config, options: WatchCataloguesOptions = {}) {
  const { onError = (error) => console.error('[saykit] Failed to compile catalogues', error) } =
    options;
  const delay = options.delay ?? 50;

  const watchers: FSWatcher[] = [];
  const timers = new Map<Bucket, NodeJS.Timeout>();

  for (const bucket of config.buckets) {
    const root = catalogueRoot(bucket);
    mkdirSync(root, { recursive: true });

    const watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (!filename || !findCatalogueBuckets(config, join(root, filename)).includes(bucket)) return;

      clearTimeout(timers.get(bucket));
      timers.set(
        bucket,
        setTimeout(() => {
          timers.delete(bucket);
          try {
            compileBucketSync(config, bucket);
          } catch (error) {
            onError(error);
          }
        }, delay).unref(),
      );
    });
    watcher.on('error', onError);
    watcher.unref();
    watchers.push(watcher);
  }

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
  };
}
