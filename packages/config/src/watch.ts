import { mkdirSync, watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileBucket } from './compile.js';
import type { Resolved } from './config/resolve.js';
import { logger } from './logger.js';

/**
 * Watch a directory recursively, calling `onChange` once a path has been quiet for `delay` ms.
 * Failures in `onChange` are logged, so a catalogue caught mid-edit never kills the watcher.
 *
 * @param keepAlive Whether the watcher holds the process open. Off, it never outlives its owner.
 * @returns A function that stops watching
 */
export function watchDirectory(
  root: string,
  onChange: (path: string) => void | Promise<void>,
  keepAlive = false,
  delay = 50,
) {
  mkdirSync(root, { recursive: true });
  const timers = new Map<string, NodeJS.Timeout>();

  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const path = join(root, filename);
    clearTimeout(timers.get(path));
    const timer = setTimeout(async () => {
      timers.delete(path);
      try {
        await onChange(path);
      } catch (error) {
        logger().error(error);
      }
    }, delay);
    timers.set(path, keepAlive ? timer : timer.unref());
  });
  watcher.on('error', (error) => logger().error(error));
  if (!keepAlive) watcher.unref();

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    watcher.close();
  };
}

/**
 * Recompile a bucket whenever one of its catalogues changes, so editing `en.po` rewrites `fr.js`
 * and the bundler sees an ordinary module change.
 *
 * Each bucket is watched from the directory its catalogues all sit under, its output up to the
 * first placeholder: `src/locales/{locale}.po` gives `src/locales`, and
 * `_locales/{locale}/messages.json` gives `_locales`.
 */
export function watchCatalogues(config: Resolved) {
  const stops = config.buckets.map((bucket) => {
    const prefix = bucket.output.slice(0, bucket.output.indexOf('{'));
    const root = resolve(config.root, /[\\/]$/.test(prefix) ? prefix : dirname(prefix));
    return watchDirectory(root, (path) => {
      if (bucket.isCatalogue(path)) compileBucket(config, bucket);
    });
  });
  return () => stops.forEach((stop) => stop());
}
