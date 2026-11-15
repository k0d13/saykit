import { prepareCatalogues } from './prepare.js';

/**
 * Wrap a Next config so SayKit catalogues are compiled before Next builds anything.
 *
 * ```js
 * import { withSayKit } from 'babel-plugin-saykit/next';
 * export default withSayKit({});
 * ```
 *
 * Under `next dev` the catalogues are also watched, so editing one rewrites every locale that falls
 * back to it. The config is returned untouched, so this composes with any other wrapper.
 */
export function withSayKit<T extends object>(nextConfig: T = {} as T): T {
  prepareCatalogues();
  return nextConfig;
}
