import type { PathLike } from 'node:fs';
import {
  type FileChangeInfo,
  glob,
  type WatchOptionsWithStringEncoding,
  watch,
} from 'node:fs/promises';
import { join } from 'node:path';
import type { Bucket } from '~/shapes.js';

/**
 * Expand a buckets include and exclude patterns into a flat list of file paths.
 */
export async function globBucket(bucket: Bucket) {
  const paths: string[] = [];
  for await (const file of glob(bucket.include, {
    exclude: bucket.exclude,
    withFileTypes: true,
  }))
    if (file.isFile()) {
      paths.push(join(file.parentPath, file.name));
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
