import { relative } from 'node:path';
import type Logger from '~/features/logger.js';
import type { Bucket, Configuration } from '~/shapes.js';

export function normalisePathForLogs(path: string) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

export abstract class BucketWorker {
  protected config: Configuration;
  protected bucket: Bucket;
  protected logger: Logger;

  constructor(config: Configuration, bucket: Bucket, logger: Logger) {
    this.config = config;
    this.bucket = bucket;
    this.logger = logger;
  }
}
