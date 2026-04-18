import { resolve } from 'node:path';
import type { Bucket } from '~/shapes.js';

export function expandBucketOutputPath(
  bucket: Bucket,
  locale: string,
  extension = bucket.formatter.extension,
) {
  const outputMessageTemplate = bucket.output
    .replaceAll('{locale}', locale)
    .replaceAll('{extension}', extension.slice(1));
  return resolve(outputMessageTemplate);
}
