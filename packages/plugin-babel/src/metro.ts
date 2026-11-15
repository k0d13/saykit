import { prepareCatalogues } from './prepare.js';

/**
 * Wrap a Metro config so SayKit catalogues are compiled before Metro bundles anything.
 *
 * ```js
 * const { withSayKit } = require('babel-plugin-saykit/metro');
 * module.exports = withSayKit(getDefaultConfig(__dirname));
 * ```
 *
 * Under `expo start` the catalogues are also watched. The generated modules are real files, so
 * Metro invalidates a locale when a catalogue it falls back to changes. The config is returned
 * untouched, so this composes with any other wrapper.
 */
export function withSayKit<T extends object>(metroConfig: T): T {
  prepareCatalogues();
  return metroConfig;
}
