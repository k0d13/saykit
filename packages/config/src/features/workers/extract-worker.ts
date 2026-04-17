import { extractMessagesFromFile } from '~/features/catalogue/extractor.js';
import { mergeExtractedMessages, reconcileLocaleMessages } from '~/features/catalogue/merge.js';
import { readCatalogueMessages, writeCatalogueMessages } from '~/features/catalogue/storage.js';
import { globBucket } from '~/features/watch.js';
import type { Message } from '~/shapes.js';
import { BucketWorker, normalisePathForLogs } from './shared.js';

export class BucketExtractWorker extends BucketWorker {
  #indexedMessagesByPath = new Map<string, Message[]>();

  get messages(): Message[] {
    return Array.from(this.#indexedMessagesByPath.values()).flat();
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
    this.logger.step(`Found ${messages.length} messages(s) in ${relativePath}`);
    return true;
  }

  async scanAll() {
    this.logger.info(`Scanning bucket: ${this.bucket.include}`);

    const paths = await globBucket(this.bucket);
    this.logger.step(`Found ${paths.length} file(s)`);
    await Promise.all(paths.map((path) => this.#indexPath(path)));

    this.logger.info(`Total extracted messages: ${this.messages.length}`);
  }

  async writeAll() {
    const mergedMessages = mergeExtractedMessages(this.messages);
    this.logger.info(`Writing ${mergedMessages.length} messages to locales`);

    for (const locale of this.config.locales) {
      this.logger.step(`Writing locale file for ${locale} to disk`);

      const existingMessages = await readCatalogueMessages(this.bucket, locale);
      const nextMessages =
        locale === this.config.sourceLocale
          ? mergedMessages
          : reconcileLocaleMessages(existingMessages, mergedMessages);

      await writeCatalogueMessages(this.bucket, locale, nextMessages);
    }

    this.logger.success(`Extraction complete for bucket: ${this.bucket.include}`);
  }

  async updatePath(path: string) {
    const changed = await this.#indexPath(path);
    if (changed) await this.writeAll();
    return changed;
  }
}
