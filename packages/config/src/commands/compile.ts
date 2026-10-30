import { Command } from '@commander-js/extra-typings';
import { emitCatalogueModule } from '#/features/catalogue/emit.js';
import { resolveConfig } from '#/features/loader/index.js';
import Logger from '#/features/logger.js';
import { normalisePathForLogs } from '#/features/workers/shared.js';

/** The compile step of `extract` on its own, for CI builds and TMS pulls with nothing to extract. */
export default new Command('compile')
  .description('Compile catalogues into locale modules')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .action(async (options) => {
    const config = resolveConfig();
    const logger = new Logger(options);
    logger.header('⚙ Compiling Catalogues');

    for (const bucket of config.buckets) {
      logger.info(`Compiling ${config.locales.length} locale(s): ${bucket.include}`);

      for (const locale of config.locales) {
        const { path, count } = await emitCatalogueModule(config, bucket, locale);
        logger.step(`Wrote ${count} message(s) to ${normalisePathForLogs(path)}`);
      }
    }

    logger.success('Catalogues compiled');
  });
