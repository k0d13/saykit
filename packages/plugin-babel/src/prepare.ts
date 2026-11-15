import { compileCataloguesSync, watchCatalogues } from '@saykit/config/features/catalogue';
import { resolveConfig } from '@saykit/config/features/loader';

/** Set once catalogues are compiled, so worker processes inherit it and skip doing it again. */
const MARKER = 'SAYKIT_CATALOGUES_PREPARED';

/**
 * Compile catalogues while a bundler config is evaluated, and keep them compiled outside a
 * production build.
 *
 * Next and Metro evaluate their config before they build anything and have no build-start hook a
 * Babel plugin can reach, so this runs synchronously right there. Both may evaluate the config again
 * in worker processes, which inherit the environment, so only the first process compiles and
 * watches.
 */
export function prepareCatalogues() {
  if (process.env[MARKER]) return;

  const config = resolveConfig();
  compileCataloguesSync(config);
  if (process.env.NODE_ENV !== 'production') watchCatalogues(config);

  process.env[MARKER] = String(process.pid);
}
