import { prepareCatalogues } from './prepare.js';

/** The Next phases that build anything; `next start` serves what a build already compiled. */
const BUILD_PHASES = new Set(['phase-development-server', 'phase-production-build']);

type NextContext = { defaultConfig: object };
type NextConfigFunction<T> = (phase: string, context: NextContext) => T | Promise<T>;

/**
 * Wrap a Next config so SayKit catalogues are compiled before Next builds anything.
 *
 * ```js
 * import { withSayKit } from 'babel-plugin-saykit/next';
 * export default withSayKit({});
 * ```
 *
 * Under `next dev` the catalogues are also watched, so editing one rewrites every locale that falls
 * back to it. Nothing is compiled under `next start`, so serving a build needs neither the SayKit
 * config nor its formatters. Takes a config object or function and passes it through untouched.
 */
export function withSayKit<T extends object>(
  nextConfig: T | NextConfigFunction<T> = {} as T,
): NextConfigFunction<T> {
  return (phase, context) => {
    if (BUILD_PHASES.has(phase)) prepareCatalogues();
    return typeof nextConfig === 'function'
      ? (nextConfig as NextConfigFunction<T>)(phase, context)
      : nextConfig;
  };
}
