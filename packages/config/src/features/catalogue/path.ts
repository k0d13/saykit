import { parse, resolve } from 'node:path';
import type { Bucket } from '#/shapes.js';

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

/**
 * The declaration file that types a catalogue, e.g. `en.json` -> `en.d.json.ts`.
 *
 * TypeScript resolves `./en.json` by stripping the extension and looking for
 * `en.d.json.ts`; the `en.json.d.ts` form is only consulted for extensions the
 * resolver does not recognise. Non-JS extensions additionally require
 * `allowArbitraryExtensions` in the consumer's tsconfig.
 */
export function declarationPathFor(cataloguePath: string) {
  const { dir, name, ext } = parse(cataloguePath);
  return resolve(dir, `${name}.d${ext}.ts`);
}
