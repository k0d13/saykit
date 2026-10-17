import type { PathLike } from 'node:fs';
import {
  type FileChangeInfo,
  glob,
  stat,
  type WatchOptionsWithStringEncoding,
  watch,
} from 'node:fs/promises';
import type { Bucket } from '#/shapes.js';

/**
 * Expand a buckets include and exclude patterns into a flat list of file paths.
 *
 * We stat each match instead of using `glob`'s `withFileTypes` option, which
 * Bun's `node:fs/promises` compatibility layer does not yet support.
 */
export async function globBucket(bucket: Bucket) {
  const paths: string[] = [];
  for await (const path of glob(bucket.include, { exclude: bucket.exclude })) {
    try {
      if ((await stat(path)).isFile()) {
        paths.push(path);
      }
    } catch (error) {
      // Ignore files removed between glob and stat, rethrow anything else
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return paths;
}

/**
 * Watches a path for changes, emitting a debounced event every set delay.
 *
 * Unlike Node's native `fs.watch` method, this:
 *  - coalesces rapid consecutive events per file
 *  - emits only the final event after `delay` ms of inactivity
 *  - deduplicates events by filename
 */
export async function* watchDebounced(
  path: PathLike,
  options?: WatchOptionsWithStringEncoding,
  delay = 300,
) {
  // Active debounce timers per filename, when a new event arrives, the previous timer is cleared
  const timers = new Map<string, NodeJS.Timeout>();
  // Queue of pending debounced events per filename
  const queue = new Map<string, Promise<FileChangeInfo<string>>>();
  // Stores resolvers for queued promises so they can be triggered dynamically
  const resolvers = new Map<string, (value: FileChangeInfo<string>) => void>();

  // Background async loop that listens to native `fs.watch` method
  (async () => {
    for await (const event of watch(path, options)) {
      const key = event.filename ?? '__unknown__';

      if (timers.has(key)) clearTimeout(timers.get(key)!);
      if (!queue.has(key)) queue.set(key, new Promise((r) => resolvers.set(key, r)));

      timers.set(
        key,
        setTimeout(() => {
          resolvers.get(key)?.(event);
          timers.delete(key);
          resolvers.delete(key);
        }, delay),
      );
    }
  })();

  while (true) {
    if (queue.size) {
      const next = await Promise.race(queue.values());
      queue.delete(next.filename ?? '__unknown__');
      yield next;
    } else {
      // Avoid busy loop, yield control briefly
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}
