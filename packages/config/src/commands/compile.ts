import { Command } from '@commander-js/extra-typings';
import { resolveConfig } from '~/features/loader/resolve.js';
import Logger from '~/features/logger.js';
import { BucketCompileWorker } from '~/features/workers/compile-worker.js';

export default new Command('compile')
  .description('Compile translations into runtime-ready locale files')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  .action(async (options) => {
    const config = await resolveConfig('saykit');
    const logger = new Logger(options);
    logger.header('🛠 Compiling Translations');

    const tasks = config.buckets.map(async (bucket) => {
      const worker = new BucketCompileWorker(config, bucket, logger);
      await worker.compileAll();
    });

    await Promise.all(tasks);
  });
