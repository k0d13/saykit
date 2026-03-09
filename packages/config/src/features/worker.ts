import { join, relative } from 'node:path';
import type { Bucket, Configuration, Message } from '~/shapes.js';
import { hydrateTranslations, writeTranslationsToDisk } from './compile.js';
import {
  extractMessages,
  mergeMessages,
  readMessagesFromDisk,
  reconcileMessages,
  writeMessagesToDisk,
} from './extract.js';
import type Logger from './logger.js';
import { globBucket, watchDebounced } from './watch.js';

function normalisePath(path: string) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

abstract class BucketWorker {
  protected config: Configuration;
  protected bucket: Bucket;
  protected logger: Logger;

  constructor(config: Configuration, bucket: Bucket, logger: Logger) {
    this.config = config;
    this.bucket = bucket;
    this.logger = logger;
  }
}

export class BucketExtractWorker extends BucketWorker {
  private index = new Map<string, Message[]>();
  private get messages(): Message[] {
    return Array.from(this.index.values()).flat();
  }

  private async indexPath(path: string) {
    const rp = normalisePath(path);
    this.logger.step(`Processing ${rp}`);
    const messages = await extractMessages(path);
    if (!messages.length) return false;
    this.index.set(path, messages);
    this.logger.step(`Found ${messages.length} messages(s) in ${rp}`);
    return true;
  }

  async scanAll() {
    this.logger.info(`Scanning bucket: ${this.bucket.include}`);
    const paths = await globBucket(this.bucket);
    this.logger.step(`Found ${paths.length} file(s)`);
    for (const path of paths) await this.indexPath(path);
    this.logger.info(`Total extracted messages: ${this.messages.length}`);
  }

  async writeAll() {
    const newMessages = mergeMessages(this.messages);
    this.logger.info(`Writing ${newMessages.length} messages to locales`);

    for (const locale of this.config.locales) {
      this.logger.step(`Writing locale file for ${locale} to disk`);
      const existingMessages = await readMessagesFromDisk(this.bucket, locale);
      const updatedMessages =
        locale === this.config.sourceLocale
          ? newMessages
          : reconcileMessages(existingMessages, newMessages);

      await writeMessagesToDisk(this.bucket, locale, updatedMessages);
    }
    this.logger.success(`Extraction complete for bucket: ${this.bucket.include}`);
  }

  async updatePath(path: string) {
    const changed = await this.indexPath(path);
    if (changed) await this.writeAll();
    return changed;
  }
}

export class BucketCompileWorker extends BucketWorker {
  private cache = new Map<string, Record<string, string>>();

  async compileAll() {
    this.logger.info(`Compiling bucket: ${this.bucket.include}`);
    for (const locale of this.config.locales) await this.compileLocale(locale);
    this.logger.success(`Compilation complete for bucket: ${this.bucket.include}`);
  }

  async compileLocale(locale: string) {
    this.logger.step(`Compiling locale: ${locale}`);
    const messages = await readMessagesFromDisk(this.bucket, locale);
    const translations = await hydrateTranslations(
      this.cache,
      this.config,
      this.bucket,
      locale,
      messages,
    );
    this.logger.step(`Writing runtime file for ${locale}`);
    await writeTranslationsToDisk(this.bucket, locale, translations);
  }
}

export class BucketBuildWorker extends BucketWorker {
  extract: BucketExtractWorker;
  compile: BucketCompileWorker;

  constructor(config: Configuration, bucket: Bucket, logger: Logger) {
    super(config, bucket, logger);
    this.extract = new BucketExtractWorker(config, bucket, logger);
    this.compile = new BucketCompileWorker(config, bucket, logger);
  }

  async buildAll() {
    await this.extract.scanAll();
    await this.extract.writeAll();
    await this.compile.compileAll();
  }

  async watch() {
    this.logger.header(`👀 Watching bucket for changes: ${this.bucket.include}`);

    for await (const event of watchDebounced('.', { recursive: true })) {
      if (!event.filename || !this.bucket.match(event.filename)) continue;

      const filePath = join(process.cwd(), event.filename);
      const changed = await this.extract.updatePath(filePath);
      if (changed) {
        this.logger.info(`Recompiling due to changes in ${normalisePath(filePath)}`);
        await this.compile.compileAll();
      }
    }
  }
}
