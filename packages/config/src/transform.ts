import { resolve } from 'node:path';
import type { Resolved } from './config/resolve.js';

export function transform(config: Resolved, code: string, file: string) {
  const bucket = config.buckets.find((b) => b.includes(file));
  return bucket?.transformer.transform(code, resolve(config.root, file.replace(/\?.*$/, '')));
}
