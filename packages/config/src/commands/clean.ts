import { Command } from '@commander-js/extra-typings';
import { pruneLocaleMessages } from '#/features/catalogue/merge.js';
import { readCatalogueMessages, writeCatalogueMessages } from '#/features/catalogue/storage.js';
import { resolveConfig } from '#/features/loader/index.js';
import Logger from '#/features/logger.js';

export default new Command('clean')
  .description('Remove orphaned and untranslated entries from non-source locale files')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .action(async (options) => {
    const config = resolveConfig();
    const logger = new Logger(options);
    logger.header('🧹 Cleaning Locales');

    const [sourceLocale, ...otherLocales] = config.locales;

    for (const bucket of config.buckets) {
      const sourceMessages = await readCatalogueMessages(bucket, sourceLocale);
      logger.info(`Cleaning ${otherLocales.length} locale(s) against ${sourceLocale}`);

      for (const locale of otherLocales) {
        logger.step(`Cleaning ${locale}`);
        const existingMessages = await readCatalogueMessages(bucket, locale);
        const prunedMessages = pruneLocaleMessages(existingMessages, sourceMessages);
        logger.step(
          `Removed ${existingMessages.length - prunedMessages.length} entries from ${locale}`,
        );
        await writeCatalogueMessages(bucket, locale, prunedMessages);
      }
    }

    logger.success('Locales cleaned');
  });
