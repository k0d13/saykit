import { Command } from '@commander-js/extra-typings';
import { useConfig } from '~/features/loader/resolve.js';
import Logger from '~/features/logger.js';
import { BucketBuildWorker } from '~/features/worker.js';

export default new Command()
  .name('build')
  .description('')
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress all logging', false)
  // .option('-w, --watch', 'watch source files for changes', false)
  .action(async (options) => {
    const config = await useConfig('saykit');
    const logger = new Logger(options);
    logger.header('🏗 Building Messages');

    const tasks = config.buckets.map(async (bucket) => {
      const worker = new BucketBuildWorker(config, bucket, logger);
      await worker.buildAll();
      // if (options.watch) await worker.watch();
    });

    await Promise.allSettled(tasks);
  });
