import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Message } from '#/shapes.js';
import { emitCatalogueModule } from '../catalogue/emit';
import { extractMessagesFromFile } from '../catalogue/extractor';
import { mergeExtractedMessages } from '../catalogue/merge';
import { expandBucketOutputPath } from '../catalogue/path';
import { writeCatalogueMessages } from '../catalogue/storage';
import { globBucket, watchDebounced } from '../watch';
import { BucketWorker, normalisePathForLogs } from './shared';

function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
  );
}

export class BucketExtractWorker extends BucketWorker {
  #indexedMessagesByPath = new Map<string, Message[]>();
  get #indexedMessages() {
    // Config-declared messages lead so their hand-written metadata wins the
    // merge; extracted occurrences of the same id only contribute references
    return [...this.bucket.messages, ...Array.from(this.#indexedMessagesByPath.values()).flat()];
  }

  async #indexPath(path: string) {
    const relativePath = normalisePathForLogs(path);
    this.logger.step(`Processing ${relativePath}`);

    const messages = await extractMessagesFromFile(path, this.bucket);
    if (!messages.length) {
      if (this.#indexedMessagesByPath.has(path)) {
        this.#indexedMessagesByPath.delete(path);
        this.logger.step(`Removed stale entries for ${relativePath}`);
        return true;
      }
      return false;
    }

    this.#indexedMessagesByPath.set(path, messages);
    this.logger.step(`Found ${messages.length} message(s) in ${relativePath}`);
    return true;
  }

  async scan() {
    this.logger.info(`Scanning bucket: ${this.bucket.include}`);

    const paths = await globBucket(this.bucket);
    this.logger.step(`Found ${paths.length} file(s)`);
    if (this.bucket.messages.length)
      this.logger.step(
        `Including ${this.bucket.messages.length} message(s) declared in the config`,
      );
    await Promise.all(paths.map((p) => this.#indexPath(p)));

    const extracted = Array.from(this.#indexedMessagesByPath.values()).flat().length;
    this.logger.info(`Total extracted messages: ${extracted}`);
  }

  async write() {
    const mergedMessages = mergeExtractedMessages(this.#indexedMessages);
    const [sourceLocale, ...otherLocales] = this.config.locales;

    // Extraction only ever writes the source locale's messages. Non-source
    // locales are owned by the TMS, so we never add, change, or remove their
    // strings here, doing so produces huge diffs and destroys orphaned
    // translations the TMS is responsible for cleaning up
    this.logger.info(`Writing ${mergedMessages.length} messages to ${sourceLocale}`);
    this.logger.step(`Writing locale file for ${sourceLocale} to disk`);
    await writeCatalogueMessages(this.bucket, sourceLocale, mergedMessages);

    // Bootstrap any locale that does not have a file yet with a minimal,
    // message-less catalogue (just a header) so a TMS like Weblate can register
    // the locale. Existing non-source files are left completely untouched
    for (const locale of otherLocales) {
      const path = expandBucketOutputPath(this.bucket, locale);
      if (await exists(path)) {
        this.logger.step(`Skipping existing locale file for ${locale}`);
        continue;
      }

      this.logger.step(`Creating empty locale file for ${locale}`);
      await writeCatalogueMessages(this.bucket, locale, []);
    }

    await this.compile();

    this.logger.success(`Extraction complete for bucket: ${this.bucket.include}`);
  }

  /** Compile every locale's catalogue into the module the app imports. */
  async compile() {
    for (const locale of this.config.locales) {
      const { path, count } = await emitCatalogueModule(this.config, this.bucket, locale);
      this.logger.step(`Compiled ${count} message(s) to ${normalisePathForLogs(path)}`);
    }
  }

  async update(path: string) {
    const changed = await this.#indexPath(path);
    if (changed) await this.write();
    return changed;
  }

  async watch() {
    this.logger.header(`👀 Watching bucket for changes: ${this.bucket.include}`);

    for await (const event of watchDebounced('.', { recursive: true })) {
      if (!event.filename) continue;
      const path = join(process.cwd(), event.filename);

      if (this.bucket.match(event.filename)) {
        await this.update(path);
        continue;
      }

      // A translation changed, not a call site: recompile only, since extraction writes just the
      // source locale
      if (this.bucket.output.match(event.filename)) await this.compile();
    }
  }
}
