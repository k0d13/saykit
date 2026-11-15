import { existsSync } from 'node:fs';
import { glob, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { messageKey, writeCatalogue } from './catalogue/index.js';
import { compileBucket } from './compile.js';
import { type Bucket, type Resolved, toId } from './config/resolve.js';
import type { Message } from './config/schema.js';
import { logger } from './logger.js';
import { watchDirectory } from './watch.js';

/**
 * Expand a bucket's include and exclude patterns into a flat list of files.
 *
 * We stat each match instead of using `glob`'s `withFileTypes` option, which
 * Bun's `node:fs/promises` compatibility layer does not yet support.
 */
async function globBucket(root: string, bucket: Bucket) {
  const paths: string[] = [];
  const options = { cwd: root, exclude: [...bucket.exclude] };
  for await (const match of glob([...bucket.include], options)) {
    const path = join(root, match);
    try {
      if ((await stat(path)).isFile()) paths.push(path);
    } catch (error) {
      // Ignore files removed between glob and stat, rethrow anything else
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return paths;
}

const unique = (items: string[]) => [...new Set(items)];

/** Merge by key, unioning comments and references; the first occurrence's metadata wins. */
function merge(messages: Message[]) {
  const merged = new Map<string, Message>();
  for (const message of messages) {
    const key = messageKey(message);
    const existing = merged.get(key) ?? message;
    merged.set(key, {
      ...existing,
      comments: unique([...existing.comments, ...message.comments]),
      references: unique([...existing.references, ...message.references]),
    });
  }
  return [...merged.values()];
}

export function bucketExtractor(config: Resolved, bucket: Bucket) {
  const byFile = new Map<string, Message[]>();
  const id = (path: string) => toId(config.root, path);

  /** @returns Whether the file's contribution changed */
  async function index(path: string) {
    const code = await readFile(path, 'utf8').catch(() => '');
    // References are relative to the config folder, so a catalogue reads the same wherever the
    // CLI is run from
    const messages = code
      ? bucket.transformer.extract(code, path).map((message) => ({
          ...message,
          translation: message.translation ?? message.message,
          references: message.references.map(id),
        }))
      : [];

    if (!messages.length) {
      if (!byFile.delete(path)) return false;
      logger().step(`Removed stale entries for ${id(path)}`);
      return true;
    }
    byFile.set(path, messages);
    logger().step(`Found ${messages.length} message(s) in ${id(path)}`);
    return true;
  }

  // Config-declared messages lead so their hand-written metadata wins the
  // merge; extracted occurrences of the same id only contribute references
  const messages = () => merge([...bucket.messages, ...[...byFile.values()].flat()]);

  function write() {
    const merged = messages();

    // Extraction only ever writes the source locale's messages. Non-source
    // locales are owned by the TMS, so we never add, change, or remove their
    // strings here, doing so produces huge diffs and destroys orphaned
    // translations the TMS is responsible for cleaning up
    logger().info(`Writing ${merged.length} messages to ${config.sourceLocale}`);
    writeCatalogue(bucket, config.sourceLocale, merged);

    // Bootstrap any locale that does not have a file yet with a minimal,
    // message-less catalogue (just a header) so a TMS like Weblate can register
    // the locale. Existing non-source files are left completely untouched
    for (const locale of config.locales.slice(1)) {
      if (existsSync(bucket.cataloguePath(locale))) continue;
      logger().step(`Creating empty locale file for ${locale}`);
      writeCatalogue(bucket, locale, []);
    }

    compileBucket(config, bucket);
  }

  async function scan() {
    logger().info(`Scanning bucket: ${bucket.include}`);
    const paths = await globBucket(config.root, bucket);
    await Promise.all(paths.map(index));
    logger().step(`Found ${paths.length} file(s)`);
  }

  return { index, scan, messages, write };
}

/**
 * Scan sources, write the source locale, bootstrap missing locales, then compile. With `watch`
 * it keeps going: a changed catalogue recompiles only, since extraction writes just the source
 * locale; a changed included source is re-extracted and the source catalogue rewritten if changed.
 */
export async function extract(config: Resolved, options: { watch?: boolean } = {}) {
  const extractors = config.buckets.map((bucket) => ({
    bucket,
    ...bucketExtractor(config, bucket),
  }));
  await Promise.all(
    extractors.map(async (e) => {
      await e.scan();
      e.write();
    }),
  );
  logger().success('Extraction complete');
  if (!options.watch) return;

  logger().header('👀 Watching for changes');
  watchDirectory(
    config.root,
    async (path) => {
      for (const { bucket, index, write } of extractors) {
        // Checked first, since a broad `include` can match the catalogues too, and
        // extracting from one finds nothing to recompile for
        if (bucket.isCatalogue(path)) compileBucket(config, bucket);
        else if (bucket.includes(path) && (await index(path))) write();
      }
    },
    true,
  );
  await new Promise<never>(() => {});
}
