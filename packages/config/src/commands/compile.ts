import { Command } from '@commander-js/extra-typings';
import { compileBucketSync } from '#/features/catalogue/compile.js';
import { resolveConfig } from '#/features/loader/index.js';
import Logger from '#/features/logger.js';
import { normalisePathForLogs } from '#/features/workers/shared.js';

/**
 * The compile step of `extract` on its own, for setups without a build plugin: plain `babel`, or
 * CI that type-checks before it builds.
 */
export default new Command('compile')
  .description('Compile catalogues into locale modules')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .action((options) => {
    const config = resolveConfig();
    const logger = new Logger(options);
    logger.header('⚙ Compiling Catalogues');

    for (const bucket of config.buckets) {
      logger.info(`Compiling ${config.locales.length} locale(s): ${bucket.include}`);

      for (const { path, count, written } of compileBucketSync(config, bucket)) {
        const file = normalisePathForLogs(path);
        logger.step(
          written
            ? `Wrote ${count} message(s) to ${file}`
            : `${file} is up to date (${count} message(s))`,
        );
      }
    }

    logger.success('Catalogues compiled');
  });
