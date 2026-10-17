import { Command } from '@commander-js/extra-typings';
import { resolveConfig } from '#/features/loader/index.js';
import Logger from '#/features/logger.js';
import { BucketExtractWorker } from '#/features/workers/extract-worker.js';

export default new Command('extract')
  .description('Extract messages from source files')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .option('-w, --watch', 'watch source files for changes', false)
  .action(async (options) => {
    const config = resolveConfig();
    const logger = new Logger(options);
    logger.header('🛠 Extracting Messages');

    const workers = config.buckets.map((b) => new BucketExtractWorker(config, b, logger));
    await Promise.all(workers.map((w) => w.scan().then(() => w.write())));
    if (options.watch) await Promise.all(workers.map((w) => w.watch()));
  });
