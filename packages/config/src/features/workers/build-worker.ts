import { join } from 'node:path';
import type Logger from '~/features/logger.js';
import { watchDebounced } from '~/features/watch.js';
import type { Bucket, Configuration } from '~/shapes.js';
import { BucketCompileWorker } from './compile-worker.js';
import { BucketExtractWorker } from './extract-worker.js';
import { BucketWorker, normalisePathForLogs } from './shared.js';

export class BucketBuildWorker extends BucketWorker {
  extract: BucketExtractWorker;
  compile: BucketCompileWorker;

  constructor(config: Configuration, bucket: Bucket, logger: Logger) {
    const parameters = [config, bucket, logger] as const;
    super(...parameters);
    this.extract = new BucketExtractWorker(...parameters);
    this.compile = new BucketCompileWorker(...parameters);
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
        this.logger.info(`Recompiling due to changes in ${normalisePathForLogs(filePath)}`);
        await this.compile.compileAll();
      }
    }
  }
}
