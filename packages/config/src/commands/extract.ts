import { Command } from '@commander-js/extra-typings';
import { resolveConfig } from '~/features/loader/resolve.js';
import Logger from '~/features/logger.js';
import { BucketExtractWorker } from '~/features/workers/extract-worker.js';

export default new Command('extract')
  .description('Extract messages from source files')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .action(async (options) => {
    const config = await resolveConfig('saykit');
    const logger = new Logger(options);
    logger.header('🛠 Extracting Messages');

    const tasks = config.buckets.map(async (bucket) => {
      const worker = new BucketExtractWorker(config, bucket, logger);
      await worker.scanAll();
      await worker.writeAll();
    });

    await Promise.all(tasks);
  });
