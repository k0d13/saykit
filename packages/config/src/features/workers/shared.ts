import { relative } from 'node:path';
import type Logger from '#/features/logger.js';
import type { Bucket, Config } from '#/shapes.js';

export function normalisePathForLogs(path: string) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

export abstract class BucketWorker {
  protected config: Config;
  protected bucket: Bucket;
  protected logger: Logger;

  constructor(config: Config, bucket: Bucket, logger: Logger) {
    this.config = config;
    this.bucket = bucket;
    this.logger = logger;
  }
}
